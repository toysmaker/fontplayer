import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// https://vitest.dev/config/
export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**', // 排除E2E测试（由Playwright运行）
      '**/*.spec.ts', // 排除Playwright测试文件
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
        '**/build/**',
        'src-tauri/**',
        'scripts/**',
      ],
      include: [
        'src/**/*.ts',
        'src/**/*.vue',
      ],
      // 渐进门禁：随覆盖率提升可提高阈值，目标 100%（见 tests/COVERAGE_BASELINE.md）
      thresholds: {
        lines: 15,
        branches: 8,
        functions: 12,
        statements: 15,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
