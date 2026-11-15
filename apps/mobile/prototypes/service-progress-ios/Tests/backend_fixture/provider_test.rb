# frozen_string_literal: true
require 'bundler/setup'
require 'active_support/all'
require 'openssl'
require 'securerandom'
require 'json'
require_relative 'provider_experiment'

root = ARGV.fetch(0)
# Immutable actual classes, not backend copies. Delivery and Rack are explicitly
# synthetic collaborators in these offline contracts; CLI test uses actual Rails.
%w[service_progress service_progress/fake_provider service_progress/payload
   service_progress/registrations service_progress/apns_jwt_auth service_progress/apns_provider
   service_progress/apns_curl_http2 service_progress/development_bootstrap].each do |name|
  require File.join(root, 'src/app/services', name)
end
module Rails
  def self.env
    ActiveSupport::StringInquirer.new('development')
  end
end
module ServiceProgress
  class Delivery
    class << self
      attr_accessor :record, :payload
      def prepare(_id, now:, bootstrap:)
        bootstrap.authorize!(record)
      end
      def deliver(_id, now:, provider:, bootstrap:)
        provider.deliver(token: bootstrap.push_token(record), environment: 'sandbox',
          topic: DevelopmentBootstrap::TOPIC, payload: payload)
      end
    end
  end
end

def check(value)
  raise 'contract assertion failed' unless value
end

def rejects
  begin
    yield
  rescue ProviderExperiment::Error
    return
  end
  raise 'expected rejection'
end

def pipe_for(packet)
  reader, writer = IO.pipe
  writer.write(JSON.generate(packet))
  writer.close
  reader
end

now = Time.utc(2026, 11, 15, 6)
key = SecureRandom.random_bytes(32)
ServiceProgress.define_singleton_method(:encryption_key) { key.dup }
id = SecureRandom.uuid
generation = SecureRandom.uuid
token = SecureRandom.hex(32)
secret = SecureRandom.hex(32)
signing_key = OpenSSL::PKey::EC.generate('prime256v1')
packet = { 'signing' => { 'team_id' => 'TESTTEAM00', 'key_id' => 'TESTKEY000', 'signing_key_pem' => signing_key.private_to_pem },
  'registrations' => [{ 'id' => id, 'secret' => secret, 'attributes' => {
    'session_id' => 42, 'activity_id' => 'generated-test-activity', 'generation' => generation,
    'push_token' => token, 'token_version' => 1, 'consent_version' => 'public-lock-screen-v1', 'lease_seconds' => 60 } }] }
record = Struct.new(:id, :session_id, :environment, :push_token_ciphertext).new(id, 42, 'sandbox',
  ActiveSupport::MessageEncryptor.new(key, cipher: 'aes-256-gcm').encrypt_and_sign(token))
ServiceProgress::Delivery.record = record
state = { 'schemaVersion' => 1, 'sessionID' => 42, 'generation' => generation, 'sequence' => 1,
  'status' => 'active', 'updatedAt' => now.to_i - 978_307_200, 'expiresAt' => now.to_i + 30 - 978_307_200 }
ServiceProgress::Delivery.payload = ServiceProgress::Payload.build(content_state: state,
  event: 'update', issued_at: now.to_i, expires_at: now.to_i + 30)
count = 0
transport = lambda do |command:, stdin_data:, timeout:|
  count += 1
  check(command.first == '/usr/bin/curl' && command.last == '-' && timeout <= 5)
  check(!command.join(' ').include?(token) && !command.join(' ').include?(secret))
  check(stdin_data.include?('https://api.sandbox.push.apple.com/3/device/' + token))
  check(stdin_data.include?('app.tarkman.progressprototype.push-type.liveactivity'))
  check(stdin_data.include?("apns-expiration: #{now.to_i + 30}"))
  bearer = stdin_data.match(/authorization: bearer ([A-Za-z0-9_.-]+)/)[1]
  claims, header = JWT.decode(bearer, signing_key, true, algorithm: 'ES256')
  check(claims == { 'iss' => 'TESTTEAM00', 'iat' => now.to_i } && header['kid'] == 'TESTKEY000')
  "\n2\n200"
end
calls = []
app = lambda do |env|
  body = JSON.parse(env.fetch('rack.input').read)
  check(env.fetch('HTTP_X_SERVICE_ACTIVITY_SECRET') == secret)
  calls << env.fetch('REQUEST_METHOD')
  receipt = env['REQUEST_METHOD'] == 'POST' ? body.merge('id' => id, 'revoked' => true) : { 'id' => id }
  [200, {}, [JSON.generate(receipt)]]
end
base = { enabled: true, authorization_enabled: true, transport_enabled: true, registration_ids: [id],
  verify_namespace: -> { true }, transport_runner: transport, clock: -> { now }, max_requests: 1 }
check(ProviderExperiment::Run.new.call(app: ->(_) { raise 'must not run' }) == { status: :disabled })
rejects { ProviderExperiment::Run.new(**base.merge(authorization_enabled: false)) }
rejects { ProviderExperiment::Run.new(**base.merge(transport_enabled: false)) }
rejects { ProviderExperiment::Run.new(**base.merge(registration_ids: [id, id])) }
rejects { ProviderExperiment::Run.new(**base.merge(rounds: 2)) }
rejects { ProviderExperiment::Run.new(**base.merge(deadline_seconds: 31)) }
result = ProviderExperiment::Run.new(**base, input: pipe_for(packet)).call(app: app)
check(result[:status] == :completed && result[:requests] == 1 && result[:cleanup_verified] && calls == %w[PUT POST])
check(result[:execution_completed] && result[:acceptance_observed] &&
  result[:transport_outcomes] == { responses: { 200 => 1 }, exceptions: 0, accepted_responses: 1 })
