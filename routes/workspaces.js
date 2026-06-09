var express = require('express');
var router = express.Router();
const { jsonOk, jsonError } = require('../shared/api-response.js');
const { requireAuth, getWorkspaceIdFromRequest } = require('../shared/require-auth.js');
const { findUserById } = require('../shared/user.service.js');
const {
    listWorkspacesForUser,
    setActiveWorkspace,
    serializeWorkspace,
    resolveWorkspaceForUser
} = require('../shared/workspace.service.js');

router.get('/', requireAuth, async function (req, res) {
    try {
        const user = await findUserById(req.auth.userId);
        if (!user) return jsonError(res, 'User not found', 404);

        const workspaces = await listWorkspacesForUser(user.id);
        const active = await resolveWorkspaceForUser(
            user.id,
            getWorkspaceIdFromRequest(req) || user.activeWorkspaceId
        );

        return jsonOk(res, {
            workspaces,
            activeWorkspaceId: active?.id ?? user.activeWorkspaceId ?? null,
            activeWorkspace: serializeWorkspace(active)
        });
    } catch (error) {
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

router.post('/active', requireAuth, async function (req, res) {
    try {
        const workspaceId = String(req.body.workspaceId || '').trim();
        if (!workspaceId) return jsonError(res, 'workspaceId is required', 400);

        const workspace = await setActiveWorkspace(req.auth.userId, workspaceId);
        const workspaces = await listWorkspacesForUser(req.auth.userId);

        return jsonOk(res, {
            message: 'Switched workspace',
            workspace: serializeWorkspace(workspace),
            workspaces,
            activeWorkspaceId: workspace.id
        });
    } catch (error) {
        console.error(error);
        return jsonError(res, error.message || 'An error occurred', error.status || 500);
    }
});

module.exports = router;
