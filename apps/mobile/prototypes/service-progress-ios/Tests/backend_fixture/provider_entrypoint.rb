# frozen_string_literal: true
# Only launched by provider_runner.py with verified nonsecret configuration.
require 'bundler/setup'
require 'json'
require 'securerandom'
require_relative 'provider_experiment'

begin
  configuration = JSON.parse(File.read(ARGV.fetch(0)))
  raise ProviderExperiment::Error unless configuration['enabled'] == true &&
    configuration['authorization_enabled'] == true && configuration['transport_enabled'] == true
  root = configuration.fetch('root')
  ProviderExperiment.validate_owned_pg!(root) # BEFORE Bundler/Rails/initializers.
  raise ProviderExperiment::Error unless configuration['backend_sha'] == '46481161509155d04e3fcf60ce7928ea19f9614b' &&
    configuration.fetch('database').match?(/\Asp277_[a-z0-9_]{1,40}\z/)
  input = IO.for_fd(Integer(ARGV.fetch(1)), autoclose: true)
  require 'bundler/setup'
  require File.join(root, 'src/config/application')
  # Disable Rails output BEFORE initialization/first-request reload. Never let a
  # framework diagnostic persist or print an injected credential/header/body.
  Rails.application.config.logger = ActiveSupport::Logger.new(File::NULL)
  Rails.application.config.log_level = :fatal
  require File.join(root, 'src/config/environment')
  Rails.logger.level = Logger::FATAL
  ActiveRecord::Base.logger = nil
  # Private process-local key, NOT injected in argv/environment/config. There is
  # no key export or recovery/reuse of ciphertext from the ordinary server.
  encryption_key = SecureRandom.random_bytes(32)
  ServiceProgress.define_singleton_method(:encryption_key) { encryption_key.dup }
  ServiceProgress.define_singleton_method(:enabled?) { true }
  verify = lambda do
    ProviderExperiment.validate_owned_pg!(root)
    facts = ActiveRecord::Base.connection.select_one("SELECT current_database() AS db, current_setting('data_directory') AS dir, current_setting('unix_socket_directories') AS socket, current_setting('port') AS port, current_setting('listen_addresses') AS listen")
    facts['db'] == configuration.fetch('database') && facts['dir'] == File.join(root, 'pg') &&
      facts['socket'] == File.join(root, 'socket') && facts['port'] == configuration.fetch('pg_port').to_s && facts['listen'] == ''
  end
  raise ProviderExperiment::Error unless verify.call && Rails.env.development?
  if configuration.fetch('initialize_synthetic_fixture')
    # Schema tasks ran in a separate existing guarded server process. Never
    # retain auth/key/module references across Rails schema-task reload state.
    raise ProviderExperiment::Error if ActiveRecord::Base.connection.tables.empty?
    raise ProviderExperiment::Error unless Session.count.zero? && User.count.zero? && Liturgy.count.zero?
    user = User.new(email: 'sp277-disposable@example.invalid', password: SecureRandom.hex(24))
    user.skip_confirmation!
    user.skip_confirmation_notification!
    user.save!
    liturgy = Liturgy.create!(name: 'Synthetic service progress 277', is_public: true)
    occurrences = 3.times.map do |index|
      part = Part.create!(en: "Synthetic part #{index + 1}", grabar: "Synthetic #{index + 1}",
        translit: "Synthetic #{index + 1}", role: 'priest')
      LiturgyPart.create!(liturgy: liturgy, part: part, position: index + 1)
    end
    session = Session.new(id: 42, user: user, liturgy: liturgy,
      date: Time.current.in_time_zone('America/Los_Angeles').to_date, options: {})
    session.skip_liturgy_validation = true
    session.save!
    SessionLiturgy.create!(session: session, liturgy: liturgy, position: 1)
    session.update!(current_part_id: occurrences.first.part_id, current_liturgy_part_id: occurrences.first.id)
  end
  raise ProviderExperiment::Error unless Session.count == 1 && Session.exists?(42) &&
    Session.find(42).user.email == 'sp277-disposable@example.invalid' &&
    Session.find(42).liturgy.name == 'Synthetic service progress 277'
  # A different process's lost key is NOT recoverable here. Do not reuse, prune,
  # overwrite or pretend to decrypt unresolved registrations.
  raise ProviderExperiment::Error if ServiceActivityRegistration.where(revoked_at: nil).exists?
  synthetic = configuration.fetch('synthetic_transport')
  raise ProviderExperiment::Error unless synthetic == true || synthetic == false
  scenario = configuration.fetch('synthetic_scenario')
  raise ProviderExperiment::Error unless %w[accepted rejected transport-error expired-registration].include?(scenario)
  raise ProviderExperiment::Error if !synthetic && scenario != 'accepted'
  transport_runner = if synthetic
    lambda do |command:, stdin_data:, timeout:|
      raise ProviderExperiment::Error unless command.first == '/usr/bin/curl' && timeout.positive? && timeout <= 5 &&
        stdin_data.include?('api.sandbox.push.apple.com') &&
        stdin_data.include?('app.tarkman.progressprototype.push-type.liveactivity')
      raise IOError if scenario == 'transport-error'
      scenario == 'rejected' ? "{\"reason\":\"BadDeviceToken\"}\n2\n400" : "\n2\n200"
    end
  end
  test_clock = synthetic && scenario == 'expired-registration' ? -> { Time.current + 61 } : -> { Time.current }
  experiment = ProviderExperiment::Run.new(enabled: true, authorization_enabled: true, transport_enabled: true,
    registration_ids: configuration.fetch('registration_ids'), input: input, verify_namespace: verify,
    deadline_seconds: configuration.fetch('deadline_seconds'), rounds: configuration.fetch('rounds'),
    max_requests: configuration.fetch('max_requests'), transport_runner: transport_runner, clock: test_clock)
  %w[TERM INT].each { |signal| Signal.trap(signal) { raise ProviderExperiment::Error } }
  result = experiment.call(app: Rails.application)
  # Aggregate credential-free postcondition; not a dump of registration columns.
  unresolved = ServiceActivityRegistration.where(revoked_at: nil).count
  retained_ciphertexts = ServiceActivityRegistration.where.not(push_token_ciphertext: nil).count
  prepared = ServiceActivityRegistration.where.not(prepared_publication: nil).count
  all_observed_accepted = result[:acceptance_observed] && result[:transport_outcomes][:accepted_responses] == result[:requests]
  acceptance = if !result[:acceptance_observed]
    'not_observed'
  elsif !all_observed_accepted
    synthetic ? 'synthetic_partial' : 'partial_provider_response'
  else
    synthetic ? 'synthetic_only' : 'provider_response'
  end
  result = result.merge(no_network: synthetic, acceptance: acceptance, unresolved: unresolved,
    retained_ciphertexts: retained_ciphertexts, prepared: prepared)
  puts JSON.generate(result)
  # Execution/cleanup completion is not acceptance. No-publication, provider
  # rejection and ambiguous transport exit nonzero even when Bootstrap completed.
  exit(result[:status] == :completed && all_observed_accepted && unresolved.zero? && retained_ciphertexts.zero? && prepared.zero? ? 0 : 1)
rescue StandardError
  warn JSON.generate(status: 'failed', stage: 'provider_entrypoint')
  exit 1
ensure
  experiment&.close
  input.close if input && !input.closed?
  encryption_key&.clear
end
