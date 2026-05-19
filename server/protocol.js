const PacketType = {
  // Client → Server
  JOIN:   0x01,
  INPUT:  0x02,
  PING:   0x03,
  LEAVE:  0x04,
  // Server → Client
  WELCOME:     0x11,
  STATE:       0x12,
  PONG:        0x13,
  EVENT:       0x14,
  PLAYER_LIST: 0x15,
};

const EventType = {
  EXPLOSION:   1,
  TANK_KILLED: 2,
  ROUND_START: 3,
  GAME_OVER:   4,
};

const Dir  = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
const Keys = { UP: 0x01, DOWN: 0x02, LEFT: 0x04, RIGHT: 0x08, SHOOT: 0x10 };

function parseClientPacket(buf) {
  if (!buf || buf.length === 0) return null;
  const type = buf[0];
  try {
    switch (type) {
      case PacketType.JOIN: {
        const nameLen = Math.min(buf[1] || 0, buf.length - 2, 16);
        const name = buf.slice(2, 2 + nameLen).toString('utf8');
        return { type, name: name || 'TANK' };
      }
      case PacketType.INPUT:
        if (buf.length < 3) return null;
        return { type, playerId: buf[1], keys: buf[2] };
      case PacketType.PING:
        if (buf.length < 5) return null;
        return { type, timestamp: buf.readUInt32BE(1) };
      case PacketType.LEAVE:
        return { type, playerId: buf[1] };
      default:
        return null;
    }
  } catch { return null; }
}

// WELCOME: [0x11][playerId:1][mapW:1][mapH:1][bitPackedMap:ceil(W*H/8)]
function buildWelcome(playerId, map) {
  const mapBits = map.toBitBuffer();
  const buf = Buffer.allocUnsafe(4 + mapBits.length);
  buf[0] = PacketType.WELCOME;
  buf[1] = playerId;
  buf[2] = map.width;
  buf[3] = map.height;
  mapBits.copy(buf, 4);
  return buf;
}

// STATE: [0x12][tick:4][numTanks:1][...tank×10][numBullets:1][...bullet×8]
// Tank:   [id:1][x:2][y:2][dir:1][lives:1][score:2][flags:1]
// Bullet: [id:2][ownerId:1][x:2][y:2][dir:1]
function buildState(tick, tanks, bullets) {
  const ta = [...tanks.values()];
  const ba = [...bullets.values()];
  const buf = Buffer.allocUnsafe(6 + ta.length * 10 + 1 + ba.length * 8);
  let off = 0;
  buf[off++] = PacketType.STATE;
  buf.writeUInt32BE(tick, off); off += 4;
  buf[off++] = ta.length;
  for (const t of ta) {
    buf[off++] = t.id;
    buf.writeUInt16BE(Math.round(t.x * 10) & 0xFFFF, off); off += 2;
    buf.writeUInt16BE(Math.round(t.y * 10) & 0xFFFF, off); off += 2;
    buf[off++] = t.dir;
    buf[off++] = t.lives;
    buf.writeUInt16BE(Math.min(t.score, 9999), off); off += 2;
    buf[off++] = (t.alive ? 1 : 0) | (t.shootFlash ? 2 : 0);
  }
  buf[off++] = ba.length;
  for (const b of ba) {
    buf.writeUInt16BE(b.id & 0xFFFF, off); off += 2;
    buf[off++] = b.ownerId;
    buf.writeUInt16BE(Math.round(b.x * 10) & 0xFFFF, off); off += 2;
    buf.writeUInt16BE(Math.round(b.y * 10) & 0xFFFF, off); off += 2;
    buf[off++] = b.dir;
  }
  return buf;
}

// PONG: [0x13][timestamp:4]
function buildPong(timestamp) {
  const buf = Buffer.allocUnsafe(5);
  buf[0] = PacketType.PONG;
  buf.writeUInt32BE(timestamp >>> 0, 1);
  return buf;
}

// EVENT: [0x14][eventType:1][x:2][y:2][playerId:1]
function buildEvent(eventType, x, y, playerId) {
  const buf = Buffer.allocUnsafe(7);
  buf[0] = PacketType.EVENT;
  buf[1] = eventType;
  buf.writeUInt16BE(Math.round(x * 10) & 0xFFFF, 2);
  buf.writeUInt16BE(Math.round(y * 10) & 0xFFFF, 4);
  buf[6] = playerId || 0;
  return buf;
}

// PLAYER_LIST: [0x15][num:1]([id:1][nameLen:1][name:N])*
function buildPlayerList(tanks) {
  const ta = [...tanks.values()];
  const nameBufs = ta.map(t => Buffer.from(t.name.slice(0, 16), 'utf8'));
  let size = 2;
  for (const nb of nameBufs) size += 2 + nb.length;
  const buf = Buffer.allocUnsafe(size);
  let off = 0;
  buf[off++] = PacketType.PLAYER_LIST;
  buf[off++] = ta.length;
  for (let i = 0; i < ta.length; i++) {
    buf[off++] = ta[i].id;
    buf[off++] = nameBufs[i].length;
    nameBufs[i].copy(buf, off);
    off += nameBufs[i].length;
  }
  return buf;
}

module.exports = {
  PacketType, EventType, Dir, Keys,
  parseClientPacket,
  buildWelcome, buildState, buildPong, buildEvent, buildPlayerList,
};
