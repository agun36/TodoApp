var express = require('express');
var router = express.Router();
const { prisma } = require('../shared/prisma.service.js');
const { wantsJson, jsonOk, jsonError } = require('../shared/api-response.js');

// GET signup page
router.get('/', function (req, res) {
  if (wantsJson(req)) {
    return jsonOk(res, {
      message: 'POST with email and password to sign up',
      fields: ['email', 'password']
    });
  }
  res.render('login', { message: '', isSignup: true, formAction: '/signup' });
});

// POST signup form
router.post('/', async function (req, res) {
  try {
    const { email, password } = req.body;

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

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      if (wantsJson(req)) {
        return jsonError(res, 'User already exists', 409);
      }
      return res.render('login', {
        message: 'User already exists',
        isSignup: true,
        formAction: '/signup'
      });
    }

    const newUser = await prisma.user.create({
      data: { email, password }
    });
    req.session.userId = newUser.id;
    req.session.email = newUser.email;
    if (wantsJson(req)) {
      return jsonOk(res, {
        message: 'Account created',
        user: { id: newUser.id, email: newUser.email }
      }, 201);
    }
    return res.redirect('/todos');
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
