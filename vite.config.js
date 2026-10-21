import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  base: '/',
  build: { manifest: !isSsrBuild },
  server: {
    host: '127.0.0.1',
  },
  plugins: [react()],
}))
