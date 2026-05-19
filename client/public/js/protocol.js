'use strict';
// Shared protocol constants (mirror of server/protocol.js)

const PacketType = {
  JOIN: 0x01, INPUT: 0x02, PING: 0x03, LEAVE: 0x04,
  WELCOME: 0x11, STATE: 0x12, PONG: 0x13, EVENT: 0x14, PLAYER_LIST: 0x15,
};

const EventType = {
  EXPLOSION: 1, TANK_KILLED: 2, ROUND_START: 3, GAME_OVER: 4,
};

const Dir  = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
const Keys = { UP: 0x01, DOWN: 0x02, LEFT: 0x04, RIGHT: 0x08, SHOOT: 0x10 };

// ── Build outgoing packets ──────────────────────────────────────────────────

function buildJoin(name) {
  const nb  = new TextEncoder().encode(name.slice(0, 16));
  const buf = new Uint8Array(2 + nb.length);
  buf[0] = PacketType.JOIN;
  buf[1] = nb.length;
  buf.set(nb, 2);
  return buf;
}

function buildInput(playerId, keys) {
  return new Uint8Array([PacketType.INPUT, playerId & 0xFF, keys & 0xFF]);
}

function buildPing(ts32) {
  const buf  = new Uint8Array(5);
  const view = new DataView(buf.buffer);
  buf[0] = PacketType.PING;
  view.setUint32(1, ts32 >>> 0, false);
  return buf;
}

function buildLeave(playerId) {
  return new Uint8Array([PacketType.LEAVE, playerId & 0xFF]);
}

// ── Parse incoming packets ─────────────────────────────────────────────────

function parseServerPacket(u8) {
  if (!u8 || u8.length === 0) return null;
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const type = u8[0];

  try {
    switch (type) {

      case PacketType.WELCOME: {
        const playerId = u8[1];
        const mapW     = u8[2];
        const mapH     = u8[3];
        const bits     = u8.slice(4, 4 + Math.ceil(mapW * mapH / 8));
        // Unpack bit buffer → Uint8Array of 0/1
        const tiles = new Uint8Array(mapW * mapH);
        for (let i = 0; i < mapW * mapH; i++)
          tiles[i] = (bits[i >> 3] >> (i & 7)) & 1;
        return { type, playerId, mapW, mapH, tiles };
      }

      case PacketType.STATE: {
        const tick = view.getUint32(1, false);
        let off = 5;
        const numTanks = u8[off++];
        const tanks = [];
        for (let i = 0; i < numTanks; i++) {
          const id    = u8[off++];
          const x     = view.getUint16(off, false) / 10; off += 2;
          const y     = view.getUint16(off, false) / 10; off += 2;
          const dir   = u8[off++];
          const lives = u8[off++];
          const score = view.getUint16(off, false); off += 2;
          const flags = u8[off++];
          tanks.push({ id, x, y, dir, lives, score, alive: !!(flags & 1), shootFlash: !!(flags & 2) });
        }
        const numBullets = u8[off++];
        const bullets = [];
        for (let i = 0; i < numBullets; i++) {
          const id      = view.getUint16(off, false); off += 2;
          const ownerId = u8[off++];
          const x       = view.getUint16(off, false) / 10; off += 2;
          const y       = view.getUint16(off, false) / 10; off += 2;
          const dir     = u8[off++];
          bullets.push({ id, ownerId, x, y, dir });
        }
        return { type, tick, tanks, bullets };
      }

      case PacketType.PONG:
        return { type, timestamp: view.getUint32(1, false) };

      case PacketType.EVENT: {
        const eventType = u8[1];
        const x         = view.getUint16(2, false) / 10;
        const y         = view.getUint16(4, false) / 10;
        const playerId  = u8[6];
        return { type, eventType, x, y, playerId };
      }

      case PacketType.PLAYER_LIST: {
        const num = u8[1];
        let off = 2;
        const players = [];
        for (let i = 0; i < num; i++) {
          const id      = u8[off++];
          const nameLen = u8[off++];
          const name    = new TextDecoder().decode(u8.slice(off, off + nameLen));
          off += nameLen;
          players.push({ id, name });
        }
        return { type, players };
      }

      default: return null;
    }
  } catch (e) { console.warn('[Protocol] Parse error:', e); return null; }
}
