import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import copyPlugin from 'rollup-plugin-copy'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      // 启用 Vue 的 HMR
      reactivityTransform: false,
    }),
    visualizer({
      open: false,
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    port: 5173, // 开发服务器端口
    strictPort: false, // 如果端口被占用，自动尝试下一个端口
    // 启用 HMR（不指定端口，让 Vite 自动处理）
    hmr: {
      overlay: true, // 显示错误覆盖层
    },
    // 监听文件变化
    watch: {
      usePolling: false, // 在 Windows 上可能需要设置为 true
      interval: 100, // 轮询间隔（仅在 usePolling 为 true 时有效）
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'], // 忽略的文件
      // 确保监听 Vue 文件变化
      include: ['**/*.vue', '**/*.ts', '**/*.js'],
    },
    // 文件系统权限
    fs: {
      // 允许访问的目录
      allow: ['..'],
      strict: false, // 非严格模式，允许访问项目外的文件
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      plugins: [
        copyPlugin({
          targets: [
            { src: 'lib/**/*', dest: 'dist/lib' },
            { src: 'public/overlap_wasm_bg.wasm', dest: 'dist' },
            { src: 'public/overlap_wasm.js', dest: 'dist' }
          ],
          hook: 'writeBundle',
        }),
      ]
    },
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: false,
    terserOptions: {
      compress: {
        drop_console: false
      }
    }
  },
  define: {
    Module: {}
  },
  optimizeDeps: {
    exclude: ['overlap_wasm']
  }
})
