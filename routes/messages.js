var express = require('express');
var router = express.Router();
const { jsonOk, jsonError } = require('../shared/api-response.js');
const { requireAuth, getWorkspaceIdFromRequest } = require('../shared/require-auth.js');
const {
    listConversationsForUser,
    findOrCreateConversation,
    listDirectMessages,
    createDirectMessage
} = require('../shared/direct-message.service.js');

router.get('/', requireAuth, async function (req, res) {
    try {
        const conversations = await listConversationsForUser(
            req.auth.userId,
            getWorkspaceIdFromRequest(req)
        );
        return jsonOk(res, { conversations });
    } catch (error) {
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

router.post('/', requireAuth, async function (req, res) {
    try {
        const recipientId = String(req.body.recipientId || '').trim();
        if (!recipientId) {
            return jsonError(res, 'recipientId is required', 400);
        }

        const conversation = await findOrCreateConversation(
            req.auth.userId,
            recipientId,
            getWorkspaceIdFromRequest(req)
        );
        return jsonOk(res, { message: 'Conversation ready', conversation }, 201);
    } catch (error) {
        if (error && error.status) {
            return jsonError(res, error.message, error.status);
        }
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

router.get('/:conversationId/messages', requireAuth, async function (req, res) {
    try {
        const result = await listDirectMessages(req.params.conversationId, req.auth.userId);
        if (!result) {
            return jsonError(res, 'Conversation not found', 404);
        }

        return jsonOk(res, result);
    } catch (error) {
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

router.post('/:conversationId/messages', requireAuth, async function (req, res) {
    try {
        const message = await createDirectMessage(
            req.params.conversationId,
            req.auth.userId,
            req.body.body
        );
        if (!message) {
            return jsonError(res, 'Conversation not found', 404);
        }

        return jsonOk(res, { message: 'Message sent', chatMessage: message }, 201);
    } catch (error) {
        if (error && error.status === 400) {
            return jsonError(res, error.message, 400);
        }
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

module.exports = router;
