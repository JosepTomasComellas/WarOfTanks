// Singleton compartit entre server/index.js i client/proxy.js
// quan s'executen al mateix procés (ROLE=server).
module.exports = { gameServer: null };
