import { defineConfig, loadEnv, type PluginOption, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'

function readBody(req: IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function honoApi(): PluginOption {
  const plugin = {
    name: 'hono-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) return next()
        const { app } = await server.ssrLoadModule('/api/app.ts')
        const url = `http://${req.headers.host}${req.url}`
        const headers = new Headers()
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v === 'string') headers.set(k, v)
          else if (Array.isArray(v)) v.forEach((item) => headers.append(k, item))
        }
        const method = req.method || 'GET'
        const raw = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req)
        const request = new Request(url, { method, headers, body: raw })
        const response: Response = await app.fetch(request)
        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        const buf = Buffer.from(await response.arrayBuffer())
        res.end(buf)
      })
    },
  }
  return plugin as unknown as PluginOption
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (env.VITE_SUPABASE_URL) process.env.SUPABASE_URL ??= env.VITE_SUPABASE_URL
  if (env.VITE_SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY ??= env.VITE_SUPABASE_ANON_KEY
  for (const [k, v] of Object.entries(env)) {
    if (!k.startsWith('VITE_')) process.env[k] = v
  }
  return {
    plugins: [
      react(),
      honoApi(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'EcoBrain AI',
          short_name: 'EcoBrain',
          description: 'AI-assisted waste collection',
          theme_color: '#07090A',
          background_color: '#07090A',
          display: 'standalone',
          start_url: '/worker',
          icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@shared': path.resolve(__dirname, 'shared'),
      },
    },
  }
})
