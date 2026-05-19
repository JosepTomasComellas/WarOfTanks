const role   = (process.env.ROLE || 'client').toLowerCase();
const bridge = require('./state-bridge');

if (role === 'server') {
  console.log('[War of Tanks] Starting as SERVER');
  const GameServer = require('./server/GameServer');
  const port = parseInt(process.env.UDP_PORT || '8888', 10);
  bridge.gameServer = new GameServer(port);
  bridge.gameServer.start();
}

console.log('[War of Tanks] Starting client proxy');
require('./client/proxy');
