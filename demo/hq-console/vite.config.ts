import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'

// The HQ console runs on a separate "command" device and proxies /api to the
// DDIL kit's backend (which orchestrates the ECH cluster via /api/ccs/*).
export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    port: 5180,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
})
