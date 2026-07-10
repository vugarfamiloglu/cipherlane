import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dashboard runs on 7821 in dev and proxies the API + telemetry socket to
// the Go control plane on 7820, so cookies and WebSockets are same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 7821,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:7820', changeOrigin: true },
      '/ws': { target: 'http://127.0.0.1:7820', ws: true, changeOrigin: true },
    },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
})
