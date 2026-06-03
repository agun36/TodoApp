#!/usr/bin/env node
require('dotenv').config();
const { spawnSync } = require('child_process');
const { getDatabaseUrl } = require('../shared/database-url.js');

function run(command, args) {
  console.log('[start]', command, args.join(' '));
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

try {
  getDatabaseUrl();
  console.log('[start] DATABASE_URL is set and looks valid');
} catch (err) {
  console.error('[start]', err.message);
  process.exit(1);
}

run('npx', ['prisma', 'migrate', 'deploy']);
run('node', ['./bin/www']);
