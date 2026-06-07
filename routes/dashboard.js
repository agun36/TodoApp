const express = require('express');
const router = express.Router();
const { wantsJson, jsonOk, jsonError } = require('../shared/api-response.js');
const { requireAuth } = require('../shared/require-auth.js');
const { getDashboardData } = require('../shared/dashboard.service.js');

router.get('/', requireAuth, async function (req, res) {
    try {
        const data = await getDashboardData(req.auth.userId, {
            activityPage: req.query.activityPage,
            activityLimit: req.query.activityLimit
        });

        if (wantsJson(req)) {
            return jsonOk(res, data);
        }

        return res.render('dashboard', {
            title: 'Dashboard',
            email: req.auth.email,
            ...data
        });
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
