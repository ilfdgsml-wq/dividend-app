// Supabase Edge Function「game」を作る設定（npm run build:edge）。
// サーバー処理とゲームロジックを supabase/functions/game/index.ts の1ファイルにまとめる。
// Supabase のライブラリだけは Deno の npm: 指定で読み込む（バージョンは package.json と合わせる）。
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const supabaseVersion = JSON.parse(readFileSync('node_modules/@supabase/supabase-js/package.json', 'utf8')).version

export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'server/edge.ts',
    outDir: 'supabase/functions/game',
    emptyOutDir: false,
    target: 'es2022',
    minify: true,
    rollupOptions: {
      external: ['@supabase/supabase-js'],
      output: {
        format: 'es',
        entryFileNames: 'index.ts',
        paths: { '@supabase/supabase-js': `npm:@supabase/supabase-js@${supabaseVersion}` },
        banner: '// @ts-nocheck\n// このファイルは npm run build:edge で自動生成されます。直接編集しないでください。',
      },
    },
  },
  ssr: { noExternal: true },
})
