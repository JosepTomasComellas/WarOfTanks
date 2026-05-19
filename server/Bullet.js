let _nextId = 1;

class Bullet {
  constructor(ownerId, x, y, dir) {
    this.id      = _nextId++ & 0xFFFF; // wraps at 65535
    this.ownerId = ownerId;
    this.x       = x;
    this.y       = y;
    this.dir     = dir;
    this.speed   = 14; // tiles/sec
  }
}

module.exports = Bullet;
