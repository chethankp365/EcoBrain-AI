import type { IncomingMessage, ServerResponse } from 'node:http'
import { app } from './app'

function readBody(req: IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export const config = { api: { bodyParser: false }, maxDuration: 60 }

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) value.forEach((item) => headers.append(key, item))
  }

  const method = req.method || 'GET'
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req)
  const forwardedProto = req.headers['x-forwarded-proto']
  const protocol = typeof forwardedProto === 'string' ? forwardedProto.split(',')[0] : 'https'
  const host = req.headers.host || 'localhost'
  const request = new Request(new URL(req.url || '/', `${protocol}://${host}`), { method, headers, body })
  const response = await app.fetch(request)

  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(Buffer.from(await response.arrayBuffer()))
}
