import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Reduce memory usage during build
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Simple chunk splitting to avoid circular dependencies
        manualChunks: {
          'react': ['react', 'react-dom'],
          'ui': ['@douyinfe/semi-ui'],
          'utils': ['lodash', 'axios', 'nanoid']
        }
      }
    },
    // Optimize for memory and compatibility
    target: 'es2020',
    sourcemap: false,
    outDir: 'dist'
  }
})
