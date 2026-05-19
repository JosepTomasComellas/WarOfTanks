const dgram = require('dgram');
const http  = require('http');
const WebSocket = require('ws');
const fs   = require('fs');
const path = require('path');

const SERVER_IP = process.env.SERVER_IP || 'localhost';
const UDP_PORT  = parseInt(process.env.UDP_PORT  || '8888', 10);
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '8080', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
};

const PUBLIC_DIR = path.join(__dirname, 'public');

// Inject SERVER_IP into index.html so the client JS can read it
function serveIndex(res) {
  let html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  // Replace placeholder comment with actual config
  html = html.replace(
    '/* __SERVER_CONFIG__ */',
    `window.WOT_SERVER_IP = ${JSON.stringify(SERVER_IP)};`
  );
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

const httpServer = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '/index.html') { serveIndex(res); return; }

  const filePath = path.join(PUBLIC_DIR, urlPath);
  // Security: prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end(); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

// WebSocket server shares the same HTTP server (upgrades on ws:// connect)
const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws) => {
  const udp = dgram.createSocket('udp4');
  let ready = false;

  udp.bind(0, () => { ready = true; });

  // Browser → UDP server
  ws.on('message', (data, isBinary) => {
    if (!ready || ws.readyState !== WebSocket.OPEN) return;
    const buf = isBinary ? data : Buffer.from(data);
    udp.send(buf, 0, buf.length, UDP_PORT, SERVER_IP, (err) => {
      if (err) console.error('[Proxy] UDP send error:', err.message);
    });
  });

  // UDP server → Browser
  udp.on('message', (msg) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });

  udp.on('error', (err) => console.error('[Proxy] UDP error:', err.message));

  ws.on('close', () => udp.close());
  ws.on('error', (err) => { console.error('[Proxy] WS error:', err.message); udp.close(); });
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`[Proxy] HTTP+WS on port ${HTTP_PORT}  →  UDP ${SERVER_IP}:${UDP_PORT}`);
  console.log(`[Proxy] Open browser at http://localhost:${HTTP_PORT}`);
});
