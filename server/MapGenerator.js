class MapGenerator {
  constructor(width = 80, height = 60, density = 20) {
    this.width   = width;
    this.height  = height;
    this.density = Math.max(0, Math.min(100, density));
    this.tiles   = new Uint8Array(width * height);
  }

  generate() {
    // Start with all floor
    this.tiles.fill(0);

    if (this.density > 0) {
      // Scatter rectangular wall clusters; count scales with density
      const count = Math.round(this.density * 1.8);
      for (let i = 0; i < count; i++) {
        const w = 2 + Math.floor(Math.random() * 5); // 2–6 wide
        const h = 2 + Math.floor(Math.random() * 3); // 2–4 tall
        const x = 1 + Math.floor(Math.random() * (this.width  - w - 2));
        const y = 1 + Math.floor(Math.random() * (this.height - h - 2));
        for (let dy = 0; dy < h; dy++)
          for (let dx = 0; dx < w; dx++)
            this._set(x + dx, y + dy, 1);
      }
    }

    // Solid border (always indestructible)
    for (let x = 0; x < this.width;  x++) { this._set(x, 0, 1); this._set(x, this.height - 1, 1); }
    for (let y = 0; y < this.height; y++) { this._set(0, y, 1); this._set(this.width - 1, y, 1); }

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

    // Fill up if needed
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