check(count == 1)
check(ServiceProgress.provider.instance_of?(ServiceProgress::FakeProvider))
check(ServiceProgress.topic == 'org.tarkman.progress.experiment.push-type.liveactivity')

# Missing token/allowlist mismatch fail closed before PUT/auth/network.
bad = Marshal.load(Marshal.dump(packet))
bad['registrations'][0]['attributes'].delete('push_token')
result = ProviderExperiment::Run.new(**base, input: pipe_for(bad)).call(app: ->(_) { raise 'must not run' })
check(result[:status] == :failed && result[:attempted] == 0 && count == 1)
result = ProviderExperiment::Run.new(**base.merge(verify_namespace: -> { false }), input: pipe_for(packet)).call(app: app)
check(result[:status] == :failed && result[:requests] == 0)

# Ambiguous PUT is staged before dispatch and still fenced; no provider call.
ambiguous = lambda do |env|
  raise IOError, 'generated-test-secret-diagnostic' if env['REQUEST_METHOD'] == 'PUT'
  app.call(env)
end
result = ProviderExperiment::Run.new(**base, input: pipe_for(packet)).call(app: ambiguous)
check(result[:status] == :failed && result[:attempted] == 1 && result[:requests] == 0 && result[:cleanup_verified])
# Ambiguous provider transport cannot skip fenced cleanup or leak diagnostics.
ambiguous_transport = ->(**_) { raise IOError, 'generated-test-secret-diagnostic' }
result = ProviderExperiment::Run.new(**base.merge(transport_runner: ambiguous_transport), input: pipe_for(packet)).call(app: app)
check(result[:status] == :failed && result[:requests] == 1 && result[:cleanup_verified])
check(!JSON.generate(result).include?('generated-test-secret-diagnostic'))

# A wrong fence receipt is unresolved even after synthetic provider200.
wrong = lambda do |env|
  if env['REQUEST_METHOD'] == 'POST'
    [200, {}, [JSON.generate('revoked' => true)]]
  else
    app.call(env)
  end
end
result = ProviderExperiment::Run.new(**base, input: pipe_for(packet)).call(app: wrong)
check(result[:status] == :failed && !result[:cleanup_verified])

# Existing binding must reject wrong session/sandbox before transport.
record.environment = 'production'
result = ProviderExperiment::Run.new(**base, input: pipe_for(packet)).call(app: app)
check(result[:status] == :failed && result[:requests] == 0 && result[:cleanup_verified])
record.environment = 'sandbox'
record.session_id = 43
result = ProviderExperiment::Run.new(**base, input: pipe_for(packet)).call(app: app)
check(result[:status] == :failed && result[:requests] == 0)
record.session_id = 42

# Expired payload never reaches the concrete transport, and cleanup still runs.
result = ProviderExperiment::Run.new(**base.merge(clock: -> { now + 31 }), input: pipe_for(packet)).call(app: app)
check(result[:status] == :failed && result[:requests] == 0 && result[:cleanup_verified])

# Expired monotonic send deadline still permits independent bounded cleanup.
tick = 0.0
deadline_app = lambda do |env|
  tick = 2.0 if env['REQUEST_METHOD'] == 'PUT'
  app.call(env)
end
result = ProviderExperiment::Run.new(**base.merge(monotonic: -> { tick }, deadline_seconds: 1), input: pipe_for(packet)).call(app: deadline_app)
check(result[:status] == :failed && result[:requests] == 0 && result[:cleanup_verified])

# Input rejection: regular file, bad JSON, bounded EOF wait and oversized packet.
rejects { ProviderExperiment.read_packet(File.open(__FILE__), timeout: 0.1) }
r, w = UNIXSocket.pair
w.write('{"private_ipc":true}'); w.close
# Match entrypoint's generic IO.for_fd ownership rather than a UNIXSocket object.
r.autoclose = false
check(ProviderExperiment.read_packet(IO.for_fd(r.fileno), timeout: 0.1) == { 'private_ipc' => true })
r, w = IO.pipe
w.write('{'); w.close
rejects { ProviderExperiment.read_packet(r, timeout: 0.1) }
r, w = IO.pipe
rejects { ProviderExperiment.read_packet(r, timeout: 0.01) }
w.close
r, w = IO.pipe
thread = Thread.new { begin; w.write('x' * 33_000); rescue Errno::EPIPE; ensure; w.close; end }
rejects { ProviderExperiment.read_packet(r, timeout: 1) }
thread.join
check(!ProviderExperiment::Run.new.inspect.include?(secret))
puts JSON.generate(status: 'passed', offline_contracts: true, actual_pinned_provider_classes: true,
  binding_topic_sandbox_expiry: true, default_off: true, bad_inputs: true, exact_fence_cleanup: true,
  generated_es256_verified: true, no_network: true, secret_argv_redaction: true)
