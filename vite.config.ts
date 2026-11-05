import { fileURLToPath, URL } from 'node:url'
import { existsSync, readdirSync, unlinkSync } from 'node:fs'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import copyPlugin from 'rollup-plugin-copy'
import { visualizer } from 'rollup-plugin-visualizer'

/**
 * 删除 rollup 静态分析 onnxruntime-web 死代码 (webgpu jsep 路径) 时多余发出的 jsep wasm (~29MB)。
 * 运行时 (numThreads=1, wasm EP) 不会请求这些文件。
 */
function cleanupOrtDeadAssets() {
  return {
    name: 'cleanup-ort-dead-assets',
    writeBundle() {
      const assetsDir = 'dist/assets'
      if (!existsSync(assetsDir)) return
      for (const f of readdirSync(assetsDir)) {
        if (f.startsWith('ort-wasm-simd-threaded.jsep')) {
          unlinkSync(`${assetsDir}/${f}`)
        }
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      // 启用 Vue 的 HMR
      reactivityTransform: false,
    }),
    visualizer({
      open: false,
    }),
    cleanupOrtDeadAssets(),
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
            { src: 'public/overlap_wasm.js', dest: 'dist' },
            // onnxruntime-web 胶水与 wasm: 运行时按 chunk 相对路径 (dist/assets/) 解析
            { src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', dest: 'dist/assets' },
            { src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', dest: 'dist/assets' }
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
    exclude: ['overlap_wasm', 'onnxruntime-web']
  }
})
