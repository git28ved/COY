import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API = process.env.API_URL ?? 'http://localhost:4000'

// In development the React app (port 5173) forwards API calls to Express (port 4000),
// so the browser only ever talks to one origin and the paths match the spec exactly.
// Only exact API paths are proxied; tabs use ?tab=, never paths, so nothing collides.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/feed': API,
      '/swipe': API,
      '/matches': API,
      '/health': API,
    },
  },
})
