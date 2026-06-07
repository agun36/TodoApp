import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Dev proxy always targets local backend unless VITE_API_PROXY_TARGET is set.
  // VITE_API_URL is for production builds only (see src/api/client.ts).
  const apiTarget =
    env.VITE_API_PROXY_TARGET ||
    (mode === 'development' ? 'http://localhost:3000' : env.VITE_API_URL || 'http://localhost:3000')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
