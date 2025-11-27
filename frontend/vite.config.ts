import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Story 4.10 AC#5: Bundle analyzer for visualizing chunk sizes
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Story 4.10 AC#8: Code splitting and manual chunking for vendor optimization
    rollupOptions: {
      output: {
        manualChunks: {
          // React core libraries
          'vendor-react': ['react', 'react-dom'],
          // Terminal libraries (large dependency)
          'vendor-terminal': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
          // Markdown and syntax highlighting (lazy loaded, but optimize when loaded)
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-highlight'],
          // UI component libraries
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-tabs',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-radio-group'
          ]
        }
      }
    },
    // Report compressed sizes
    reportCompressedSize: true,
    // Set chunk size warning limit (500KB gzipped target)
    chunkSizeWarningLimit: 500
  }
})
