import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '..', 'dist');
const rpcTarget = process.env.ENERGYFI_WEB_RPC_TARGET ?? 'https://subnets.avax.network/efy/testnet/rpc';
const host = process.env.HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.PORT ?? '8090', 10);

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.map', 'application/json; charset=utf-8'],
]);

function resolveStaticPath(requestPath) {
  const pathname = decodeURIComponent(requestPath.split('?')[0] ?? '/');
  const normalized = pathname === '/' ? '/index.html' : pathname;
  const directPath = path.join(distDir, normalized);

  if (existsSync(directPath) && statSync(directPath).isFile()) {
    return directPath;
  }

  const htmlPath = path.join(distDir, `${normalized}.html`);
  if (existsSync(htmlPath)) {
    return htmlPath;
  }

  const indexPath = path.join(distDir, normalized, 'index.html');
  if (existsSync(indexPath)) {
    return indexPath;
  }

  return path.join(distDir, 'index.html');
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

const server = createServer(async (req, res) => {
  try {
    if (!req.url) {
      res.writeHead(400);
      res.end('Missing URL');
      return;
    }

    if (req.url.startsWith('/rpc')) {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method Not Allowed');
        return;
      }

      const body = await readBody(req);
      const upstream = await fetch(rpcTarget, {
        method: 'POST',
        headers: {
          'Content-Type': req.headers['content-type'] ?? 'application/json',
        },
        body,
      });

      const responseBody = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(responseBody);
      return;
    }

    const filePath = resolveStaticPath(req.url);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': contentTypes.get(ext) ?? 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
    });
    createReadStream(filePath).pipe(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (req?.url?.startsWith('/rpc')) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Upstream RPC request failed', detail: message }));
      return;
    }

    const fallback = path.join(distDir, 'index.html');
    if (existsSync(fallback)) {
      const html = await readFile(fallback);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
      return;
    }

    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(message);
  }
});

server.listen(port, host, () => {
  console.log(`Demo web server listening on http://${host}:${port}`);
  console.log(`RPC proxy target: ${rpcTarget}`);
});
