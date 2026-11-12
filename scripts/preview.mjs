import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = {
  '/icon.png': ['dist/icon.png', 'image/png'],
  '/studio.js': ['dist/studio.js', 'text/javascript'],
  '/studio.css': ['dist/studio.css', 'text/css'],
  '/mono.woff2': ['dist/mono.woff2', 'font/woff2'],
};
createServer(async (req, res) => {
  try {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self';",
      );
      res.end(
        '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/studio.css"><title>Snapglow Studio</title></head><body><div id="app"></div><script src="/studio.js"></script></body></html>',
      );
      return;
    }
    const entry = files[req.url];
    if (!entry) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Content-Type', entry[1]);
    res.end(await readFile(entry[0]));
  } catch {
    res.writeHead(500).end('Preview assets unavailable. Run npm run build.');
  }
}).listen(4173, '0.0.0.0', () =>
  console.log('Snapglow preview ready at http://localhost:4173'),
);
