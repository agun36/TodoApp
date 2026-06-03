/**
 * Normalizes DATABASE_URL for Prisma and pg (Render, local, etc.).
 */
function isProductionRuntime() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.RENDER === 'true' ||
    Boolean(process.env.RENDER_SERVICE_ID)
  );
}

function getDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw || !String(raw).trim()) {
    throw new Error(
      'DATABASE_URL is not set. On Render: open your Postgres service, copy the Internal Database URL, and set it on the web service (or link the database so Render sets DATABASE_URL automatically).'
    );
  }

  let url = String(raw).trim().replace(/^["']|["']$/g, '');

  if (isProductionRuntime()) {
    try {
      const { hostname } = new URL(url);
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        throw new Error(
          'DATABASE_URL points to localhost, which cannot work on Render. Replace it with the Internal Database URL from your Render PostgreSQL service (host looks like dpg-xxxxx-a, not localhost).'
        );
      }
    } catch (err) {
      if (err.message.includes('localhost')) throw err;
    }
  }

  if (url.startsWith('postgres://')) {
    url = 'postgresql://' + url.slice('postgres://'.length);
  }

  if (!url.startsWith('postgresql://')) {
    const scheme = url.includes(':') ? url.split(':')[0] : '(no scheme)';
    throw new Error(
      `DATABASE_URL must start with postgresql:// or postgres:// (got "${scheme}:"). Use Render's Internal Database URL, not the hostname alone.`
    );
  }

  if (!url.includes('sslmode=')) {
    try {
      const parsed = new URL(url);
      // External Render URLs; internal dpg-* hosts work without forcing SSL
      if (parsed.hostname.includes('render.com')) {
        parsed.searchParams.set('sslmode', 'require');
        return parsed.toString();
      }
    } catch (_) {
      // keep url as-is if parsing fails
    }
  }

  return url;
}

module.exports = { getDatabaseUrl };
