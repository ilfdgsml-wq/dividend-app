// Vercel の関数 api/game.js を作る設定（npm run build:api）。
// サーバーのコードとゲームロジック・Supabase のライブラリを1ファイルにまとめ、Vercel 側でのビルドに頼らない。
import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'server/vercel.ts',
    outDir: 'api',
    emptyOutDir: false,
    target: 'node20',
    minify: true,
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: 'game.js',
        banner: '// このファイルは npm run build:api で自動生成されます。直接編集しないでください。',
      },
    },
  },
  ssr: { noExternal: true, target: 'node' },
})
