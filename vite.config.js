import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/hungr/', // CRITICAL: Sets the base path for deployment
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/hungr/api': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  }
})
