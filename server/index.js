const GameServer = require('./GameServer');
const port = parseInt(process.env.UDP_PORT || '8888', 10);
new GameServer(port).start();
