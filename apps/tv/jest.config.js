module.exports = {
  watchman: false,
  preset: 'jest-expo/ios',
  resolver: '<rootDir>/scripts/jest-resolver.js',
  testMatch: ['<rootDir>/tests/**/*.test.[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
}
