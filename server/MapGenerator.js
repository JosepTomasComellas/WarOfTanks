class MapGenerator {
  constructor(width = 80, height = 60) {
    this.width  = width;
    this.height = height;
    this.tiles  = new Uint8Array(width * height); // 0=floor, 1=wall
  }

  generate() {
    // Start full of walls
    this.tiles.fill(1);

    // Carve rooms on a grid
    const cellW = 7, cellH = 6;
    const cols = Math.floor((this.width  - 2) / cellW);
    const rows = Math.floor((this.height - 2) / cellH);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const ox = 1 + col * cellW + 1;
        const oy = 1 + row * cellH + 1;

        // Carve 3×3 room
        for (let dy = 0; dy < 3; dy++)
          for (let dx = 0; dx < 3; dx++)
            this._set(ox + dx, oy + dy, 0);

        // Connect right (80% chance)
        if (col < cols - 1 && Math.random() > 0.2) {
          const cx = ox + 3;
          this._set(cx, oy + 1, 0);
          this._set(cx, oy + 1, 0);
          this._set(cx + 1, oy + 1, 0);
        }

        // Connect down (80% chance)
        if (row < rows - 1 && Math.random() > 0.2) {
          const cy = oy + 3;
          this._set(ox + 1, cy, 0);
          this._set(ox + 1, cy + 1, 0);
        }
      }
    }

    // Extra random horizontal/vertical corridors for variety
    for (let i = 0; i < 30; i++) {
      const x   = 1 + Math.floor(Math.random() * (this.width  - 4));
      const y   = 1 + Math.floor(Math.random() * (this.height - 4));
      const len = 4 + Math.floor(Math.random() * 10);
      if (Math.random() > 0.5) {
        for (let d = 0; d < len; d++) this._set(Math.min(x + d, this.width - 2), y, 0);
      } else {
        for (let d = 0; d < len; d++) this._set(x, Math.min(y + d, this.height - 2), 0);
      }
    }

    // Restore solid border
    for (let x = 0; x < this.width;  x++) { this._set(x, 0, 1); this._set(x, this.height - 1, 1); }
    for (let y = 0; y < this.height; y++) { this._set(0, y, 1); this._set(this.width  - 1, y, 1); }

    return this;
  }

  _set(x, y, v) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height)
      this.tiles[y * this.width + x] = v;
  }

  get(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 1;
    return this.tiles[y * this.width + x];
  }

  isWall(x, y) {
    return this.get(Math.floor(x), Math.floor(y)) === 1;
  }

  // Find up to `count` well-distributed open spawn positions
  findSpawnPoints(count) {
    const open = [];
    for (let y = 1; y < this.height - 1; y++)
      for (let x = 1; x < this.width  - 1; x++)
        if (this.get(x, y) === 0) open.push({ x: x + 0.5, y: y + 0.5 });

    // Shuffle
    for (let i = open.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [open[i], open[j]] = [open[j], open[i]];
    }

    const chosen = [];
    const minDist = 4;
    for (const p of open) {
      if (chosen.length >= count) break;
      if (chosen.every(q => Math.hypot(p.x - q.x, p.y - q.y) >= minDist))
        chosen.push(p);
    }

    // Fill up if map is small
    let idx = 0;
    while (chosen.length < count && open.length > 0)
      chosen.push(open[idx++ % open.length]);

    return chosen;
  }

  // Bit-pack: 1 bit per tile, LSB first → ceil(W*H/8) bytes
  toBitBuffer() {
    const total = this.width * this.height;
    const buf   = Buffer.alloc(Math.ceil(total / 8));
    for (let i = 0; i < total; i++)
      if (this.tiles[i]) buf[i >> 3] |= (1 << (i & 7));
    return buf;
  }
}

module.exports = MapGenerator;
