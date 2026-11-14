#!/usr/bin/env ruby
# Use the existing CocoaPods xcodeproj gem; no gem installation required.
require 'xcodeproj'
require 'fileutils'
Dir.chdir(__dir__)
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
  target.add_file_references([project.main_group.new_file('Shared/ServiceAttributes.swift')])
  resources = project.main_group.new_variant_group('Localizable.strings')
  ['en', 'ru'].each { |lang| resources.new_file("Resources/#{lang}.lproj/Localizable.strings").name = lang }
  target.resources_build_phase.add_file_reference(resources)
end
app.add_file_references([project.main_group.new_file('App/PrototypeApp.swift')])
widget.add_file_references([project.main_group.new_file('Widget/ServiceActivityWidget.swift')])
app.build_configurations.each do |c|
  c.build_settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => 'app.tarkman.progressprototype',
    'INFOPLIST_KEY_NSSupportsLiveActivities' => 'YES',
    'INFOPLIST_KEY_UILaunchScreen_Generation' => 'YES',
    'INFOPLIST_KEY_UIApplicationSceneManifest_Generation' => 'YES'
  })
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
tests.add_file_references([project.main_group.new_file('Tests/PrototypeUITests.swift')])
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
