#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'debug', 'src', 'common.js');
const vendor = path.join(__dirname, 'vendor', 'debug-common.js');

if (!fs.existsSync(vendor)) {
  console.error('[patch-debug] missing vendor file:', vendor);
  process.exit(1);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(vendor, target);

try {
  require('debug')('todoapp:patch');
} catch (err) {
  console.error('[patch-debug] require(debug) failed:', err.message);
  process.exit(1);
}

console.log('[patch-debug] debug package OK');
