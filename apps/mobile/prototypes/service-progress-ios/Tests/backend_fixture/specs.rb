# frozen_string_literal: true
require 'bundler/setup'
require 'json'
def validate_owned_pg!(root)
  [root, File.join(root, 'pg'), File.join(root, 'socket')].each do |path|
    info = File.lstat(path)
    raise 'private canonical owned directory required' unless info.directory? && !info.symlink? &&
      info.uid == Process.uid && (info.mode & 0o077).zero? && File.realpath(path) == path
  end
  marker = File.lstat(File.join(root, 'pg', 'PG_VERSION'))
  raise 'owned PostgreSQL marker required' unless marker.file? && !marker.symlink? && marker.uid == Process.uid
end

root = File.expand_path(ARGV.fetch(0))
validate_owned_pg!(root) # Before Rails can load initializers or open a connection.
database = ARGV.fetch(1)
port = ARGV.fetch(2)
mode = ARGV.fetch(3)
raise 'dedicated test database required' unless database.match?(/\Asp277_[a-z0-9_]+_test\z/)
raise 'invalid test mode' unless %w[prepare ordinary negative].include?(mode)
require File.join(root, 'src/config/environment')
validate_owned_pg!(root)
connection = ActiveRecord::Base.connection
facts = connection.select_one("SELECT current_database() AS db, current_setting('data_directory') AS dir, current_setting('unix_socket_directories') AS socket, current_setting('port') AS port, current_setting('listen_addresses') AS listen")
raise 'test database mismatch' unless facts['db'] == database && facts['port'] == port && facts['listen'] == '' &&
  File.realpath(facts.fetch('dir')) == File.join(root, 'pg') &&
  File.realpath(facts.fetch('socket')) == File.join(root, 'socket')
if mode == 'prepare'
  initialized = connection.tables.empty?
  if initialized
    Rails.application.load_tasks
    Rake::Task['db:schema:load'].invoke
    Rake::Task['db:migrate'].invoke
  end
  puts JSON.generate(event: 'test_schema_prepared', database:, initialized:, separate_spec_process: true)
  ActiveRecord::Base.connection_pool.disconnect!
  exit 0
end
raise 'test schema must be prepared in a separate process' if connection.tables.empty?
# No schema tasks in the process holding RSpec described_class/mock references:
# a first-request reload after task setup otherwise leaves detached namespaces.
require 'rspec/core'
paths = mode == 'negative' ? ['spec/services/service_progress/revocation_spec.rb'] :
  ['spec/services/service_progress', 'spec/requests/service_activity_registrations_spec.rb']
exit RSpec::Core::Runner.run(paths + ['--seed', '22189'])
