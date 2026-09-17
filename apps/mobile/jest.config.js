module.exports = {
  watchman: false,
  preset: 'jest-expo',
  resolver: '<rootDir>/scripts/jest-resolver.js',
  testMatch: ['<rootDir>/tests/**/*.test.[jt]s?(x)'],
  // RNGH's jestSetup stubs its native gesture modules so swipeables render outside a device runtime.
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
}
