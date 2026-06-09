var express = require('express');
var router = express.Router();
const { jsonOk, jsonError } = require('../shared/api-response.js');
const { requireAuth } = require('../shared/require-auth.js');
const { findUserById, getWorkspaceRole } = require('../shared/user.service.js');
const { getWorkspaceForRequest, canCreateGroup } = require('../shared/workspace.service.js');
const {
    listGroupsForWorkspace,
    createGroup,
    deleteGroup,
    addPeopleToGroup,
    removePersonFromGroup,
    listGroupMessages,
    createGroupMessage
} = require('../shared/group.service.js');

async function requireWorkspaceContext(req, res) {
    const user = await findUserById(req.auth.userId);
    if (!user) {
        jsonError(res, 'User not found', 404);
        return null;
    }
    const workspace = await getWorkspaceForRequest(req);
    if (!workspace) {
        jsonError(res, 'Workspace not found', 404);
        return null;
    }
    const isOwner = workspace.ownerId === user.id;
    const role = await getWorkspaceRole(user.id, workspace);
    const canManage = role === 'owner' || role === 'admin';
    return { user, workspace, isOwner, canManage };
}

router.get('/', requireAuth, async function (req, res) {
    try {
        const ctx = await requireWorkspaceContext(req, res);
        if (!ctx) return;

        const groups = await listGroupsForWorkspace(ctx.workspace.id);
        return jsonOk(res, {
            groups,
            canManage: ctx.canManage
        });
    } catch (error) {
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

router.post('/', requireAuth, async function (req, res) {
    try {
        const ctx = await requireWorkspaceContext(req, res);
        if (!ctx) return;
        if (!ctx.canManage) {
            return jsonError(res, 'Only the workspace owner or an admin can create groups', 403);
        }

        const name = String(req.body.name || '').trim();
        if (!name) return jsonError(res, 'Group name is required', 400);

        const groupCapacity = await canCreateGroup(ctx.workspace);
        if (!groupCapacity.allowed) {
            return jsonError(res, groupCapacity.reason, 402);
        }

        const color = String(req.body.color || '#6366f1').trim() || '#6366f1';
        const group = await createGroup(ctx.workspace.id, { name, color });
        return jsonOk(res, { message: 'Group created', group }, 201);
    } catch (error) {
        if (error && error.code === 'P2002') {
            return jsonError(res, 'A group with that name already exists', 409);
        }
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

router.delete('/:groupId', requireAuth, async function (req, res) {
    try {
        const ctx = await requireWorkspaceContext(req, res);
        if (!ctx) return;
        if (!ctx.canManage) {
            return jsonError(res, 'Only the workspace owner or an admin can delete groups', 403);
        }

        const deleted = await deleteGroup(req.params.groupId, ctx.workspace.id);
        if (!deleted) return jsonError(res, 'Group not found', 404);

        return jsonOk(res, { message: 'Group deleted', id: deleted.id });
    } catch (error) {
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

router.post('/:groupId/members', requireAuth, async function (req, res) {
    try {
        const ctx = await requireWorkspaceContext(req, res);
        if (!ctx) return;
        if (!ctx.canManage) {
            return jsonError(res, 'Only the workspace owner or an admin can manage groups', 403);
        }

        const userIds = Array.isArray(req.body.userIds) ? req.body.userIds : [];
        const inviteIds = Array.isArray(req.body.inviteIds) ? req.body.inviteIds : [];
        if (userIds.length === 0 && inviteIds.length === 0) {
            return jsonError(res, 'Select at least one person to add', 400);
        }

        const result = await addPeopleToGroup(req.params.groupId, ctx.workspace.id, {
            userIds,
            inviteIds,
            actorId: req.auth.userId
        });
        if (!result) return jsonError(res, 'Group not found', 404);

        return jsonOk(res, {
            message: result.added.length ? 'Added to group' : 'No new people were added',
            group: result.group,
            added: result.added,
            skipped: result.skipped
        }, result.added.length ? 201 : 200);
    } catch (error) {
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

router.get('/:groupId/messages', requireAuth, async function (req, res) {
    try {
        const result = await listGroupMessages(req.params.groupId, req.auth.userId);
        if (!result) return jsonError(res, 'Group not found or you are not a member', 403);

        return jsonOk(res, result);
    } catch (error) {
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

router.post('/:groupId/messages', requireAuth, async function (req, res) {
    try {
        const body = String(req.body.body || '').trim();
        if (!body) return jsonError(res, 'Message is required', 400);

        const message = await createGroupMessage(req.params.groupId, req.auth.userId, body);
        if (!message) return jsonError(res, 'Group not found or you are not a member', 403);

        return jsonOk(res, { message: 'Message sent', chatMessage: message }, 201);
    } catch (error) {
        if (error && error.status === 400) {
            return jsonError(res, error.message, 400);
        }
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

router.delete('/:groupId/members', requireAuth, async function (req, res) {
    try {
        const ctx = await requireWorkspaceContext(req, res);
        if (!ctx) return;
        if (!ctx.canManage) {
            return jsonError(res, 'Only the workspace owner or an admin can manage groups', 403);
        }

        const userId = String(req.body.userId || req.query.userId || '').trim() || null;
        const inviteId = String(req.body.inviteId || req.query.inviteId || '').trim() || null;
        if (!userId && !inviteId) {
            return jsonError(res, 'userId or inviteId is required', 400);
        }

        const group = await removePersonFromGroup(req.params.groupId, ctx.workspace.id, {
            userId,
            inviteId
        });
        if (!group) return jsonError(res, 'Group not found', 404);

        return jsonOk(res, { message: 'Removed from group', group });
    } catch (error) {
        if (error && error.status === 400) {
            return jsonError(res, error.message, 400);
        }
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

module.exports = router;
