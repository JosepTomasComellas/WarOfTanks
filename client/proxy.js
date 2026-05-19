const dgram     = require('dgram');
const http      = require('http');
const https     = require('https');
const WebSocket = require('ws');
const fs        = require('fs');
const path      = require('path');
const bridge    = require('../state-bridge');

const SERVER_IP     = process.env.SERVER_IP     || 'localhost';
const UDP_PORT      = parseInt(process.env.UDP_PORT  || '8888', 10);
const HTTP_PORT     = parseInt(process.env.HTTP_PORT || '8888', 10);
const HTTPS_ENABLED = process.env.HTTPS_ENABLED === 'true';
const SSL_CERT      = process.env.SSL_CERT || '/certs/cert.pem';
const SSL_KEY       = process.env.SSL_KEY  || '/certs/key.pem';
const MAX_TABS      = parseInt(process.env.MAX_TABS  || '1',  10); // 0 = unlimited
const LOGO_URL      = process.env.LOGO_URL || '';

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

// ── Server config (fetched once from the game server in client mode) ────────

let _serverConfigCache = null;

function getServerConfig() {
  if (_serverConfigCache !== null) return Promise.resolve(_serverConfigCache);

  // Server mode: read from own env vars
  if (bridge.gameServer) {
    _serverConfigCache = { maxTabsPerClient: MAX_TABS, logoUrl: LOGO_URL || null };
    return Promise.resolve(_serverConfigCache);
  }

  // Client mode: fetch from the game server's HTTP endpoint (prova http, si falla intenta https)
  const fallback = { maxTabsPerClient: 1, logoUrl: null };

  function tryFetch(mod, scheme) {
    return new Promise((resolve, reject) => {
      const opts = { timeout: 3000 };
      if (scheme === 'https') opts.rejectUnauthorized = false; // accepta certs corporatius/autofirmats
      const req = mod.get(`${scheme}://${SERVER_IP}:${UDP_PORT}/api/config`, opts, res => {
        let body = '';
        res.on('data', d => { body += d; });
        res.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('json')); } });
      });
      req.on('error',   reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
  }

  return tryFetch(http, 'http')
    .catch(() => tryFetch(https, 'https'))
    .then(cfg  => { _serverConfigCache = cfg;      return cfg;      })
    .catch(()  => { _serverConfigCache = fallback; return fallback; });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function injectConfig(res) {
  let html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  html = html.replace(
    '/* __SERVER_CONFIG__ */',
    `window.WOT_SERVER_IP = ${JSON.stringify(SERVER_IP)};`
  );
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function jsonReply(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => resolve(body));
  });
}

// ── Admin API ──────────────────────────────────────────────────────────────

function handleAdmin(req, res, urlPath) {
  const gs = bridge.gameServer;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST' });
    res.end();
    return;
  }

  if (urlPath === '/api/admin/state' && req.method === 'GET') {
    if (!gs) return jsonReply(res, 503, { error: 'Not a server instance' });
    return jsonReply(res, 200, gs.state.adminSnapshot());
  }

  if (urlPath === '/api/admin/newround' && req.method === 'POST') {
    if (!gs) return jsonReply(res, 503, { error: 'Not a server instance' });
    gs.state.newRound();
    const { buildPlayerList } = require('../server/protocol');
    gs._broadcast(buildPlayerList(gs.state.tanks));
    console.log('[Admin] New round forced');
    return jsonReply(res, 200, { ok: true });
  }

  if (urlPath === '/api/admin/resetscores' && req.method === 'POST') {
    if (!gs) return jsonReply(res, 503, { error: 'Not a server instance' });
    gs.state.resetScores();
    console.log('[Admin] Scores reset');
    return jsonReply(res, 200, { ok: true });
  }

  if (urlPath === '/api/admin/endgame' && req.method === 'POST') {
    if (!gs) return jsonReply(res, 503, { error: 'Not a server instance' });
    const { buildEvent, EventType } = require('../server/protocol');
    gs._broadcast(buildEvent(EventType.GAME_OVER, 0, 0, 0));
    gs.state.tanks.clear();
    gs.clients.clear();
    for (const wsClient of wss.clients) wsClient.close();
    console.log('[Admin] Game ended — all players disconnected');
    return jsonReply(res, 200, { ok: true });
  }

  if (urlPath === '/api/admin/kick' && req.method === 'POST') {
    if (!gs) return jsonReply(res, 503, { error: 'Not a server instance' });
    readBody(req).then(body => {
      try {
        const { id } = JSON.parse(body);
        if (id) {
          gs.state.removePlayer(Number(id));
          for (const [key, c] of gs.clients.entries()) {
            if (c.playerId === Number(id)) { gs.clients.delete(key); break; }
          }
          const { buildPlayerList } = require('../server/protocol');
          gs._broadcast(buildPlayerList(gs.state.tanks));
          console.log(`[Admin] Kicked player ${id}`);
          jsonReply(res, 200, { ok: true });
        } else {
          jsonReply(res, 400, { error: 'Missing id' });
        }
      } catch { jsonReply(res, 400, { error: 'Bad JSON' }); }
    });
    return;
  }

  jsonReply(res, 404, { error: 'Unknown admin endpoint' });
}

