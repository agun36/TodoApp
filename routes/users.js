var express = require('express');
var router = express.Router();
const { prisma } = require('../shared/prisma.service.js');
const { wantsJson, jsonOk, jsonError } = require('../shared/api-response.js');
const { requireAuth } = require('../shared/require-auth.js');

/* GET users listing */
router.get('/', requireAuth, async function (req, res) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true },
      orderBy: { email: 'asc' }
    });

    if (wantsJson(req)) {
      return jsonOk(res, { users });
    }

    return res.render('users', { title: 'Users', users });
  } catch (error) {
    console.error(error);
    if (wantsJson(req)) {
      return jsonError(res, 'An error occurred', 500);
    }
    return res.status(500).render('error', {
      message: 'An error occurred',
      error: { status: 500, stack: '' }
    });
  }
});

module.exports = router;
