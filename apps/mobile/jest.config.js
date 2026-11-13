module.exports = {
  watchman: false,
  preset: 'jest-expo',
  resolver: '<rootDir>/scripts/jest-resolver.js',
  // FlashList 2.3 ships ESM; keep Expo's exclusions and transform it as well.
  transformIgnorePatterns: require('jest-expo/jest-preset').transformIgnorePatterns.map(pattern =>
    pattern.replace('(.pnpm|', '(.pnpm|@shopify/flash-list|@sentry/|')),
  testMatch: ['<rootDir>/tests/**/*.test.[jt]s?(x)'],
  // RNGH's jestSetup stubs its native gesture modules so swipeables render outside a device runtime.
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
}
