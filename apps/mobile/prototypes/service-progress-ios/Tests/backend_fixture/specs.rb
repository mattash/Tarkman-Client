# frozen_string_literal: true
require 'bundler/setup'
require 'json'
root = File.realpath(ARGV.fetch(0))
database = ARGV.fetch(1)
port = ARGV.fetch(2)
mode = ARGV.fetch(3)
raise 'dedicated test database required' unless database.match?(/\Asp277_[a-z0-9_]+_test\z/)
raise 'invalid test mode' unless %w[ordinary negative].include?(mode)
require File.join(root, 'src/config/environment')
connection = ActiveRecord::Base.connection
facts = connection.select_one("SELECT current_database() AS db, current_setting('data_directory') AS dir, current_setting('unix_socket_directories') AS socket, current_setting('port') AS port, current_setting('listen_addresses') AS listen")
raise 'test database mismatch' unless facts['db'] == database && facts['port'] == port && facts['listen'] == '' &&
  File.realpath(facts.fetch('dir')) == File.realpath(File.join(root, 'pg')) &&
  File.realpath(facts.fetch('socket')) == File.realpath(File.join(root, 'socket'))
if connection.tables.empty?
  Rails.application.load_tasks
  Rake::Task['db:schema:load'].invoke
  Rake::Task['db:migrate'].invoke
end
require 'rspec/core'
paths = mode == 'negative' ? ['spec/services/service_progress/revocation_spec.rb'] :
  ['spec/services/service_progress', 'spec/requests/service_activity_registrations_spec.rb']
exit RSpec::Core::Runner.run(paths + ['--seed', '22189'])
