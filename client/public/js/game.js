'use strict';

class Game {
  constructor(canvas) {
    this.canvas   = canvas;
    this.renderer = new Renderer(canvas);
    this.input    = new InputHandler();

    this.ws      = null;
    this.myId    = null;
    this.players = new Map(); // id → name

    this.gs = { map: null, tanks: [], bullets: [] };

    this.ping          = 0;
    this._lastPingTs   = 0;
    this._prevKeys     = -1;
    this._wasShootFlash = false;

    this._rafId        = null;
    this._inputTimer   = null;
    this._pingTimer    = null;
    this._lastFrame    = 0;
    this._joinRetryTimer = null;
    this._joinName     = '';
  }

  start(playerName) {
    this._joinName = playerName;
    const wsUrl = `ws://${location.host}`;
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen    = ()  => { console.log('[Game] WS connected'); this._sendJoin(); };
    this.ws.onmessage = (ev) => this._onPacket(new Uint8Array(ev.data));
    this.ws.onclose   = ()  => { this._cleanup(); showScreen('disconnected'); };
    this.ws.onerror   = (e) => console.error('[Game] WS error', e);
  }

  _sendJoin() {
    this._send(buildJoin(this._joinName));
    this._joinRetryTimer = setTimeout(() => {
      if (!this.myId) { console.log('[Game] Retrying JOIN…'); this._sendJoin(); }
    }, 2000);
  }

  _onPacket(u8) {
    const pkt = parseServerPacket(u8);
    if (!pkt) return;

    switch (pkt.type) {

      case PacketType.WELCOME: {
        if (this._joinRetryTimer) { clearTimeout(this._joinRetryTimer); this._joinRetryTimer = null; }
        this.myId = pkt.playerId;
        this.gs.map = { width: pkt.mapW, height: pkt.mapH, tiles: pkt.tiles };
        this.renderer.centerOn(pkt.mapW / 2, pkt.mapH / 2);
        this._startLoop();
        this._startInput();
        this._startPing();
        showScreen('game');
        break;
      }

      case PacketType.STATE: {
        this.gs.tanks   = pkt.tanks;
        this.gs.bullets = pkt.bullets;
        const me = pkt.tanks.find(t => t.id === this.myId);
        if (me) {
          this.renderer.centerOn(me.x, me.y);
          if (me.shootFlash && !this._wasShootFlash) Sounds.shoot();
          this._wasShootFlash = me.shootFlash;
        }
        break;
      }

      case PacketType.PONG:
        this.ping = Math.min(Date.now() - this._lastPingTs, 9999);
        break;

      case PacketType.EVENT: {
        const { eventType, x, y, playerId } = pkt;
        if (eventType === EventType.EXPLOSION) {
          this.renderer.addExplosion(x, y);
          Sounds.explosion();
        }
        if (eventType === EventType.TANK_KILLED) {
          this.renderer.addExplosion(x, y);
          if (playerId === this.myId) Sounds.death();
          else Sounds.explosion();
        }
        if (eventType === EventType.ROUND_START) {
          const winner = this.players.get(playerId);
          this.renderer.showRoundMessage(winner ? `${winner} WINS!` : 'NEW ROUND!');
          Sounds.newRound();
        }
        break;
      }

      case PacketType.PLAYER_LIST:
        this.players.clear();
        for (const p of pkt.players) this.players.set(p.id, p.name);
        break;
    }
  }

  _startLoop() {
    const loop = (ts) => {
      const dt = Math.min((ts - this._lastFrame) / 1000, 0.1);
      this._lastFrame = ts;
      this.renderer.update(dt);
      this.renderer.render(this.gs, this.myId, this.players, this.ping);
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame((ts) => { this._lastFrame = ts; loop(ts); });
  }

  _startInput() {
    let ticks = 0;
    this._inputTimer = setInterval(() => {
      if (!this.myId || !this._wsOpen()) return;
      const keys = this.input.keys;
      ticks++;
      if (keys !== this._prevKeys || ticks % 10 === 0) {
        this._send(buildInput(this.myId, keys));
        this._prevKeys = keys;
      }
    }, 50);
  }

  _startPing() {
    this._pingTimer = setInterval(() => {
      if (!this._wsOpen()) return;
      this._lastPingTs = Date.now();
      this._send(buildPing(this._lastPingTs));
    }, 2000);
  }

  _send(data) { if (this._wsOpen()) this.ws.send(data); }

  _wsOpen() { return this.ws && this.ws.readyState === WebSocket.OPEN; }

  _cleanup() {
    if (this._rafId)          cancelAnimationFrame(this._rafId);
    if (this._inputTimer)     clearInterval(this._inputTimer);
    if (this._pingTimer)      clearInterval(this._pingTimer);
    if (this._joinRetryTimer) clearTimeout(this._joinRetryTimer);
    this.input.destroy();
  }
}
