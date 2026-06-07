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

// Prisma dev Postgres allows ~10 connections total — keep the app pool small locally.
const pool = new Pool({
  connectionString: databaseUrl,
  max: isLocalPrismaDev ? 3 : 10,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: isLocalPrismaDev ? 15_000 : 5_000,
});
pool.on('error', (error) => {
  console.error('[prisma pool]', error.message);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = { prisma, pool };