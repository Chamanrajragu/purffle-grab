// standalone.js — run PurffleGrab as a plain local web server (no Electron).
import { startServer } from './server.js';

const { port, downloadsRoot } = await startServer();
console.log(`\n  PurffleGrab is running →  http://localhost:${port}\n`);
console.log(`  Downloads saved to: ${downloadsRoot()}\n`);
