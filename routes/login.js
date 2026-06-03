var express = require('express');
var router = express.Router();
const { prisma } = require('../shared/prisma.service.js');
const { wantsJson, jsonOk, jsonError } = require('../shared/api-response.js');
const { createToken } = require('../shared/auth-token.js');

// GET login page
router.get('/', function (req, res) {
  if (req.query.signup) {
    return res.redirect('/signup');
  }
  if (wantsJson(req)) {
    return jsonOk(res, {
      message: 'POST with email and password to log in',
      fields: ['email', 'password'],
      auth: 'JSON response includes a bearer token; use Authorization: Bearer <token>'
    });
  }
  res.render('login', { message: '', isSignup: false, formAction: '/login' });
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
    req.session.userId = user.id;
    req.session.email = user.email;
    if (wantsJson(req)) {
      return jsonOk(res, {
        message: 'Logged in',
        user: { id: user.id, email: user.email },
        token: createToken(user.id, user.email)
      });
    }
    return res.redirect('/todos');
  } catch (error) {
    console.error(error);
    if (wantsJson(req)) {
      return jsonError(res, 'An error occurred', 500);
    }
    res.render('login', { message: 'An error occurred', isSignup: false, formAction: '/login' });
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
