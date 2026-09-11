module.exports = {
  watchman: false,
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
}
