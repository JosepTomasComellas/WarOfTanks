const role = (process.env.ROLE || 'client').toLowerCase();

if (role === 'server') {
  console.log('[War of Tanks] Starting as SERVER');
  require('./server/index');
}

// Both roles run the HTTP+WS proxy so players can open the browser
console.log('[War of Tanks] Starting client proxy');
require('./client/proxy');
