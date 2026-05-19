class Tank {
  constructor(id, name, x, y) {
    this.id    = id;
    this.name  = name.slice(0, 16);
    this.x     = x;
    this.y     = y;
    this.dir   = Math.floor(Math.random() * 4);
    this.lives = 3;
    this.score = 0;
    this.alive = true;

    this.keys         = 0;
    this.shootCooldown = 0;
    this.shootFlash    = false;
    this.respawnTimer  = 0;
    this.speed         = 5; // tiles/sec
  }
}

module.exports = Tank;
