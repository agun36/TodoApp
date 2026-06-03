var express = require('express');
var router = express.Router();
const { prisma } = require('../shared/prisma.service.js');

// GET signup page
router.get('/', function (req, res) {
  res.render('login', { message: '', isSignup: true, formAction: '/signup' });
});

// POST signup form
router.post('/', async function (req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('login', {
        message: 'Email and password are required',
        isSignup: true,
        formAction: '/signup'
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
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
    return res.redirect('/todos');
  } catch (error) {
    console.error(error);
    res.render('login', {
      message: 'An error occurred',
      isSignup: true,
      formAction: '/signup'
    });
  }
});

module.exports = router;
