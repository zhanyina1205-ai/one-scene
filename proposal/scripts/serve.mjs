import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const file = resolve(fileURLToPath(new URL('../dist/index.html', import.meta.url)))
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname
  if (!['/', '/index.html', '/favicon.ico'].includes(path)) { response.writeHead(404); response.end('Not found'); return }
  if (path === '/favicon.ico') { response.writeHead(204); response.end(); return }
  try {
    const html = await readFile(file)
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end(request.method === 'HEAD' ? undefined : html)
  } catch { response.writeHead(503); response.end('Run npm run build first') }
})
server.listen(5190, '127.0.0.1', () => console.log('Proposal preview: http://127.0.0.1:5190/'))
