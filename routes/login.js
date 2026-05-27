
var express = require('express');
var router = express.Router();

// GET login page
router.get('/', function(req, res, next) {
	res.render('login', { message: '' });
});

// POST login form
router.post('/', function(req, res, next) {
 const { username, password } = req.body;
 if (username === 'admin' && password === 'password') {
   res.redirect('/'); // Redirect to home page on successful login
 } else {
   res.render('login', { message: 'Invalid username or password' }); // Show error message on failed login
 }
});

module.exports = router;

