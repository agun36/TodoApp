require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { getDatabaseUrl } = require('./database-url.js');

const databaseUrl = getDatabaseUrl();
const isLocalPrismaDev = (() => {
  try {
    const { hostname, port } = new URL(databaseUrl);
    return (hostname === 'localhost' || hostname === '127.0.0.1') && Number(port) >= 51200;
  } catch {
    return false;
  }
})();

// Cursor/Prisma local Postgres allows ~10 connections total — keep the app pool small.
const pool = new Pool({
  connectionString: databaseUrl,
  max: isLocalPrismaDev ? 2 : 10,
  idleTimeoutMillis: 3_000,
  connectionTimeoutMillis: isLocalPrismaDev ? 25_000 : 5_000,
  keepAlive: true,
});
pool.on('error', (error) => {
  console.error('[prisma pool]', error.message);
});

let poolClosed = false;
async function closePool() {
  if (poolClosed) return;
  poolClosed = true;
  try {
    await pool.end();
  } catch (error) {
    console.error('[prisma pool] close failed:', error.message);
  }
}

process.once('SIGINT', closePool);
process.once('SIGTERM', closePool);

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = { prisma, pool, closePool };