// ── HTTP / HTTPS server ────────────────────────────────────────────────────

function createServer(handler) {
  if (!HTTPS_ENABLED) return http.createServer(handler);
  try {
    const opts = {
      cert: fs.readFileSync(SSL_CERT),
      key:  fs.readFileSync(SSL_KEY),
    };
    console.log(`[Proxy] HTTPS activat (cert: ${SSL_CERT})`);
    return https.createServer(opts, handler);
  } catch (err) {
    console.error(`[Proxy] Error carregant certificats SSL: ${err.message}`);
    console.error('[Proxy] Revertint a HTTP sense xifrat');
    return http.createServer(handler);
  }
}

const httpServer = createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // Server config (read by browser clients on connect)
  if (urlPath === '/api/config') {
    getServerConfig().then(cfg => jsonReply(res, 200, cfg));
    return;
  }

  // Admin API
  if (urlPath.startsWith('/api/admin')) {
    handleAdmin(req, res, urlPath);
    return;
  }

  // Static files
  if (urlPath === '/' || urlPath === '/index.html') { injectConfig(res); return; }

  const filePath = path.join(PUBLIC_DIR, urlPath);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end(); return; }
  serveFile(filePath, res);
});

// ── WebSocket proxy (browser ↔ UDP server) ─────────────────────────────────

const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', async (ws) => {
  // Enforce max concurrent connections per proxy (configurable from server)
  const cfg = await getServerConfig().catch(() => ({ maxTabsPerClient: 1 }));
  const maxTabs = cfg.maxTabsPerClient ?? 1;
  if (maxTabs > 0 && wss.clients.size > maxTabs) {
    ws.close(4001, 'Too many connections');
    return;
  }

  const udp = dgram.createSocket('udp4');
  let ready = false;

  udp.bind(0, () => { ready = true; });

  ws.on('message', (data, isBinary) => {
    if (!ready || ws.readyState !== WebSocket.OPEN) return;
    const buf = isBinary ? data : Buffer.from(data);
    udp.send(buf, 0, buf.length, UDP_PORT, SERVER_IP, (err) => {
      if (err) console.error('[Proxy] UDP send error:', err.message);
    });
  });

  udp.on('message', (msg) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(msg);
    // Si el servidor envia GAME_OVER (EVENT 0x14 + tipus 4), tanca la WS com a mesura de seguretat
    // perquè el client torni al login fins i tot si el navegador no processa l'event a temps
    if (msg.length >= 2 && msg[0] === 0x14 && msg[1] === 4) {
      setTimeout(() => { if (ws.readyState === WebSocket.OPEN) ws.close(4002, 'Game over'); }, 300);
    }
  });

  udp.on('error', (err) => console.error('[Proxy] UDP error:', err.message));
  ws.on('close', () => udp.close());
  ws.on('error', (err) => { console.error('[Proxy] WS error:', err.message); udp.close(); });
});

httpServer.listen(HTTP_PORT, () => {
  const proto = HTTPS_ENABLED ? 'https' : 'http';
  const ws    = HTTPS_ENABLED ? 'wss'   : 'ws';
  console.log(`[Proxy] ${proto.toUpperCase()}+${ws.toUpperCase()} on port ${HTTP_PORT}  →  UDP ${SERVER_IP}:${UDP_PORT}`);
  console.log(`[Proxy] Open browser at ${proto}://localhost:${HTTP_PORT}`);
  if (bridge.gameServer) {
    console.log(`[Proxy] Admin panel at ${proto}://localhost:${HTTP_PORT}/admin.html`);
  }
});
