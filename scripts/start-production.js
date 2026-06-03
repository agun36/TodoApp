#!/usr/bin/env node
// On Render, env vars come from the dashboard — do not load local .env
if (!process.env.RENDER && process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const { spawnSync } = require('child_process');
const { getDatabaseUrl } = require('../shared/database-url.js');

function run(command, args) {
  console.log('[start]', command, args.join(' '));
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

process.env.DATABASE_URL = getDatabaseUrl();
console.log('[start] DATABASE_URL is set and looks valid');

run('node', ['./scripts/ensure-node-deps.js']);
run('node', ['./scripts/migrate-deploy.js']);
run('node', ['./app.js']);
