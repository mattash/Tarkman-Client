import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['ios/**', 'android/**', 'dist/**', '.expo/**', 'expo-env.d.ts']),
  js.configs.recommended,
  { files: ['**/*.{ts,tsx,mts,cts}'], extends: [tseslint.configs.recommended] },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: { ...globals.browser, __DEV__: 'readonly' } },
  },
  { files: ['*.js', 'scripts/**/*.js', 'plugins/**/*.js'], languageOptions: { globals: globals.node, sourceType: 'commonjs' }, rules: { '@typescript-eslint/no-require-imports': 'off' } },
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: globals.node } },
])
