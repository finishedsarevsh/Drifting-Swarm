import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { exec } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'simulation-runner',
      configureServer(server) {
        server.middlewares.use('/api/rerun-simulation', (req, res) => {
          if (req.method === 'POST') {
            const projectDir = path.resolve(__dirname, '..')
            exec(
              'docker compose restart node-ca node-tx node-oh node-wy node-ny node-nj',
              { cwd: projectDir },
              (err) => {
                if (err) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ ok: false, error: err.message }))
                  return
                }
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: true, message: 'Swarm simulation batch restarted successfully' }))
              }
            )
          } else {
            res.statusCode = 405
            res.end('Method Not Allowed')
          }
        })
      },
    },
  ],
  server: {
    port: 3001,
    proxy: {
      '/api/prometheus': {
        target: 'http://localhost:9090',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/prometheus/, ''),
      },
      '/api/ledger': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/ledger/, ''),
      },
    },
  },
})

