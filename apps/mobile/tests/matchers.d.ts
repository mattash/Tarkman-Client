import type { JestNativeMatchers } from '@testing-library/react-native/matchers'

// Jest 30 exports Matchers from `expect`; RNTL 14 augments the older re-export.
declare module 'expect' {
  // Declaration merging must preserve Jest's complete generic signature.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Matchers<R extends void | Promise<void>, T = unknown> extends JestNativeMatchers<R> {}
}
