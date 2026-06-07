var express = require('express');
var router = express.Router();
const { prisma } = require('../shared/prisma.service.js');
const { wantsJson, jsonOk, jsonError } = require('../shared/api-response.js');
const { requireAuth } = require('../shared/require-auth.js');
const { serializeUser } = require('../shared/user.service.js');
const {
    findValidInviteByToken,
    serializeInvitePublic,
    acceptInvite
} = require('../shared/invite.service.js');
const { serializeWorkspace } = require('../shared/workspace.service.js');

router.get('/:token', async function (req, res) {
    try {
        const result = await findValidInviteByToken(req.params.token);
        if (!result) {
            return jsonError(res, 'Invite not found', 404);
        }

        const existingUser = await prisma.user.findFirst({
            where: { email: { equals: result.invite.email, mode: 'insensitive' } },
            select: { id: true, email: true, name: true }
        });

        const payload = {
            invite: serializeInvitePublic(result.invite, result.invite.workspace, result.invite.invitedBy),
            status: result.status,
            hasAccount: !!existingUser,
            workspace: serializeWorkspace(result.invite.workspace)
        };

        if (wantsJson(req)) {
            return jsonOk(res, payload);
        }

        return res.redirect('/invite/' + req.params.token);
    } catch (error) {
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

router.post('/:token/join', requireAuth, async function (req, res) {
    try {
        const result = await findValidInviteByToken(req.params.token);
        if (!result) {
            return jsonError(res, 'Invite not found', 404);
        }
        if (result.status === 'expired') {
            return jsonError(res, 'This invite has expired', 410);
        }
        if (result.status === 'accepted') {
            return jsonError(res, 'This invite was already used', 409);
        }

        const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
        if (!user) return jsonError(res, 'User not found', 404);

        const inviteEmail = result.invite.email.toLowerCase();
        if (user.email.toLowerCase() !== inviteEmail) {
            return jsonError(res, 'Sign in with ' + result.invite.email + ' to accept this invite', 403);
        }

        await acceptInvite(result.invite, user.id);

        const workspace = result.invite.workspace;
        return jsonOk(res, {
            message: 'You joined ' + workspace.name,
            workspace: serializeWorkspace(workspace),
            user: serializeUser(user)
        });
    } catch (error) {
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

module.exports = router;
