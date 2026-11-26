import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 监听 0.0.0.0，容器外才能通过宿主机端口访问到开发服务器。
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
    },
  },
})
