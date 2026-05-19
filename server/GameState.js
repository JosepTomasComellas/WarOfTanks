const Tank        = require('./Tank');
const Bullet      = require('./Bullet');
const MapGenerator = require('./MapGenerator');
const { Dir, Keys, EventType } = require('./protocol');

const DX = [ 0, 1, 0, -1]; // UP RIGHT DOWN LEFT
const DY = [-1, 0, 1,  0];

class GameState {
  constructor() {
    this.tanks        = new Map(); // id → Tank
    this.bullets      = new Map(); // id → Bullet
    this.map          = null;
    this.spawns       = [];
    this.tick         = 0;
    this.events       = [];        // flushed each tick by GameServer
    this.mapJustReset = false;
    this._roundTimer  = null;
    this._wallDensity = Math.max(0, Math.min(100, parseInt(process.env.WALL_DENSITY || '20', 10)));
    this.newRound();
  }

  newRound() {
    if (this._roundTimer) { clearTimeout(this._roundTimer); this._roundTimer = null; }
    this.map    = new MapGenerator(80, 60, this._wallDensity).generate();
    this.spawns = this.map.findSpawnPoints(128);
    this.bullets.clear();
    this.events = [];
    this.mapJustReset = true;

    // Reset existing players
    let i = 0;
    for (const t of this.tanks.values()) {
      const sp = this.spawns[i % this.spawns.length];
      t.x = sp.x; t.y = sp.y;
      t.alive = true; t.lives = 3;
      t.respawnTimer = 0; t.keys = 0;
      i++;
    }
  }

  // Returns null if server is full
  addPlayer(name) {
    // Find lowest free ID in 1-254
    let id = 1;
    while (id < 255 && this.tanks.has(id)) id++;
    if (id >= 255) return null;

    const sp = this.spawns[this.tanks.size % this.spawns.length] || { x: 2.5, y: 2.5 };
    const tank = new Tank(id, name, sp.x, sp.y);
    this.tanks.set(id, tank);
    return tank;
  }

  removePlayer(id) {
    this.tanks.delete(id);
    // Remove bullets belonging to this player
    for (const [bid, b] of this.bullets.entries())
      if (b.ownerId === id) this.bullets.delete(bid);
  }

  applyInput(playerId, keys) {
    const t = this.tanks.get(playerId);
    if (t) t.keys = keys;
  }

