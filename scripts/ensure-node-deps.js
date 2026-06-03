#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const VENDOR_DIR = path.join(__dirname, 'vendor');
const PATCHES = [
  {
    name: 'debug',
    vendorFile: 'debug-common.js',
    target: path.join('node_modules', 'debug', 'src', 'common.js'),
    verify: function () {
      require('debug')('todoapp:deps');
    },
  },
  {
    name: 'mime-types',
    vendorFile: 'mimeScore.js',
    target: path.join('node_modules', 'mime-types', 'mimeScore.js'),
    verify: function () {
      require('mime-types');
    },
  },
];

for (const patch of PATCHES) {
  const vendorPath = path.join(VENDOR_DIR, patch.vendorFile);
  const targetPath = path.join(__dirname, '..', patch.target);

  if (!fs.existsSync(vendorPath)) {
    console.error('[deps] missing vendor file:', vendorPath);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(vendorPath, targetPath);

  try {
    patch.verify();
    console.log('[deps]', patch.name, 'OK');
  } catch (err) {
    console.error('[deps]', patch.name, 'verify failed:', err.message);
    process.exit(1);
  }
}

try {
  require('express');
  console.log('[deps] express OK');
} catch (err) {
  console.error('[deps] express failed:', err.message);
  process.exit(1);
}
