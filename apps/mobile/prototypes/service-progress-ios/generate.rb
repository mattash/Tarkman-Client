#!/usr/bin/env ruby
# Use the existing CocoaPods xcodeproj gem; no gem installation required.
require 'xcodeproj'
require 'fileutils'
require 'uri'
Dir.chdir(__dir__)
# This affects ONLY the separate experiment. No default endpoint or activation.
remote_flag = ENV.fetch('SERVICE_PROGRESS_REMOTE_EXPERIMENT', '0')
abort 'SERVICE_PROGRESS_REMOTE_EXPERIMENT must be 0 or 1' unless ['0', '1'].include?(remote_flag)
remote_enabled = remote_flag == '1'
remote_info = { 'ServiceProgressRemoteEnabled' => remote_enabled }
{
  'SERVICE_PROGRESS_DEVELOPMENT_ORIGIN' => 'ServiceProgressDevelopmentOrigin',
  'SERVICE_PROGRESS_DEVELOPMENT_READER_ORIGIN' => 'ServiceProgressDevelopmentReaderOrigin'
}.each do |variable, key|
  origin = ENV[variable]
  abort "Missing explicit #{variable}" if remote_enabled && (origin.nil? || origin.empty?)
  next if origin.nil? || origin.empty?
  begin
    parsed = URI.parse(origin)
    valid = parsed.scheme == 'https' && parsed.host && !parsed.host.empty? &&
      parsed.userinfo.nil? && parsed.query.nil? && parsed.fragment.nil? && parsed.path.empty? &&
      (1..65535).include?(parsed.port)
  rescue URI::InvalidURIError
    valid = false
  end
  abort "Invalid bare HTTPS origin in #{variable}" unless valid
  remote_info[key] = origin
end
# A typed Boolean plist avoids treating the string "NO" as an enabled flag.
Xcodeproj::Plist.write_to_path(remote_info, 'ServiceProgressPrototype.generated.plist')
project = Xcodeproj::Project.new('ServiceProgressPrototype.xcodeproj')
project.root_object.attributes['LastUpgradeCheck'] = '1600'
project.root_object.known_regions = ['en', 'ru']
app = project.new_target(:application, 'ServiceProgressPrototype', :ios, '16.4')
widget = project.new_target(:app_extension, 'ServiceProgressLiveActivity', :ios, '16.4')
[app, widget].each do |target|
  target.build_configurations.each do |config|
    config.build_settings.merge!({
      'SWIFT_VERSION' => '5.0', 'IPHONEOS_DEPLOYMENT_TARGET' => '16.4',
      'TARGETED_DEVICE_FAMILY' => '1', 'CODE_SIGNING_ALLOWED' => 'NO',
      'GENERATE_INFOPLIST_FILE' => 'YES', 'CURRENT_PROJECT_VERSION' => '1',
      'MARKETING_VERSION' => '0.1', 'SDKROOT' => 'iphoneos',
      'SUPPORTED_PLATFORMS' => 'iphoneos iphonesimulator',
      'INFOPLIST_KEY_CFBundleDisplayName' => 'Service Progress Demo'
    })
  end
  target.add_file_references([project.main_group.new_file('Shared/ServiceAttributes.swift'),
                              project.main_group.new_file('Shared/ServiceContentState.swift'),
                              project.main_group.new_file('Shared/ServicePublicationV1.swift'),
                              project.main_group.new_file('Shared/ServicePublicationActivity.swift'),
                              project.main_group.new_file('Shared/ServicePublicationValidation.swift'),
                              project.main_group.new_file('Shared/ServicePublicationView.swift')])
  resources = project.main_group.new_variant_group('Localizable.strings')
  ['en', 'ru'].each { |lang| resources.new_file("Resources/#{lang}.lproj/Localizable.strings").name = lang }
  target.resources_build_phase.add_file_reference(resources)
end
app.add_file_references([project.main_group.new_file('App/PrototypeApp.swift'),
                         project.main_group.new_file('App/ServiceRemoteExperimentController.swift'),
                         project.main_group.new_file('App/ServiceRemoteExperimentView.swift'),
                         project.main_group.new_file('Shared/ServiceRemoteExperimentConfiguration.swift'),
                         project.main_group.new_file('Shared/ServicePublicSelection.swift'),
                         project.main_group.new_file('Shared/ServiceExperimentJournal.swift'),
                         project.main_group.new_file('Shared/ServiceExperimentKeychain.swift'),
                         project.main_group.new_file('Shared/ServiceRegistrationTransport.swift'),
                         project.main_group.new_file('Shared/ServiceRegistrationCoordinator.swift'),
                         project.main_group.new_file('Shared/ServiceRegistrationURLSessionHTTP.swift'),
                         project.main_group.new_file('Shared/ServiceActivityRegistrationBridge.swift')])
widget.add_file_references([project.main_group.new_file('Widget/ServiceActivityWidget.swift')])
app.build_configurations.each do |c|
  c.build_settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => 'app.tarkman.progressprototype',
    'INFOPLIST_FILE' => 'ServiceProgressPrototype.generated.plist',
    'INFOPLIST_KEY_NSSupportsLiveActivities' => 'YES',
    'INFOPLIST_KEY_UILaunchScreen_Generation' => 'YES',
    'INFOPLIST_KEY_UIApplicationSceneManifest_Generation' => 'YES'
  })
  c.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/RemoteExperiment.entitlements' if remote_enabled
end
widget.build_configurations.each do |c|
  c.build_settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => 'app.tarkman.progressprototype.LiveActivity',
    'GENERATE_INFOPLIST_FILE' => 'NO', 'INFOPLIST_FILE' => 'Widget/Info.plist',
    'APPLICATION_EXTENSION_API_ONLY' => 'YES', 'SKIP_INSTALL' => 'YES'
  })
end
app.add_dependency(widget)
embed = app.new_copy_files_build_phase('Embed App Extensions')
embed.dst_subfolder_spec = '13'
embed.add_file_reference(widget.product_reference).settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
tests = project.new_target(:ui_test_bundle, 'ServiceProgressUITests', :ios, '16.4')
tests.add_dependency(app)
tests.add_file_references([project.main_group.new_file('Tests/PrototypeUITests.swift'),
                           project.main_group.new_file('Tests/PhysicalObservationTests.swift')])
tests.build_configurations.each do |c|
  c.build_settings.merge!({ 'PRODUCT_BUNDLE_IDENTIFIER' => 'app.tarkman.progressprototype.UITests',
    'SWIFT_VERSION' => '5.0', 'GENERATE_INFOPLIST_FILE' => 'YES',
    'TEST_TARGET_NAME' => app.name, 'CODE_SIGNING_ALLOWED' => 'NO',
    'TARGETED_DEVICE_FAMILY' => '1' })
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.set_launch_target(app)
scheme.add_test_target(tests)
scheme.save_as(project.path, 'ServiceProgressPrototype', true)
puts 'Generated isolated ServiceProgressPrototype.xcodeproj'
