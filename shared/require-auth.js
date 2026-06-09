const { wantsJson, jsonError } = require('./api-response.js');
const { verifyToken, parseBearer } = require('./auth-token.js');

function resolveAuth(req) {
  const bearer = parseBearer(req);
  if (bearer) {
    const fromToken = verifyToken(bearer);
    if (fromToken) return fromToken;
    return { invalidToken: true };
  }
  if (req.session && req.session.userId) {
    return { userId: req.session.userId, email: req.session.email };
  }
  return null;
}

function requireAuth(req, res, next) {
  const auth = resolveAuth(req);
  if (auth && auth.invalidToken) {
    if (wantsJson(req)) {
      return jsonError(res, 'Invalid or expired bearer token', 401);
    }
    return res.redirect('/login');
  }
  if (!auth) {
    if (wantsJson(req)) {
      return jsonError(res, 'Not authenticated. Log in or sign up first.', 401);
    }
    return res.redirect('/login');
  }
  req.auth = auth;
  next();
}

function getWorkspaceIdFromRequest(req) {
    if (!req) return null;
    const header = req.headers && (req.headers['x-workspace-id'] || req.headers['X-Workspace-Id']);
    const fromHeader = String(header || '').trim();
    if (fromHeader) return fromHeader;
    const fromQuery = String(req.query?.workspaceId || '').trim();
    return fromQuery || null;
}

module.exports = { requireAuth, resolveAuth, getWorkspaceIdFromRequest };
