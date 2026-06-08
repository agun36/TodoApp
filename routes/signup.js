var express = require('express');
var router = express.Router();
const { prisma } = require('../shared/prisma.service.js');
const { wantsJson, jsonOk, jsonError } = require('../shared/api-response.js');
const { createToken } = require('../shared/auth-token.js');
const {
    serializeUser,
    resolveRoleForNewUser,
    acceptInviteForEmail,
    isSignupAllowed,
    normalizeEmail
} = require('../shared/user.service.js');
const { findValidInviteByToken } = require('../shared/invite.service.js');
const {
    serializeWorkspace,
    getWorkspaceForUser,
    ownerNeedsOnboarding,
    redirectToFrontend
} = require('../shared/workspace.service.js');

// GET signup page
router.get('/', function (req, res) {
  if (wantsJson(req)) {
    return jsonOk(res, {
      message: 'POST with email and password to sign up',
      fields: ['email', 'password', 'name', 'inviteToken'],
      auth: 'JSON response includes a bearer token; use Authorization: Bearer <token>'
    });
  }
  return redirectToFrontend(res, '/signup');
});

// POST signup form
router.post('/', async function (req, res) {
  try {
    const inviteToken = String(req.body.inviteToken || '').trim();
    let email = normalizeEmail(req.body.email);
    const password = req.body.password;
    const name = String(req.body.name || '').trim() || null;
    let inviteRecord = null;

    if (inviteToken) {
      const inviteResult = await findValidInviteByToken(inviteToken);
      if (!inviteResult || inviteResult.status === 'expired') {
        const message = 'This invite link has expired. Ask your admin for a new one.';
        if (wantsJson(req)) return jsonError(res, message, 410);
        return res.render('login', { message, isSignup: true, formAction: '/signup' });
      }
      if (inviteResult.status === 'accepted') {
        const message = 'This invite was already used. Sign in instead.';
        if (wantsJson(req)) return jsonError(res, message, 409);
        return res.render('login', { message, isSignup: true, formAction: '/signup' });
      }
      inviteRecord = inviteResult.invite;
      email = inviteRecord.email;
      if (!name) {
        const message = 'Your name is required';
        if (wantsJson(req)) return jsonError(res, message, 400);
        return res.render('login', { message, isSignup: true, formAction: '/signup' });
      }
    }

    if (!email || !password) {
      if (wantsJson(req)) {
        return jsonError(res, 'Email and password are required', 400);
      }
      return res.render('login', {
        message: 'Email and password are required',
        isSignup: true,
        formAction: '/signup'
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    });
    if (existingUser) {
      if (wantsJson(req)) {
        return jsonError(res, 'User already exists. Sign in and accept the invite.', 409);
      }
      return res.render('login', {
        message: 'User already exists. Sign in and accept the invite.',
        isSignup: true,
        formAction: '/signup'
      });
    }

    const pendingInvite = !inviteRecord
        ? await prisma.invite.findFirst({
            where: {
                email: { equals: email, mode: 'insensitive' },
                acceptedAt: null,
                expiresAt: { gt: new Date() }
            }
        })
        : null;
    const joiningViaInvite = !!(inviteRecord || pendingInvite);

    if (!joiningViaInvite && !(await isSignupAllowed(email))) {
      const message = 'A valid email address is required';
      if (wantsJson(req)) {
        return jsonError(res, message, 400);
      }
      return res.render('login', {
        message,
        isSignup: true,
        formAction: '/signup'
      });
    }

    const role = joiningViaInvite
        ? 'member'
        : await resolveRoleForNewUser(email, { joiningViaInvite: false });
    const newUser = await prisma.user.create({
      data: { email, password, role, name: joiningViaInvite ? name : null }
    });

    if (inviteRecord) {
      const { acceptInvite } = require('../shared/invite.service.js');
      await acceptInvite(inviteRecord, newUser.id);
    } else if (pendingInvite) {
      const { acceptInvite } = require('../shared/invite.service.js');
      await acceptInvite(pendingInvite, newUser.id);
    } else {
      await acceptInviteForEmail(email, newUser.id);
    }

    req.session.userId = newUser.id;
    req.session.email = newUser.email;
    const workspace = await getWorkspaceForUser(newUser.id);
    const needsOnboarding = await ownerNeedsOnboarding(newUser);

    if (wantsJson(req)) {
      return jsonOk(res, {
        message: 'Account created',
        user: serializeUser(newUser),
        workspace: serializeWorkspace(workspace),
        needsOnboarding,
        token: createToken(newUser.id, newUser.email)
      }, 201);
    }
    const token = createToken(newUser.id, newUser.email);
    if (needsOnboarding) {
      return redirectToFrontend(res, '/onboarding#token=' + encodeURIComponent(token));
    }
    return redirectToFrontend(res, '/#token=' + encodeURIComponent(token));
  } catch (error) {
    console.error(error);
    if (wantsJson(req)) {
      return jsonError(res, 'An error occurred', 500);
    }
    res.render('login', {
      message: 'An error occurred',
      isSignup: true,
      formAction: '/signup'
    });
  }
});

module.exports = router;
