# frozen_string_literal: true
# Explicit disposable Rails runner. Only synthetic collaborators; no APNs network.
require 'bundler/setup'
require 'json'
require 'securerandom'
require 'set'
require 'stringio'
require 'time'
require 'uri'

configuration = JSON.parse(File.read(ARGV.fetch(0)))
root = File.realpath(configuration.fetch('root'))
database = configuration.fetch('database')
raise 'invalid mode' unless configuration['enabled'] == true && %w[serve schema].include?(configuration['mode'])
raise 'invalid database name' unless database.match?(/\Asp277_[a-z0-9_]{1,40}\z/)
raise 'invalid backend pin' unless configuration['backend_sha'] == '46481161509155d04e3fcf60ce7928ea19f9614b'
ENV['SERVICE_PROGRESS_EXPERIMENT_ENABLED'] = 'true'
ENV['SERVICE_PROGRESS_ENCRYPTION_KEY'] = SecureRandom.hex(32)
require File.join(root, 'src/config/environment')
Rails.logger.level = Logger::WARN
ActiveRecord::Base.logger = nil
facts = ActiveRecord::Base.connection.select_one("SELECT current_database() AS db, current_setting('data_directory') AS dir, current_setting('unix_socket_directories') AS socket, current_setting('port') AS port, current_setting('listen_addresses') AS listen")
raise 'owned database mismatch' unless facts['db'] == database &&
  File.realpath(facts.fetch('dir')) == File.realpath(File.join(root, 'pg')) &&
  File.realpath(facts.fetch('socket')) == File.realpath(File.join(root, 'socket')) &&
  facts['port'] == configuration.fetch('pg_port').to_s && facts['listen'] == ''
$stdout.sync = true
puts JSON.generate(event: 'owned_database_verified', database:, pg_port: configuration['pg_port'], tcp_disabled: true)

if ActiveRecord::Base.connection.tables.empty?
  Rails.application.load_tasks
  Rake::Task['db:schema:load'].invoke
  Rake::Task['db:migrate'].invoke
end
if configuration['mode'] == 'schema'
  puts JSON.generate(event: 'schema_ready')
  exit
end

# Check recovery before any fixture date/seed mutation; never resume lost-key work.
raise 'unresolved prior registration; recovery review required' if ServiceActivityRegistration.where(revoked_at: nil).exists?
fixture_zone = 'America/Los_Angeles'
fixture_date = Time.current.in_time_zone(fixture_zone).to_date
if Session.count.zero?
  user = User.new(email: 'sp277-disposable@example.invalid', password: SecureRandom.hex(24))
  user.skip_confirmation!
  user.skip_confirmation_notification!
  user.save!
  liturgy = Liturgy.create!(name: 'Synthetic service progress 277', is_public: true)
  occurrences = 3.times.map do |index|
    part = Part.create!(en: "Synthetic part #{index + 1}", grabar: "Synthetic #{index + 1}", translit: "Synthetic #{index + 1}", role: 'priest')
    LiturgyPart.create!(liturgy:, part:, position: index + 1)
  end
  session = Session.new(id: 42, user:, liturgy:, date: fixture_date, options: {})
  session.skip_liturgy_validation = true
  session.save!
  SessionLiturgy.create!(session:, liturgy:, position: 1)
  session.update!(current_part_id: occurrences.first.part_id, current_liturgy_part_id: occurrences.first.id)
else
  raise 'synthetic session scope mismatch' unless Session.count == 1 && Session.exists?(42)
  session = Session.find(42)
  raise 'synthetic seed identity mismatch' unless session.user.email == 'sp277-disposable@example.invalid' &&
    session.liturgy.name == 'Synthetic service progress 277'
  # Real source write/revision, only for this owned synthetic seed and before run.
  session.update!(date: fixture_date) if session.date != fixture_date
