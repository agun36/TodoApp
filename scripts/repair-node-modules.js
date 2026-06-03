#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

const REQUIRED_FILES = [
  'node_modules/body-parser/lib/utils.js',
  'node_modules/debug/src/common.js',
  'node_modules/mime-types/mimeScore.js',
  'node_modules/path-to-regexp/dist/index.js',
  'node_modules/.prisma/client/default.js',
];

function isIncomplete() {
  return REQUIRED_FILES.some(function (rel) {
    return !fs.existsSync(path.join(ROOT, rel));
  });
}

if (!isIncomplete()) {
  console.log('[repair] node_modules looks complete');
  process.exit(0);
}

console.log('[repair] node_modules incomplete — running npm ci (may take 1–2 min)...');

execSync('npm ci', {
  cwd: ROOT,
  stdio: 'inherit',
  env: Object.assign({}, process.env, {
    NODE_ENV: 'development',
    NPM_CONFIG_PRODUCTION: 'false',
  }),
  timeout: 600000,
});

execSync('npx prisma generate', {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
});

if (isIncomplete()) {
  console.error('[repair] node_modules still incomplete after npm ci');
  process.exit(1);
}

console.log('[repair] node_modules repaired');
