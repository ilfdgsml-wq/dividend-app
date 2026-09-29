/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mockOnlinePlugin } from './server/mockPlugin.ts'

// vite --mode mock：オンライン対戦を Supabase なしで試せる模擬サーバーを開発サーバー内で動かす
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'mock' ? [mockOnlinePlugin()] : [])],
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
}))
