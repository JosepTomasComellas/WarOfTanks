const dgram = require('dgram');
const {
  PacketType, EventType,
  parseClientPacket,
  buildWelcome, buildState, buildPong, buildEvent, buildPlayerList,
} = require('./protocol');
const GameState = require('./GameState');

const TICK_RATE       = 20;   // game updates per second
const STALE_TIMEOUT   = 15000; // ms without packet → drop client
const PLAYER_LIST_PERIOD = 5 * TICK_RATE; // ticks between player-list broadcasts

class GameServer {
  constructor(port = 8888) {
    this.port    = port;
    this.socket  = dgram.createSocket('udp4');
    this.state   = new GameState();
    // clientKey → { address, port, playerId, lastSeen }
    this.clients = new Map();
    this._tickCount = 0;
    this._lastTick  = Date.now();
  }

  start() {
    this.socket.on('message', (msg, rinfo) => this._onMessage(msg, rinfo));
    this.socket.on('error',   (err)        => console.error('[Server] UDP error:', err));
    this.socket.bind(this.port, () =>
      console.log(`[Server] UDP listening on port ${this.port}`)
    );
    setInterval(() => this._tick(),        Math.round(1000 / TICK_RATE));
    setInterval(() => this._cleanStale(),  5000);
  }

  _onMessage(msg, rinfo) {
    const key    = `${rinfo.address}:${rinfo.port}`;
    const packet = parseClientPacket(msg);
    if (!packet) return;

    const client = this.clients.get(key);
    if (client) client.lastSeen = Date.now();

    switch (packet.type) {
      case PacketType.JOIN: {
        if (client) {
          // Re-send welcome (lost packet on first connect)
          this._send(buildWelcome(client.playerId, this.state.map), rinfo.address, rinfo.port);
          return;
        }
        const tank = this.state.addPlayer(packet.name);
        if (!tank) { console.warn('[Server] Server full, rejecting player'); return; }
        this.clients.set(key, { address: rinfo.address, port: rinfo.port, playerId: tank.id, lastSeen: Date.now() });
        this._send(buildWelcome(tank.id, this.state.map), rinfo.address, rinfo.port);
        this._broadcast(buildPlayerList(this.state.tanks));
        console.log(`[Server] "${tank.name}" joined (id=${tank.id}) — ${this.state.tanks.size} players`);
        break;
      }
      case PacketType.INPUT: {
        if (client) this.state.applyInput(client.playerId, packet.keys);
        break;
      }
      case PacketType.PING: {
        this._send(buildPong(packet.timestamp), rinfo.address, rinfo.port);
        break;
      }
      case PacketType.LEAVE: {
        if (!client) return;
        console.log(`[Server] Player ${client.playerId} left`);
        this.state.removePlayer(client.playerId);
        this.clients.delete(key);
        this._broadcast(buildPlayerList(this.state.tanks));
        break;
      }
    }
  }

  _tick() {
    const now = Date.now();
    const dt  = Math.min((now - this._lastTick) / 1000, 0.1);
    this._lastTick = now;
    this._tickCount++;

    this.state.update(dt);

    const statePkt = buildState(this.state.tick, this.state.tanks, this.state.bullets);
    this._broadcast(statePkt);

    for (const ev of this.state.events) {
      this._broadcast(buildEvent(ev.type, ev.x, ev.y, ev.playerId));
    }

    if (this._tickCount % PLAYER_LIST_PERIOD === 0) {
      this._broadcast(buildPlayerList(this.state.tanks));
    }
  }

  _broadcast(msg) {
    for (const c of this.clients.values())
      this._send(msg, c.address, c.port);
  }

  _send(msg, address, port) {
    this.socket.send(msg, 0, msg.length, port, address, (err) => {
      if (err) console.error(`[Server] Send error to ${address}:${port}:`, err.message);
    });
  }

  _cleanStale() {
    const now = Date.now();
    for (const [key, c] of this.clients.entries()) {
      if (now - c.lastSeen > STALE_TIMEOUT) {
        console.log(`[Server] Dropping stale player ${c.playerId}`);
        this.state.removePlayer(c.playerId);
        this.clients.delete(key);
        this._broadcast(buildPlayerList(this.state.tanks));
      }
    }
  }
}

module.exports = GameServer;
