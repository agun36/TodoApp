var express = require('express');
var router = express.Router();
const { prisma } = require('../shared/prisma.service.js');
const { wantsJson, jsonOk, jsonError } = require('../shared/api-response.js');
const { createToken } = require('../shared/auth-token.js');
const { serializeUser, promoteAdminIfConfigured, normalizeInvitedMemberRole } = require('../shared/user.service.js');
const {
    serializeWorkspace,
    getWorkspaceForUser,
    listWorkspacesForUser,
    setActiveWorkspace,
    ownerNeedsOnboarding,
    redirectToFrontend
} = require('../shared/workspace.service.js');

// GET login page
router.get('/', function (req, res) {
  if (req.query.signup) {
    return redirectToFrontend(res, '/signup');
  }
  if (wantsJson(req)) {
    return jsonOk(res, {
      message: 'POST with email and password to log in',
      fields: ['email', 'password'],
      auth: 'JSON response includes a bearer token; use Authorization: Bearer <token>'
    });
  }
  return redirectToFrontend(res, '/login');
});

// POST login form
router.post('/', async function (req, res) {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.password !== password) {
      if (wantsJson(req)) {
        return jsonError(res, 'Invalid email or password', 401);
      }
      return res.render('login', {
        message: 'Invalid email or password',
        isSignup: false,
        formAction: '/login'
      });
    }
    const normalized = await normalizeInvitedMemberRole(user.id);
    const promoted = await promoteAdminIfConfigured(normalized.id, normalized.email);
    const activeUser = promoted || normalized;
    req.session.userId = activeUser.id;
    req.session.email = activeUser.email;
    const workspace = await getWorkspaceForUser(activeUser.id);
    const workspaces = await listWorkspacesForUser(activeUser.id);
    const needsOnboarding = await ownerNeedsOnboarding(activeUser);

    if (wantsJson(req)) {
      return jsonOk(res, {
        message: 'Logged in',
        user: serializeUser(activeUser),
        workspace: serializeWorkspace(workspace),
        workspaces,
        activeWorkspaceId: workspace?.id ?? null,
        needsOnboarding,
        token: createToken(activeUser.id, activeUser.email)
      });
    }
    const token = createToken(activeUser.id, activeUser.email);
    if (needsOnboarding) {
      return redirectToFrontend(res, '/onboarding#token=' + encodeURIComponent(token));
    }
    return redirectToFrontend(res, '/#token=' + encodeURIComponent(token));
  } catch (error) {
    console.error(error);
    const message =
      process.env.NODE_ENV === 'production'
        ? 'An error occurred'
        : (error instanceof Error ? error.message : 'An error occurred');
    if (wantsJson(req)) {
      return jsonError(res, message, 500);
    }
    res.render('login', { message, isSignup: false, formAction: '/login' });
  }
});

// Logout
router.get('/logout', function (req, res) {
  req.session.destroy((err) => {
    if (err) {
      if (wantsJson(req)) {
        return jsonError(res, 'Error logging out', 500);
      }
      return res.send('Error logging out');
    }
    if (wantsJson(req)) {
      return jsonOk(res, { message: 'Logged out' });
    }
    res.redirect('/login');
  });
});

module.exports = router;
