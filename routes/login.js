var express = require('express');
var router = express.Router();

// GET login page
router.get('/', function (req, res) {
  res.render('login', { message: '' });
});

// POST login form
router.post('/', function (req, res) {
  const { username, password } = req.body;

  // Replace this with real auth later
  if (username === 'tj' && password === 'foobar') {
    // Success - redirect somewhere other than login
    res.redirect('/dashboard');
  } else {
    res.render('login', { message: 'Invalid username or password' });
  }
});

module.exports = router;