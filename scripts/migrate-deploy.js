#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Client } = require('pg');
const { getDatabaseUrl } = require('../shared/database-url.js');

if (!process.env.RENDER && process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const PRISMA_CLI = path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');
const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');

function getRequiredMigrations() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(function (name) {
      return /^\d{14}_/.test(name)
        && fs.existsSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'));
    })
    .sort();
}

const REQUIRED_MIGRATIONS = getRequiredMigrations();

process.env.DATABASE_URL = getDatabaseUrl();

try {
  const { hostname } = new URL(process.env.DATABASE_URL);
  console.log('[migrate] database host:', hostname);
} catch (_) {}

function runPrisma(args, label) {
  console.log('[migrate]', label);
  try {
    const output = execSync('node ' + JSON.stringify(PRISMA_CLI) + ' ' + args, {
      encoding: 'utf8',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    });
    if (output) process.stdout.write(output);
    return output;
  } catch (err) {
    console.error('[migrate] prisma exit code:', err.status);
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
    throw err;
  }
}

function pgClient() {
  return new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  });
}

async function testConnection() {
  const client = pgClient();
  try {
    await client.connect();
    await client.query('SELECT 1');
    console.log('[migrate] database connection OK');
  } finally {
    await client.end();
  }
}

async function getAppliedMigrations() {
  const client = pgClient();
  await client.connect();
  try {
    const result = await client.query(
      `SELECT migration_name FROM "_prisma_migrations"
       WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
    );
    return result.rows.map(function (row) {
      return row.migration_name;
    });
  } catch (err) {
    if (err.code === '42P01') return [];
    throw err;
  } finally {
    await client.end();
  }
}

async function migrationsUpToDate() {
  const applied = await getAppliedMigrations();
  const ok = REQUIRED_MIGRATIONS.every(function (name) {
    return applied.includes(name);
  });
  if (ok) {
    console.log('[migrate] applied migrations:', applied.join(', '));
  }
  return ok;
}

async function userTableExists() {
  const client = pgClient();
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

async function main() {
  await testConnection();

  console.log('[migrate] required:', REQUIRED_MIGRATIONS.join(', '));

  if (await migrationsUpToDate()) {
    console.log('[migrate] all migrations applied, skipping migrate deploy');
    return;
  }

  try {
    runPrisma('migrate deploy', 'prisma migrate deploy');
    return;
  } catch (firstError) {
    console.error('[migrate] deploy failed, attempting recovery...');
  }

  if (await migrationsUpToDate()) {
    console.log('[migrate] schema up to date after partial deploy');
    return;
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
