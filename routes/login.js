var express = require('express');
var router = express.Router();
const { prisma } = require('../shared/prisma.service.js');

// GET login page
router.get('/', function (req, res) {
  if (req.query.signup) {
    return res.redirect('/signup');
  }
  res.render('login', { message: '', isSignup: false, formAction: '/login' });
});

// POST login form
router.post('/', async function (req, res) {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.password !== password) {
      return res.render('login', {
        message: 'Invalid email or password',
        isSignup: false,
        formAction: '/login'
      });
    }
    req.session.userId = user.id;
    req.session.email = user.email;
    return res.redirect('/todos');
  } catch (error) {
    console.error(error);
    res.render('login', { message: 'An error occurred', isSignup: false, formAction: '/login' });
  }
});

// Logout
router.get('/logout', function (req, res) {
  req.session.destroy((err) => {
    if (err) {
      return res.send('Error logging out');
    }
    res.redirect('/login');
  });
});

module.exports = router;