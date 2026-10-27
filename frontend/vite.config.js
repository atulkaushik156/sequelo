import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  // NEW: Disable source maps for production to hide original code
  build: {
    sourcemap: false, 
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/upload_documents': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})