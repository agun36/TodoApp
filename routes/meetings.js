var express = require('express');
var router = express.Router();
const { jsonOk, jsonError } = require('../shared/api-response.js');
const { requireAuth } = require('../shared/require-auth.js');
const { findUserById } = require('../shared/user.service.js');
const {
    listMeetingsForUser,
    createMeeting,
    deleteMeeting,
    resendMeetingNotification
} = require('../shared/meeting.service.js');

router.get('/', requireAuth, async function (req, res) {
    try {
        const user = await findUserById(req.auth.userId);
        if (!user) {
            return jsonError(res, 'Your session is no longer valid. Please sign in again.', 401);
        }

        const payload = await listMeetingsForUser(user.id);
        return jsonOk(res, { success: true, ...payload });
    } catch (error) {
        console.error('[meetings GET]', error);
        return jsonError(res, 'Failed to load meetings', 500);
    }
});

router.post('/', requireAuth, async function (req, res) {
    try {
        const user = await findUserById(req.auth.userId);
        if (!user) {
            return jsonError(res, 'Your session is no longer valid. Please sign in again.', 401);
        }

        const result = await createMeeting({
            userId: user.id,
            actorEmail: req.auth.email,
            projectId: req.body.projectId,
            title: req.body.title,
            description: req.body.description,
            meetingDays: req.body.meetingDays,
            meetingDay: req.body.meetingDay,
            meetingTime: req.body.meetingTime
        });

        const sentCount = result.notifyResult.results.filter(function (row) { return row.sent; }).length;
        const skipped = result.notifyResult.results.every(function (row) { return row.skipped; });

        return jsonOk(res, {
            success: true,
            message: skipped
                ? 'Meeting created. Configure SMTP in .env to send email notifications.'
                : `Meeting created and ${sentCount} team member(s) notified.`,
            meeting: result.meeting,
            notifyResult: result.notifyResult
        }, 201);
    } catch (error) {
        if (error.status) return jsonError(res, error.message, error.status);
        console.error('[meetings POST]', error);
        return jsonError(res, 'Failed to create meeting', 500);
    }
});

router.post('/:id/notify', requireAuth, async function (req, res) {
    try {
        const user = await findUserById(req.auth.userId);
        if (!user) {
            return jsonError(res, 'Your session is no longer valid. Please sign in again.', 401);
        }

        const result = await resendMeetingNotification(req.params.id, user.id, req.auth.email);
        if (!result) return jsonError(res, 'Meeting not found', 404);

        const sentCount = result.notifyResult.results.filter(function (row) { return row.sent; }).length;
        const skipped = result.notifyResult.results.every(function (row) { return row.skipped; });

        return jsonOk(res, {
            success: true,
            message: skipped
                ? 'SMTP is not configured — no emails were sent.'
                : `Reminder sent to ${sentCount} team member(s).`,
            meeting: result.meeting,
            notifyResult: result.notifyResult
        });
    } catch (error) {
        if (error.status) return jsonError(res, error.message, error.status);
        console.error('[meetings notify POST]', error);
        return jsonError(res, 'Failed to send notifications', 500);
    }
});

router.delete('/:id', requireAuth, async function (req, res) {
    try {
        const user = await findUserById(req.auth.userId);
        if (!user) {
            return jsonError(res, 'Your session is no longer valid. Please sign in again.', 401);
        }

        const meeting = await deleteMeeting(req.params.id, user.id);
        if (!meeting) return jsonError(res, 'Meeting not found', 404);

        return jsonOk(res, { success: true, message: 'Meeting removed', meeting });
    } catch (error) {
        if (error.status) return jsonError(res, error.message, error.status);
        console.error('[meetings DELETE]', error);
        return jsonError(res, 'Failed to delete meeting', 500);
    }
});

module.exports = router;
