import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['ios/**', 'android/**', 'dist/**', 'dist-*/**', '.expo/**', 'expo-env.d.ts']),
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [tseslint.configs.recommended],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: {
      globals: { ...globals.browser, __DEV__: 'readonly' },
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: "JSXAttribute[name.name='style'] > JSXExpressionContainer > :matches(ArrowFunctionExpression, FunctionExpression)",
        message: "NativeWind's native runtime replaces function-valued style props with {}. Pass a style object and track pressed state with onPressIn/onPressOut.",
      }],
    },
  },
  {
    files: ['*.config.{js,cjs,mjs,ts}', 'scripts/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
])
