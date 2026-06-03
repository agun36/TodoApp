#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VENDOR_DIR = path.join(__dirname, 'vendor');

const FILE_PATCHES = [
  ['debug', 'debug-common.js', 'node_modules/debug/src/common.js'],
  ['mime-types', 'mimeScore.js', 'node_modules/mime-types/mimeScore.js'],
];

const PACKAGE_PATCHES = [
  ['path-to-regexp', 'path-to-regexp-dist', 'node_modules/path-to-regexp/dist'],
  ['iconv-lite', 'iconv-lite', 'node_modules/iconv-lite'],
];

function copyFile(vendorFile, targetFile) {
  if (!fs.existsSync(vendorFile)) {
    throw new Error('missing vendor file: ' + vendorFile);
  }
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.copyFileSync(vendorFile, targetFile);
}

function copyDir(vendorDir, targetDir) {
  if (!fs.existsSync(vendorDir)) {
    throw new Error('missing vendor dir: ' + vendorDir);
  }
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.cpSync(vendorDir, targetDir, { recursive: true });
}

for (const [name, vendorFile, targetRel] of FILE_PATCHES) {
  copyFile(path.join(VENDOR_DIR, vendorFile), path.join(ROOT, targetRel));
  console.log('[deps] patched', name);
}

for (const [name, vendorDir, targetRel] of PACKAGE_PATCHES) {
  copyDir(path.join(VENDOR_DIR, vendorDir), path.join(ROOT, targetRel));
  console.log('[deps] patched', name);
}

console.log('[deps] done');
