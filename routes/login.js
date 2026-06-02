var express = require('express');
var router = express.Router();
const { prisma } = require('../shared/prisma.service.js');

// GET login page
router.get('/', function (req, res) {
  res.render('login', { message: '', isSignup: req.query.signup ? true : false });
});

// POST login form
router.post('/', async function (req, res) {
  try {
    const { email, password, isSignup } = req.body;

    if (isSignup === 'true') {
      // Signup
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.render('login', { message: 'User already exists', isSignup: true });
      }
      const newUser = await prisma.user.create({
        data: { email, password }
      });
      req.session.userId = newUser.id;
      req.session.email = newUser.email;
      return res.redirect('/todos');
    } else {
      // Login
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.password !== password) {
        return res.render('login', { message: 'Invalid email or password', isSignup: false });
      }
      req.session.userId = user.id;
      req.session.email = user.email;
      return res.redirect('/todos');
    }
  } catch (error) {
    console.error(error);
    res.render('login', { message: 'An error occurred', isSignup: false });
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