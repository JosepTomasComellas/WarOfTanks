'use strict';

// Retro CGA-inspired palette
const TANK_COLORS = [
  '#00ff41', // 0 – matrix green (local player)
  '#ff4444', // 1
  '#4488ff', // 2
  '#ffdd00', // 3
  '#ff44ff', // 4
  '#44ffff', // 5
  '#ff8800', // 6
  '#88ff44', // 7
];

const TS = 16; // tile size in pixels

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    canvas.width  = 800;
    canvas.height = 600;

    this.camX = 0;
    this.camY = 0;
    this.myId = null;

    this._explosions  = []; // { x, y, age, duration }
    this._roundMsg    = null; // { text, age, duration }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  addExplosion(x, y) {
    this._explosions.push({ x, y, age: 0, duration: 0.6 });
  }

  showRoundMessage(text) {
    this._roundMsg = { text, age: 0, duration: 3.5 };
  }

  update(dt) {
    this._explosions = this._explosions.filter(e => { e.age += dt; return e.age < e.duration; });
    if (this._roundMsg) {
      this._roundMsg.age += dt;
      if (this._roundMsg.age >= this._roundMsg.duration) this._roundMsg = null;
    }
  }

  centerOn(x, y) {
    this.camX = Math.round(x * TS - this.canvas.width  / 2);
    this.camY = Math.round(y * TS - this.canvas.height / 2);
  }

  render(gs, myId, players, ping) {
    this.myId = myId;
    const { ctx, canvas } = this;

    // Clear
    ctx.fillStyle = '#050d05';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!gs.map) return;

    this._drawMap(gs.map);
    this._drawBullets(gs.bullets);
    this._drawTanks(gs.tanks, myId);
    this._drawExplosions();
    this._drawScanlines();
    this._drawHUD(gs.tanks, myId, players, ping);
    if (this._roundMsg) this._drawRoundMessage();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _drawMap(map) {
    const { ctx } = this;
    const startTX = Math.max(0, Math.floor(this.camX / TS));
    const startTY = Math.max(0, Math.floor(this.camY / TS));
    const endTX   = Math.min(map.width,  Math.ceil((this.camX + this.canvas.width)  / TS));
    const endTY   = Math.min(map.height, Math.ceil((this.camY + this.canvas.height) / TS));

    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        const sx = tx * TS - this.camX;
        const sy = ty * TS - this.camY;
        const tile = map.tiles[ty * map.width + tx];

        if (tile === 1) {
          // Wall base
          ctx.fillStyle = '#3a2214';
          ctx.fillRect(sx, sy, TS, TS);
          // Top/left bevel (lighter)
          ctx.fillStyle = '#5c3620';
          ctx.fillRect(sx,      sy,      TS, 2);
          ctx.fillRect(sx,      sy,      2, TS);
          // Bottom/right bevel (darker)
          ctx.fillStyle = '#200e06';
          ctx.fillRect(sx,      sy + TS - 2, TS, 2);
          ctx.fillRect(sx + TS - 2, sy, 2, TS);
          // Brick pattern
          ctx.fillStyle = '#2a1a0a';
          if ((ty % 2 === 0 && tx % 4 === 0) || (ty % 2 === 1 && tx % 4 === 2)) {
            ctx.fillRect(sx + TS / 2 - 1, sy + 2, 2, TS - 4);
          }
        } else {
          // Floor
          ctx.fillStyle = '#0d1a0a';
          ctx.fillRect(sx, sy, TS, TS);
          // Subtle grid dot
          ctx.fillStyle = '#111f0d';
          ctx.fillRect(sx + TS - 1, sy + TS - 1, 1, 1);
        }
      }
    }
  }

  _drawTanks(tanks, myId) {
    const { ctx } = this;
    // Draw dead tanks first (as ghosts behind everything)
    for (const t of tanks) {
      if (t.alive || t.lives <= 0) continue;
      ctx.globalAlpha = 0.25;
      this._drawOneTank(t, myId);
      ctx.globalAlpha = 1;
    }
    for (const t of tanks) {
      if (!t.alive) continue;
      this._drawOneTank(t, myId);
    }
  }

  _drawOneTank(t, myId) {
    const { ctx } = this;
    const sx   = Math.round(t.x * TS - this.camX);
    const sy   = Math.round(t.y * TS - this.camY);
    const half = TS / 2;
    const body = TS - 4;

    // Skip if off screen
    if (sx < -TS || sx > this.canvas.width + TS || sy < -TS || sy > this.canvas.height + TS) return;

    const color = t.id === myId ? '#00ff41' : TANK_COLORS[t.id % TANK_COLORS.length];
    const drawColor = t.shootFlash ? '#ffffff' : color;

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(sx - half + 4, sy - half + 4, body, body);

    // Body
    ctx.fillStyle = drawColor;
    ctx.fillRect(sx - half + 2, sy - half + 2, body, body);

    // Track stripes
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    if (t.dir === 0 || t.dir === 2) {
      ctx.fillRect(sx - half + 2, sy - half + 2, 3, body);
      ctx.fillRect(sx + half - 5, sy - half + 2, 3, body);
    } else {
      ctx.fillRect(sx - half + 2, sy - half + 2, body, 3);
      ctx.fillRect(sx - half + 2, sy + half - 5, body, 3);
    }

    // Barrel
    ctx.fillStyle = drawColor;
    const barrelOffsets = [
      [0, -(TS / 2 + 1), 3, 7],  // UP
      [TS / 2 - 1, 0, 7, 3],     // RIGHT
      [0, TS / 2 - 1, 3, 7],     // DOWN
      [-(TS / 2 + 1), 0, 7, 3],  // LEFT
    ];
    const [bx, by, bw, bh] = barrelOffsets[t.dir];
    ctx.fillRect(sx - 1 + bx, sy - 1 + by, bw, bh);

    // White outline for local player
    if (t.id === myId) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - half + 1, sy - half + 1, body + 2, body + 2);
    }

    // Name tag
    const name = '';  // drawn in _drawHUD leaderboard instead
    void name;
  }

  _drawBullets(bullets) {
    const { ctx } = this;
    for (const b of bullets) {
      const sx = Math.round(b.x * TS - this.camX);
      const sy = Math.round(b.y * TS - this.camY);
      // Glow
      ctx.fillStyle = 'rgba(255,230,0,0.25)';
      ctx.fillRect(sx - 5, sy - 5, 10, 10);
      // Core
      ctx.fillStyle = '#ffee00';
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
    }
  }

  _drawExplosions() {
    const { ctx } = this;
    for (const e of this._explosions) {
      const p  = e.age / e.duration;
      const sx = Math.round(e.x * TS - this.camX);
      const sy = Math.round(e.y * TS - this.camY);
      const r  = p * TS * 2;
      const a  = 1 - p;

      // Outer ring
      ctx.strokeStyle = `rgba(255,${Math.floor(60 + 140 * (1 - p))},0,${a})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Inner fill flash
      ctx.fillStyle = `rgba(255,200,50,${a * 0.4})`;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawScanlines() {
    const { ctx, canvas } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    for (let y = 0; y < canvas.height; y += 2) {
      ctx.fillRect(0, y, canvas.width, 1);
    }
    // Vignette
    const grad = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.height * 0.35,
      canvas.width / 2, canvas.height / 2, canvas.height * 0.85
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  _drawHUD(tanks, myId, players, ping) {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;

    // Bottom bar background
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, H - 48, W, 48);
    ctx.strokeStyle = '#00aa30';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H - 48); ctx.lineTo(W, H - 48); ctx.stroke();

    const myTank = tanks.find(t => t.id === myId);
    ctx.font = '10px "Press Start 2P", monospace';

    if (myTank) {
      // Lives (hearts)
      ctx.fillStyle = '#00ff41';
      ctx.fillText('LIVES:', 12, H - 30);
      ctx.fillStyle = myTank.lives > 1 ? '#ff4444' : '#ff0000';
      ctx.fillText('♥'.repeat(Math.max(0, myTank.lives)), 80, H - 30);
      // Score
      ctx.fillStyle = '#00ff41';
      ctx.fillText(`SCORE: ${String(myTank.score).padStart(5, '0')}`, 12, H - 10);
    }

    // Ping indicator
    const pingColor = ping < 50 ? '#00ff41' : ping < 120 ? '#ffaa00' : '#ff4444';
    ctx.fillStyle = pingColor;
    ctx.fillText(`PING: ${ping}ms`, W - 180, H - 10);

    // Player count
    const alive = tanks.filter(t => t.alive).length;
    ctx.fillStyle = '#00ff41';
    ctx.fillText(`${alive}/${tanks.length} TANKS`, W - 180, H - 30);

    // Leaderboard (top-right)
    const sorted = [...tanks].sort((a, b) => b.score - a.score).slice(0, 10);
    const lbW = 190, lbH = 14 + sorted.length * 16;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(W - lbW - 4, 4, lbW + 4, lbH);
    ctx.strokeStyle = '#005520';
    ctx.lineWidth = 1;
    ctx.strokeRect(W - lbW - 4, 4, lbW + 4, lbH);

    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#00aa30';
    ctx.fillText('── TOP TANKS ──', W - lbW, 16);

    for (let i = 0; i < sorted.length; i++) {
      const t    = sorted[i];
      const pName = (players.get(t.id) || `P${t.id}`).slice(0, 9).padEnd(9);
      const pts   = String(t.score).padStart(5, '0');
      ctx.fillStyle = t.id === myId
        ? '#ffffff'
        : (t.alive ? TANK_COLORS[t.id % TANK_COLORS.length] : '#333333');
      ctx.fillText(`${pName} ${pts}`, W - lbW, 28 + i * 16);
    }
  }

  _drawRoundMessage() {
    const { ctx, canvas, _roundMsg: msg } = this;
    const p     = msg.age / msg.duration;
    const alpha = p < 0.15 ? p / 0.15 : p > 0.75 ? (1 - p) / 0.25 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font        = '22px "Press Start 2P", monospace';
    ctx.fillStyle   = '#ffff00';
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur  = 20;
    ctx.textAlign   = 'center';
    ctx.fillText(msg.text, canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}
