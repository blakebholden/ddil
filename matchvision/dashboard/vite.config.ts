import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3100,
    proxy: {
      '/api': {
        target: 'http://192.168.1.20:8010',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/stream': {
        target: 'http://192.168.1.20:8010',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://192.168.1.20:8010',
        ws: true,
      },
    },
  },
})
