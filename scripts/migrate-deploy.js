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

function run(cmd, options = {}) {
  return execSync(cmd, {
    encoding: 'utf8',
    stdio: options.silent ? 'pipe' : 'inherit',
    env: process.env,
    ...options,
  });
}

async function userTableExists() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
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

function getMigrateStatus() {
  try {
    return run('npx prisma migrate status', { silent: true });
  } catch (err) {
    return (err.stdout || '') + (err.stderr || '');
  }
}

function failedMigrationNames(statusOutput) {
  const names = new Set();
  const re = /migration [`']([^`']+)[`'] (?:failed|could not be applied)|Following migrations? have failed:\s*[\s\S]*?(\d{14}_[\w-]+)/gi;
  let match;
  while ((match = re.exec(statusOutput)) !== null) {
    if (match[1]) names.add(match[1]);
    if (match[2]) names.add(match[2]);
  }
  if (statusOutput.includes('20250601000000_init')) names.add('20250601000000_init');
  if (statusOutput.includes('20260602160541_add_recurrence')) {
    names.add('20260602160541_add_recurrence');
  }
  return [...names];
}

async function recoverFailedMigrations() {
  const status = getMigrateStatus();
  if (!/failed/i.test(status)) {
    return false;
  }

  const failed = failedMigrationNames(status);
  if (failed.length === 0) {
    return false;
  }

  const hasUser = await userTableExists();
  console.log('[migrate] recovering failed migrations:', failed.join(', '));
  console.log('[migrate] User table exists:', hasUser);

  for (const name of failed) {
    const action = hasUser ? 'applied' : 'rolled-back';
    console.log('[migrate] prisma migrate resolve --' + action, name);
    run('npx prisma migrate resolve --' + action + ' ' + name, { silent: false });
  }

  return true;
}

async function main() {
  try {
    run('npx prisma migrate deploy');
    return;
  } catch (firstError) {
    const detail = firstError.stderr || firstError.stdout || firstError.message || '';
    if (detail) console.error(detail);
    console.error('[migrate] deploy failed, attempting recovery...');
  }

  const recovered = await recoverFailedMigrations();
  if (!recovered) {
    console.error('[migrate] no failed migrations to recover; see status above');
    process.exit(1);
  }

  try {
    run('npx prisma migrate deploy');
  } catch (secondError) {
    console.error('[migrate] deploy failed after recovery');
    try {
      run('npx prisma migrate status');
    } catch (_) {}
    process.exit(1);
  }
}

main().catch(function (err) {
  console.error('[migrate]', err.message);
  process.exit(1);
});
