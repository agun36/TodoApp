/**
 * Normalizes DATABASE_URL for Prisma and pg (Render, local, etc.).
 */
function getDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw || !String(raw).trim()) {
    throw new Error(
      'DATABASE_URL is not set. On Render: create a PostgreSQL database, then link it to this web service (or paste the Internal Database URL into DATABASE_URL).'
    );
  }

  let url = String(raw).trim().replace(/^["']|["']$/g, '');

  if (url.startsWith('postgres://')) {
    url = 'postgresql://' + url.slice('postgres://'.length);
  }

  if (!url.startsWith('postgresql://')) {
    const scheme = url.includes(':') ? url.split(':')[0] : '(no scheme)';
    throw new Error(
      `DATABASE_URL must start with postgresql:// or postgres:// (got "${scheme}:"). Use Render's Internal Database URL, not the hostname alone.`
    );
  }

  return url;
}

module.exports = { getDatabaseUrl };
