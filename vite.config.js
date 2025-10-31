import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      // Enable React 18 concurrent features
      jsxRuntime: 'automatic',
      // Enable fast refresh for better development experience
      fastRefresh: true
    })
  ],
  server: {
    port: 3000,
    open: true,
    // Enable HMR for better development experience
    hmr: {
      overlay: true
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    // Enable modern build targets for better performance
    target: 'esnext',
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          'react-vendor': ['react', 'react-dom'],
          // Router
          'router': ['react-router-dom'],
          // UI libraries
          'ui': ['lucide-react', 'clsx'],
          // Date utilities
          'date': ['date-fns'],
          // AWS SDK
          'aws': ['aws-sdk']
        },
        // Optimize asset naming for better caching
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    },
    // Enable compression
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      }
    }
  },
  // Enable modern ES features
  esbuild: {
    target: 'esnext',
    format: 'esm'
  },
  base: '/',
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
      'clsx',
      'date-fns'
    ],
    exclude: ['aws-sdk']
  }
})
