import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxy = {
  '/api': {
    target: 'http://localhost:5001',
    changeOrigin: true,
    secure: false,
  },
  '/uploads': {
    target: 'http://localhost:5001',
    changeOrigin: true,
    secure: false,
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy,
  },
  preview: {
    port: 3000,
    proxy,
  }
})
