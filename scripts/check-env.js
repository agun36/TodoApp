#!/usr/bin/env node
require('dotenv').config();
const { getDatabaseUrl } = require('../shared/database-url.js');

try {
  getDatabaseUrl();
  console.log('[env] DATABASE_URL is set and looks valid');
} catch (err) {
  console.error('[env]', err.message);
  process.exit(1);
}
