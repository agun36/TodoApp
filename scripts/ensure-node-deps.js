#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VENDOR_DIR = path.join(__dirname, 'vendor');

const FILE_PATCHES = [
  {
    name: 'debug',
    vendorFile: path.join(VENDOR_DIR, 'debug-common.js'),
    target: path.join(ROOT, 'node_modules', 'debug', 'src', 'common.js'),
  },
  {
    name: 'mime-types',
    vendorFile: path.join(VENDOR_DIR, 'mimeScore.js'),
    target: path.join(ROOT, 'node_modules', 'mime-types', 'mimeScore.js'),
  },
];

const DIR_PATCHES = [
  {
    name: 'path-to-regexp',
    vendorDir: path.join(VENDOR_DIR, 'path-to-regexp-dist'),
    targetDir: path.join(ROOT, 'node_modules', 'path-to-regexp', 'dist'),
  },
];

for (const patch of FILE_PATCHES) {
  if (!fs.existsSync(patch.vendorFile)) {
    console.error('[deps] missing vendor file:', patch.vendorFile);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(patch.target), { recursive: true });
  fs.copyFileSync(patch.vendorFile, patch.target);
  console.log('[deps] patched', patch.name);
}

for (const patch of DIR_PATCHES) {
  if (!fs.existsSync(patch.vendorDir)) {
    console.error('[deps] missing vendor dir:', patch.vendorDir);
    process.exit(1);
  }
  fs.mkdirSync(patch.targetDir, { recursive: true });
  for (const file of fs.readdirSync(patch.vendorDir)) {
    fs.copyFileSync(
      path.join(patch.vendorDir, file),
      path.join(patch.targetDir, file)
    );
  }
  console.log('[deps] patched', patch.name);
}

if (process.env.CHECK_EXPRESS === '1') {
  try {
    require('express');
    console.log('[deps] express OK');
  } catch (err) {
    console.error('[deps] express failed:', err.message);
    process.exit(1);
  }
}

console.log('[deps] done');
