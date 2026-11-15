# frozen_string_literal: true
# Authorized generated TEST material only. Nothing reads a credential source.
require 'json'
require 'openssl'
require 'securerandom'
require 'timeout'

root = ARGV.fetch(0)
initialize_fixture = ARGV.include?('--initialize-synthetic-fixture')
database_index = ARGV.index('--database')
database = database_index ? ARGV.fetch(database_index + 1) : 'sp277_3429_provider_test'
scenario_index = ARGV.index('--scenario')
scenario = scenario_index ? ARGV.fetch(scenario_index + 1) : 'accepted'
raise 'invalid test scenario' unless %w[accepted rejected transport-error expired-registration].include?(scenario)
key = OpenSSL::PKey::EC.generate('prime256v1')
id = SecureRandom.uuid
secret = SecureRandom.hex(32)
token = SecureRandom.hex(32)
packet = JSON.generate('signing' => { 'team_id' => 'TESTTEAM00', 'key_id' => 'TESTKEY000', 'signing_key_pem' => key.private_to_pem },
  'registrations' => [{ 'id' => id, 'secret' => secret, 'attributes' => {
    'session_id' => 42, 'activity_id' => SecureRandom.uuid, 'generation' => SecureRandom.uuid,
    'push_token' => token, 'token_version' => 1, 'consent_version' => 'public-lock-screen-v1', 'lease_seconds' => 60 } }])
reader, writer = IO.pipe
stdout_reader, stdout_writer = IO.pipe
stderr_reader, stderr_writer = IO.pipe
command = ['/usr/bin/env', 'python3', File.join(__dir__, 'provider_runner.py'), '--enabled', '--authorize-provider',
  '--authorize-transport', '--synthetic-transport', '--root', root, '--database', database,
  '--registration-id', id, '--input-fd', reader.fileno.to_s, '--deadline-seconds', '15', '--max-requests', '1',
  '--synthetic-scenario', scenario]
command << '--initialize-synthetic-fixture' if initialize_fixture
raise 'secret in argv' if [secret, token, key.private_to_pem].any? { |value| command.join(' ').include?(value) }
pid = Process.spawn(*command, reader.fileno => reader, out: stdout_writer, err: stderr_writer)
reader.close
stdout_writer.close
stderr_writer.close
writer.write(packet)
writer.close
begin
  status = Timeout.timeout(50) { Process.wait2(pid).last }
  output = stdout_reader.read
  error = stderr_reader.read
  raise 'secret in evidence' if [secret, token, key.private_to_pem, packet].any? { |value| (output + error).include?(value) }
  records = output.lines.filter_map { |line| JSON.parse(line) rescue nil }
  result = records.last
  expected_requests = scenario == 'expired-registration' ? 0 : 1
  acceptance_expected = scenario == 'accepted'
  outcomes = result && result['transport_outcomes']
  outcome_matches = outcomes && case scenario
    when 'accepted' then outcomes == { 'responses' => { '200' => 1 }, 'exceptions' => 0, 'accepted_responses' => 1 }
    when 'rejected' then outcomes == { 'responses' => { '400' => 1 }, 'exceptions' => 0, 'accepted_responses' => 0 }
    when 'transport-error' then outcomes == { 'responses' => {}, 'exceptions' => 1, 'accepted_responses' => 0 }
    when 'expired-registration' then outcomes == { 'responses' => {}, 'exceptions' => 0, 'accepted_responses' => 0 }
    end
  unless status.exitstatus == (acceptance_expected ? 0 : 1) && result && result['status'] == 'completed' &&
      result['execution_completed'] && result['requests'] == expected_requests && outcome_matches &&
      result['acceptance_observed'] == acceptance_expected &&
      result['acceptance'] == (acceptance_expected ? 'synthetic_only' : 'not_observed') &&
      result['fenced_receipts'] == 1 && result['cleanup_verified'] && result['no_network'] &&
      result['unresolved'] == 0 && result['retained_ciphertexts'] == 0 && result['prepared'] == 0
    # Only allowlisted child diagnostics, never raw output/schema/logs on failure.
    warn JSON.generate(status: 'failed', exit_code: status.exitstatus, result: result,
      child_fixed_errors: error.lines.filter_map { |line| JSON.parse(line) rescue nil },
      error_classes: error.scan(/\b(?:[A-Z][A-Za-z]+Error|SyntaxError|LoadError)\b/).uniq,
      error_line_numbers: error.scan(/\.rb:(\d+)/).flatten.map(&:to_i), output_bytes: output.bytesize, error_bytes: error.bytesize)
    exit 1
  end
  puts JSON.generate(status: 'passed', full_entrypoint: true, generated_test_material: true,
    no_network: true, secret_redaction: true, scenario: scenario, child_exit_code: status.exitstatus, result: result)
ensure
  stdout_reader.close
  stderr_reader.close
  packet.clear
  secret.clear
  token.clear
end
