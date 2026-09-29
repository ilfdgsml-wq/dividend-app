import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'supabase/functions']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
  },
  {
    // ゲームロジックはサーバー（Edge Function）でも動かすため、ブラウザAPI・乱数・時刻・UIへの依存を禁止する
    files: ['src/logic/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'fetch'],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: '乱数は引数の rng を使うこと' },
        { object: 'Date', property: 'now', message: '時刻に依存しないこと' },
      ],
      'no-restricted-imports': ['error', { patterns: ['react', 'react-dom', '**/ui/**'] }],
    },
  },
])
