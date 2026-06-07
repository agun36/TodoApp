if (!process.env.RENDER && process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var cors = require('cors');
var logger = require('morgan');
var session = require('express-session');

var usersRouter = require('./routes/users.js');
var loginRouter = require('./routes/login.js');
var signupRouter = require('./routes/signup.js');
var todosRouter = require('./routes/todos.js');
var projectsRouter = require('./routes/projects.js');
var dashboardRouter = require('./routes/dashboard.js');
var inviteRouter = require('./routes/invite.js');
var onboardingRouter = require('./routes/onboarding.js');
var groupsRouter = require('./routes/groups.js');
var messagesRouter = require('./routes/messages.js');
var meetingsRouter = require('./routes/meetings.js');
var { startScheduler } = require('./shared/cron.service.js');
var { wantsJson, jsonError } = require('./shared/api-response.js');

var app = express();

var sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV !== 'production') {
  sessionSecret = 'dev-session-secret';
}
if (!sessionSecret) {
  throw new Error('SESSION_SECRET is required in production');
}

var corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map(function (origin) { return origin.trim(); })
  .filter(Boolean);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.set('etag', false);

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(logger('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/users', usersRouter);
app.use('/login', loginRouter);
app.use('/signup', signupRouter);
app.use('/todos', todosRouter);
app.use('/projects', projectsRouter);
app.use('/dashboard', dashboardRouter);
app.use('/invite', inviteRouter);
app.use('/onboarding', onboardingRouter);
app.use('/groups', groupsRouter);
app.use('/messages', messagesRouter);
app.use('/meetings', meetingsRouter);

if (process.env.NODE_ENV !== 'test') {
  startScheduler();
}

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  var status = err.status || 500;
  if (wantsJson(req)) {
    return jsonError(res, err.message || 'Server error', status);
  }
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(status);
  res.render('error');
});

module.exports = app;

if (require.main === module) {
  var port = process.env.PORT || 3000;
  app.listen(port, function () {
    console.log('Server is running on port ' + port);
  });
}
