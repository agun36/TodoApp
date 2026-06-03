#!/usr/bin/env node
if (!process.env.RENDER && process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const { execSync } = require('child_process');
const { Client } = require('pg');
const { getDatabaseUrl } = require('../shared/database-url.js');

process.env.DATABASE_URL = getDatabaseUrl();

try {
  const { hostname } = new URL(process.env.DATABASE_URL);
  console.log('[migrate] database host:', hostname);
} catch (_) {}

function runPrisma(args, label) {
  console.log('[migrate]', label);
  try {
    const output = execSync('npx prisma ' + args, {
      encoding: 'utf8',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    });
    if (output) process.stdout.write(output);
    return output;
  } catch (err) {
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
    throw err;
  }
}

async function testConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
    console.log('[migrate] database connection OK');
  } finally {
    await client.end();
  }
}

async function userTableExists() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'User'
      ) AS exists`
    );
    return result.rows[0].exists;
  } finally {
    await client.end();
  }
}

function failedMigrationNames(statusOutput) {
  const names = new Set();
  const re = /migration [`']([^`']+)[`']|The `([^`]+)` migration/gi;
  let match;
  while ((match = re.exec(statusOutput)) !== null) {
    if (match[1]) names.add(match[1]);
    if (match[2]) names.add(match[2]);
  }
  return [...names].filter(function (name) {
    return name.startsWith('20');
  });
}

async function recoverFailedMigrations() {
  let status = '';
  try {
    status = runPrisma('migrate status', 'checking migration status');
  } catch (err) {
    status = (err.stdout || '') + (err.stderr || '');
  }

  if (!/failed/i.test(status)) {
    return false;
  }

  const failed = failedMigrationNames(status);
  if (failed.length === 0) {
    console.error('[migrate] failed migrations detected but could not parse names');
    return false;
  }

  const hasUser = await userTableExists();
  console.log('[migrate] recovering:', failed.join(', '), '| User table:', hasUser);

  for (const name of failed) {
    const action = hasUser ? 'applied' : 'rolled-back';
    runPrisma('migrate resolve --' + action + ' ' + name, 'resolve --' + action + ' ' + name);
  }

  return true;
}

async function withRetries(fn, label, attempts) {
  const max = attempts || 3;
  let lastError;
  for (let i = 1; i <= max; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.error('[migrate]', label, 'attempt', i + '/' + max, 'failed:', err.message);
      if (i < max) {
        console.log('[migrate] retrying in 5s (Render Postgres may be waking up)...');
        await new Promise(function (resolve) {
          setTimeout(resolve, 5000);
        });
      }
    }
  }
  throw lastError;
}

async function main() {
  await withRetries(testConnection, 'connection test');

  try {
    await withRetries(function () {
      runPrisma('migrate deploy', 'prisma migrate deploy');
    }, 'migrate deploy');
    return;
  } catch (firstError) {
    console.error('[migrate] deploy failed, attempting recovery...');
  }

  const recovered = await recoverFailedMigrations();
  if (!recovered) {
    process.exit(1);
  }

  runPrisma('migrate deploy', 'prisma migrate deploy (after recovery)');
}

main().catch(function (err) {
  console.error('[migrate] fatal:', err.message);
  process.exit(1);
});
