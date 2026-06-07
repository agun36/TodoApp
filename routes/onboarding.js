var express = require('express');
var router = express.Router();
const { wantsJson, jsonOk, jsonError } = require('../shared/api-response.js');
const { requireAuth } = require('../shared/require-auth.js');
const { findUserById, serializeUser, isInvitedWorkspaceMember } = require('../shared/user.service.js');
const {
    createWorkspaceForOwner,
    getWorkspaceForOwner,
    serializeWorkspace,
    ownerNeedsOnboarding
} = require('../shared/workspace.service.js');

router.get('/status', requireAuth, async function (req, res) {
    try {
        const user = await findUserById(req.auth.userId);
        if (!user) return jsonError(res, 'User not found', 404);

        const workspace = await getWorkspaceForOwner(user.id);
        const needsOnboarding = await ownerNeedsOnboarding(user);

        return jsonOk(res, {
            needsOnboarding,
            workspace: serializeWorkspace(workspace),
            user: serializeUser(user)
        });
    } catch (error) {
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

router.post('/', requireAuth, async function (req, res) {
    try {
        const user = await findUserById(req.auth.userId);
        if (!user) return jsonError(res, 'User not found', 404);
        if (await isInvitedWorkspaceMember(user.id)) {
            return jsonError(res, 'Only the workspace owner completes onboarding', 403);
        }

        const existing = await getWorkspaceForOwner(user.id);
        if (existing) {
            return jsonOk(res, {
                message: 'Workspace already set up',
                workspace: serializeWorkspace(existing),
                user: serializeUser(user)
            });
        }

        const name = String(req.body.workspaceName || req.body.name || '').trim();
        const teamType = String(req.body.teamType || '').trim() || null;
        const teamSize = String(req.body.teamSize || '').trim() || null;
        const primaryUse = String(req.body.primaryUse || '').trim() || null;

        if (!name) {
            return jsonError(res, 'Workspace name is required', 400);
        }
        if (!teamType) {
            return jsonError(res, 'Team type is required', 400);
        }
        if (!teamSize) {
            return jsonError(res, 'Team size is required', 400);
        }
        if (!primaryUse) {
            return jsonError(res, 'Primary use is required', 400);
        }

        const workspace = await createWorkspaceForOwner(user.id, {
            name,
            teamType,
            teamSize,
            primaryUse
        });

        return jsonOk(res, {
            message: 'Workspace created',
            workspace: serializeWorkspace(workspace),
            user: serializeUser(user)
        }, 201);
    } catch (error) {
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

module.exports = router;
