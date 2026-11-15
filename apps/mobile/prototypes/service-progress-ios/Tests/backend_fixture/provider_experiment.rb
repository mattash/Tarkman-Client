# frozen_string_literal: true

require 'json'
require 'socket'
require 'stringio'
require 'timeout'

# Separate one-shot caller; never installed into the normal factory/server.
module ProviderExperiment
  class Error < StandardError; end
  MAX_INPUT = 32_768
  UUID = /\A[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\z/

  # Only an already-open anonymous pipe or Unix socket, never a path, terminal,
  # environment lookup, regular file or TCP socket. EOF is required and bounded.
  def self.read_packet(io, timeout:)
    raise Error unless io.is_a?(IO) && !io.tty?
    stat = io.stat
    unix_socket = false
    if stat.socket?
      socket = Socket.for_fd(io.fileno)
      socket.autoclose = false # The input IO remains the single descriptor owner.
      unix_socket = socket.local_address.afamily == Socket::AF_UNIX
    end
    raise Error unless stat.pipe? || unix_socket
    data = +''
    Timeout.timeout(timeout) do
      loop do
        data << io.readpartial(1024)
        raise Error if data.bytesize > MAX_INPUT
      rescue EOFError
        break
      end
    end
    JSON.parse(data)
  rescue StandardError
    raise Error, 'provider input rejected', cause: nil
  ensure
    data&.clear
    io.close if io.is_a?(IO) && !io.closed?
  end

  # Independent pre-Rails protection, matching the existing fixture's ownership
  # checks. The Python launcher additionally verifies manifest/archive/source pin.
  def self.validate_owned_pg!(root)
    [root, File.join(root, 'pg'), File.join(root, 'socket')].each do |path|
      info = File.lstat(path)
      raise Error unless info.directory? && !info.symlink? && info.uid == Process.uid &&
        (info.mode & 0o077).zero? && File.realpath(path) == path
    end
    marker = File.lstat(File.join(root, 'pg', 'PG_VERSION'))
    raise Error unless marker.file? && !marker.symlink? && marker.uid == Process.uid
    true
  end

  class Run
    def initialize(enabled: false, authorization_enabled: false, transport_enabled: false,
                   registration_ids: [], input: nil, verify_namespace: nil, deadline_seconds: 15,
                   rounds: 1, max_requests: 4, transport_runner: nil,
                   clock: -> { Time.current }, monotonic: -> { Process.clock_gettime(Process::CLOCK_MONOTONIC) })
      @enabled = enabled.equal?(true)
      return unless @enabled
      raise Error unless authorization_enabled.equal?(true) && transport_enabled.equal?(true)
      raise Error unless registration_ids.is_a?(Array) && registration_ids.size.between?(1, 20) &&
        registration_ids.uniq.size == registration_ids.size && registration_ids.all? { |id| id.is_a?(String) && UUID.match?(id) }
      raise Error unless deadline_seconds.is_a?(Integer) && deadline_seconds.between?(1, 30)
      raise Error unless rounds.is_a?(Integer) && rounds.between?(1, 4)
      raise Error unless max_requests.is_a?(Integer) && max_requests.between?(1, 20) && registration_ids.size * rounds <= max_requests
      raise Error unless verify_namespace.respond_to?(:call)
      @ids = registration_ids.map { |id| id.dup.freeze }.freeze
      @input, @verify, @runner, @clock, @monotonic = input, verify_namespace, transport_runner, clock, monotonic
      @seconds, @rounds, @maximum = deadline_seconds, rounds, max_requests
      @attempted, @requests = [], 0
      @outcomes = { responses: {}, exceptions: 0, accepted_responses: 0 }
    rescue StandardError
      close
      raise Error, 'provider configuration rejected', cause: nil
    end

    # The app is the ACTUAL Rails Rack app. No API/provider/transport copies.
    def call(app:)
      return { status: :disabled } unless @enabled
      raise Error, 'provider already closed', cause: nil if @closed
      success = false
      verified = []
      @deadline = @monotonic.call + @seconds
      phase = :startup
      begin
        Timeout.timeout(remaining!) do
          @key = ServiceProgress.encryption_key.dup
          verify!
          @packet = ProviderExperiment.read_packet(@input, timeout: [remaining!, 2].min)
          @input = nil
          validate_packet!
          signing = @packet.fetch('signing')
          auth = ServiceProgress::ApnsJwtAuth.new(team_id: signing.fetch('team_id'), key_id: signing.fetch('key_id'),
            signing_key: OpenSSL::PKey.read(signing.fetch('signing_key_pem')), clock: @clock)
          concrete = ServiceProgress::ApnsCurlHttp2.new(**(@runner ? { runner: @runner } : {}))
          bounded = lambda do |**request|
            verify!
            raise Error if @requests >= @maximum
            @requests += 1
            request[:timeout] = [request.fetch(:timeout), remaining!].min
            begin
              response = concrete.call(**request)
              status = response.fetch(:status)
              @outcomes[:responses][status] = @outcomes[:responses].fetch(status, 0) + 1
              @outcomes[:accepted_responses] += 1 if status == 200 && response[:body] == ''
              response
            rescue StandardError
              @outcomes[:exceptions] += 1
              raise
            end
          end
          @bootstrap = ServiceProgress::DevelopmentBootstrap.new(enabled: true, isolated: true,
            session_id: 42, registration_ids: @ids, encryption_key: @key,
            auth: auth, http2: bounded, clock: @clock)
          phase = :registration
          @packet.fetch('registrations').each do |registration|
            verify!
            @attempted << registration # Stage BEFORE a possibly committing PUT.
            status, = request(app, registration, 'PUT', registration.fetch('attributes'))
            @put_status = status
            raise Error unless status == 200
          end
          verify!
          phase = :publication
          @bootstrap.call(rounds: @rounds)
          success = true
        end
      rescue StandardError
        success = false
      ensure
        @bootstrap&.close
        # Independent TOTAL cleanup budget; never extend the delivery deadline.
        begin
          Timeout.timeout(5) do
            @attempted.each_with_index do |registration, index|
              begin
                verify_namespace_and_key!
                identity = registration.fetch('attributes').slice('session_id', 'activity_id', 'generation')
                status, receipt = request(app, registration, 'POST', identity)
                @fence_status = status
                raise Error unless status == 200 && receipt == identity.merge('id' => registration.fetch('id'), 'revoked' => true)
                verified << index
              rescue StandardError
                # Continue other staged identities inside the same TOTAL budget.
              end
            end
          end
        rescue StandardError
          # Unresolved is retained in result. Never report arbitrary exceptions.
        ensure
          attempted = @attempted.size
          close
        end
      end
      unresolved_aliases = (0...attempted).reject { |index| verified.include?(index) }.map { |index| "registration_#{index + 1}" }
      { status: success && verified.size == attempted ? :completed : :failed,
        attempted: attempted, requests: @requests, fenced_receipts: verified.size,
        unresolved_aliases: unresolved_aliases, cleanup_status: verified.size == attempted ? :verified : :unresolved,
        cleanup_verified: verified.size == attempted, phase: phase, put_status: @put_status,
        fence_status: @fence_status, execution_completed: success,
        transport_outcomes: @outcomes, acceptance_observed: @outcomes[:accepted_responses].positive?,
        acceptance_not_display: true }
    end

    def close
      @bootstrap&.close
      @input.close if @input.is_a?(IO) && !@input.closed?
      clear_strings(@packet)
      @key&.clear
      @key = @packet = @input = @bootstrap = @runner = @verify = @clock = nil
      @closed = true
    end

    def inspect
      '#<ProviderExperiment::Run redacted>'
    end
    alias to_s inspect

    private

    def validate_packet!
      raise Error unless @packet.is_a?(Hash) && @packet.keys.sort == %w[registrations signing]
      signing = @packet['signing']
      raise Error unless signing.is_a?(Hash) && signing.keys.sort == %w[key_id signing_key_pem team_id]
      registrations = @packet['registrations']
      raise Error unless registrations.is_a?(Array) && registrations.size == @ids.size &&
        registrations.map { |r| r.is_a?(Hash) && r['id'] }.sort == @ids.sort
      registrations.each do |r|
        raise Error unless r.keys.sort == %w[attributes id secret] && r['secret'].is_a?(String) && r['secret'].bytesize.between?(32, 512)
        a = r['attributes']
        raise Error unless a.is_a?(Hash) && a.keys.sort == ServiceProgress::Registrations::PUT_KEYS.sort &&
          a['session_id'] == 42 && a['activity_id'].is_a?(String) && a['activity_id'].bytesize.between?(1, 200) &&
          a['generation'].is_a?(String) && UUID.match?(a['generation']) && a['push_token'].is_a?(String) &&
          /\A(?:[0-9a-f]{2}){1,100}\z/i.match?(a['push_token']) && a['token_version'] == 1 &&
          a['consent_version'] == ServiceProgress::Registrations::CONSENT_VERSION && a['lease_seconds'] == 60
      end
    end

    def request(app, registration, method, attributes)
      data = JSON.generate(attributes)
      raise Error if data.bytesize > 4096
      suffix = method == 'POST' ? '/revoke' : ''
      env = { 'REQUEST_METHOD' => method, 'PATH_INFO' => "/public/service_activity_registrations/#{registration.fetch('id')}#{suffix}",
        'QUERY_STRING' => '', 'CONTENT_TYPE' => 'application/json', 'CONTENT_LENGTH' => data.bytesize.to_s,
        'HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1', 'SERVER_PORT' => '80',
        'rack.url_scheme' => 'http', 'rack.input' => StringIO.new(data), 'rack.errors' => StringIO.new,
        'HTTP_X_SERVICE_ACTIVITY_SECRET' => registration.fetch('secret') }
      status, _, response = app.call(env)
      output = +''
      response.each { |chunk| output << chunk; raise Error if output.bytesize > 4096 }
      [status, JSON.parse(output)]
    ensure
      response.close if response.respond_to?(:close)
      data&.clear
    end

    def remaining!
      remaining = @deadline - @monotonic.call
      raise Error unless remaining.positive?
      remaining
    end

    def verify_namespace_and_key!
      raise Error unless @verify.call.equal?(true) && ServiceProgress.encryption_key == @key
      raise Error unless ServiceProgress.provider.instance_of?(ServiceProgress::FakeProvider) &&
        ServiceProgress.topic == 'org.tarkman.progress.experiment.push-type.liveactivity'
    end

    def verify!
      remaining!
      verify_namespace_and_key!
    end

    def clear_strings(value)
      case value
      when Hash then value.each_value { |v| clear_strings(v) }
      when Array then value.each { |v| clear_strings(v) }
      when String then value.clear unless value.frozen?
      end
    end
  end
end