end
puts JSON.generate(event: 'synthetic_today_binding', session_id: 42, zone: fixture_zone, date: fixture_date.iso8601, revision: session.reload.revision)
raise 'normal provider changed' unless ServiceProgress.provider.instance_of?(ServiceProgress::FakeProvider)
raise 'normal topic changed' unless ServiceProgress.topic == 'org.tarkman.progress.experiment.push-type.liveactivity'
known_ids = ServiceActivityRegistration.pluck(:id).to_set
raise 'registration bound exceeded' if known_ids.size > 20
provider_calls = 0
transport = ServiceProgress::ApnsCurlHttp2.new(runner: lambda do |command:, stdin_data:, timeout:|
  raise 'invalid synthetic subprocess invocation' unless command.first == '/usr/bin/curl' && timeout.positive? && timeout <= 5 &&
    stdin_data.include?('app.tarkman.progressprototype.push-type.liveactivity') && stdin_data.include?('api.sandbox.push.apple.com')
  provider_calls += 1
  puts JSON.generate(event: 'synthetic_provider_response', status: 200, protocol: '2', provider_calls:, no_network: true)
  "\n2\n200"
end)
lock = Mutex.new
reads = 0
mutations = 0
bootstrapped = false
reject = ->(status, code) { [status, { 'content-type' => 'application/json', 'cache-control' => 'no-store', 'date' => Time.now.utc.httpdate }, [JSON.generate(error: code)]] }
part_ids = Session.find(42).all_parts_ordered.map(&:id).map(&:to_s).to_set
app = lambda do |env|
  # Serialized scoped fixture only; no production concurrency/throughput claim.
  lock.synchronize do
    method = env.fetch('REQUEST_METHOD')
    path = env.fetch('PATH_INFO')
    query = env.fetch('QUERY_STRING', '')
    public_read = method == 'GET' && (path == '/services.json' || path.match?(%r{\A/s/42(?:/state|/parts)?\.json\z}) ||
      (match = path.match(%r{\A/s/42/parts/(\d+)\.json\z})) && part_ids.include?(match[1]))
    registration = path.match(%r{\A/public/service_activity_registrations/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(/revoke)?\z})
    mutation = registration && ((registration[2].nil? && %w[PUT DELETE].include?(method)) || (registration[2] && method == 'POST'))
    next reject.call(404, 'fixture_route_scope') unless public_read || mutation
    next reject.call(422, 'fixture_query_scope') if query.bytesize > 1024 || (mutation && !query.empty?)
    listing_query_valid = path != '/services.json' || ((URI.decode_www_form(query) rescue nil) == [['tz', 'America/Los_Angeles']])
    next reject.call(422, 'fixture_listing_query_scope') unless listing_query_valid
    if path == '/services.json'
      next reject.call(409, 'fixture_listing_data_scope') unless Session.count == 1 && Session.exists?(42)
    end
    if public_read
      reads += 1
      next reject.call(429, 'fixture_read_bound') if reads > configuration.fetch('max_reads')
    else
      mutations += 1
      next reject.call(429, 'fixture_mutation_bound') if mutations > 100
      id = registration[1]
      next reject.call(409, 'fixture_identity_bound') if !known_ids.include?(id) && known_ids.size >= 20
      body = env.fetch('rack.input').read(4097)
      next reject.call(422, 'fixture_body_bound') if body.bytesize > 4096
      if method == 'DELETE'
        next reject.call(422, 'fixture_delete_body') unless body.empty?
      else
        object = JSON.parse(body) rescue nil
        next reject.call(422, 'fixture_session_scope') unless object.is_a?(Hash) && object['session_id'] == 42
      end
      known_ids.add(id)
      env['rack.input'] = StringIO.new(body)
    end
    result = Rails.application.call(env)
    result[1]['date'] = Time.now.utc.httpdate
    puts JSON.generate(event: 'http_result', method:, route_class: public_read ? 'public_selection' : 'registration', status: result.first, reads:, mutations:, allowed_path: true)
    if !bootstrapped && method == 'PUT' && result.first == 200
      bootstrapped = true
      runner = ServiceProgress::DevelopmentBootstrap.new(enabled: true, isolated: true, session_id: 42,
        registration_ids: [registration[1]], encryption_key: ServiceProgress.encryption_key,
        auth: ->(**_) { 'synthetic.auth.signature' }, http2: transport)
      outcome = runner.call(rounds: 1)
      puts JSON.generate(event: 'bootstrap_completed', outcome:, provider_calls:, acceptance_not_display: true)
    end
    result
  end
end
require 'puma'
server = Puma::Server.new(app, nil, { min_threads: 0, max_threads: 3 })
server.add_tcp_listener('127.0.0.1', configuration.fetch('http_port'))
server.run
puts JSON.generate(event: 'ready', origin: "http://127.0.0.1:#{configuration['http_port']}", session_id: 42,
  ttl_seconds: configuration['ttl'], max_reads: configuration['max_reads'], max_registration_ids: 20, real_apns: false)
reader, writer = IO.pipe
%w[TERM INT].each { |signal| Signal.trap(signal) { writer.write_nonblock('.') rescue nil } }
begin
  IO.select([reader], nil, nil, configuration.fetch('ttl'))
ensure
  server.stop(true)
  puts JSON.generate(event: 'stopped', reads:, mutations:, provider_calls:)
end
