import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The Express backend (see ../backend/src/server.js) runs on port 3001.
      '/api': 'http://localhost:3001',
    },
  },
})