  update(dt) {
    this.tick++;
    this.events = [];

    for (const tank of this.tanks.values()) {
      if (!tank.alive) {
        if (tank.respawnTimer > 0) {
          tank.respawnTimer -= dt;
          if (tank.respawnTimer <= 0 && tank.lives > 0) this._respawn(tank);
        }
        continue;
      }

      // Direction from keys
      tank.shootFlash = false;
      let moved = false;
      if (tank.keys & Keys.UP)    { tank.dir = Dir.UP;    moved = true; }
      if (tank.keys & Keys.DOWN)  { tank.dir = Dir.DOWN;  moved = true; }
      if (tank.keys & Keys.LEFT)  { tank.dir = Dir.LEFT;  moved = true; }
      if (tank.keys & Keys.RIGHT) { tank.dir = Dir.RIGHT; moved = true; }

      if (moved) {
        const nx = tank.x + DX[tank.dir] * tank.speed * dt;
        const ny = tank.y + DY[tank.dir] * tank.speed * dt;
        if (!this._wallHit(nx, tank.y)) tank.x = nx;
        if (!this._wallHit(tank.x, ny)) tank.y = ny;
        tank.x = Math.max(0.5, Math.min(this.map.width  - 0.5, tank.x));
        tank.y = Math.max(0.5, Math.min(this.map.height - 0.5, tank.y));
      }

      // Shooting (max 2 bullets per player to bound packet size)
      if (tank.shootCooldown > 0) tank.shootCooldown -= dt;
      if ((tank.keys & Keys.SHOOT) && tank.shootCooldown <= 0) {
        const playerBullets = [...this.bullets.values()].filter(b => b.ownerId === tank.id).length;
        if (playerBullets < 2) {
          tank.shootCooldown = 0.5;
          tank.shootFlash    = true;
          const bx = tank.x + DX[tank.dir] * 0.7;
          const by = tank.y + DY[tank.dir] * 0.7;
          const b  = new Bullet(tank.id, bx, by, tank.dir);
          this.bullets.set(b.id, b);
        }
      }
    }

    // Move bullets
    for (const [bid, b] of this.bullets.entries()) {
      b.x += DX[b.dir] * b.speed * dt;
      b.y += DY[b.dir] * b.speed * dt;

      if (b.x < 0 || b.x >= this.map.width || b.y < 0 || b.y >= this.map.height) {
        this.bullets.delete(bid); continue;
      }
      if (this.map.isWall(b.x, b.y)) {
        const tx = Math.floor(b.x);
        const ty = Math.floor(b.y);
        const isBorder = tx === 0 || ty === 0 || tx === this.map.width - 1 || ty === this.map.height - 1;
        if (!isBorder) {
          this.map._set(tx, ty, 0);
          this.events.push({ type: EventType.WALL_DESTROYED, x: tx, y: ty, playerId: 0 });
        }
        this.events.push({ type: EventType.EXPLOSION, x: b.x, y: b.y, playerId: 0 });
        this.bullets.delete(bid); continue;
      }

      // Tank hit detection
      let hit = false;
      for (const tank of this.tanks.values()) {
        if (!tank.alive || tank.id === b.ownerId) continue;
        if (Math.abs(tank.x - b.x) < 0.55 && Math.abs(tank.y - b.y) < 0.55) {
          this.events.push({ type: EventType.EXPLOSION,   x: b.x,    y: b.y,    playerId: tank.id });
          this.events.push({ type: EventType.TANK_KILLED, x: tank.x, y: tank.y, playerId: tank.id });
          tank.alive        = false;
          tank.lives--;
          tank.respawnTimer = tank.lives > 0 ? 3 : 0;
          const shooter = this.tanks.get(b.ownerId);
          if (shooter) shooter.score = Math.min(shooter.score + 100, 9999);
          this.bullets.delete(bid);
          hit = true;
          break;
        }
      }
      if (hit) continue;
    }

    // Round-over check (only when > 1 player connected)
    if (this.tanks.size > 1 && !this._roundTimer) {
      const contenders = [...this.tanks.values()].filter(t => t.alive || t.lives > 0);
      if (contenders.length <= 1) {
        const winner = contenders[0];
        if (winner) winner.score = Math.min(winner.score + 500, 9999);
        this.events.push({ type: EventType.ROUND_START, x: 0, y: 0, playerId: winner ? winner.id : 0 });
        this._roundTimer = setTimeout(() => this.newRound(), 6000);
      }
    }
  }

  _respawn(tank) {
    const occupied = new Set(
      [...this.tanks.values()].filter(t => t.alive).map(t => `${Math.floor(t.x)},${Math.floor(t.y)}`)
    );
    const sp = this.spawns.find(p => !occupied.has(`${Math.floor(p.x)},${Math.floor(p.y)}`))
               || this.spawns[0] || { x: 2.5, y: 2.5 };
    tank.x = sp.x; tank.y = sp.y;
    tank.alive = true;
    tank.shootCooldown = 1.5;
  }

  resetScores() {
    for (const t of this.tanks.values()) t.score = 0;
  }

  adminSnapshot() {
    return {
      tick:        this.tick,
      playerCount: this.tanks.size,
      bulletCount: this.bullets.size,
      players: [...this.tanks.values()]
        .map(t => ({
          id:    t.id,
          name:  t.name,
          score: t.score,
          lives: t.lives,
          alive: t.alive,
        }))
        .sort((a, b) => b.score - a.score),
    };
  }

  _wallHit(x, y) {
    const r = 0.38;
    return (
      this.map.isWall(x - r, y - r) || this.map.isWall(x + r, y - r) ||
      this.map.isWall(x - r, y + r) || this.map.isWall(x + r, y + r)
    );
  }
}

module.exports = GameState;
