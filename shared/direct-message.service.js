const { prisma } = require('./prisma.service.js');
const { getWorkspaceForUser } = require('./workspace.service.js');

const USER_SELECT = {
    id: true,
    email: true,
    name: true,
    avatarUrl: true,
    availability: true,
    statusMessage: true
};

function orderedParticipants(userIdA, userIdB) {
    if (userIdA === userIdB) {
        const error = new Error('You cannot start a chat with yourself');
        error.status = 400;
        throw error;
    }
    return userIdA < userIdB
        ? { participantA: userIdA, participantB: userIdB }
        : { participantA: userIdB, participantB: userIdA };
}

function otherParticipantId(conversation, userId) {
    return conversation.participantA === userId
        ? conversation.participantB
        : conversation.participantA;
}

function memberLabel(user, teamEmail) {
    if (user.name) return user.name;
    if (teamEmail) return teamEmail;
    return user.email;
}

async function assertWorkspaceMembers(workspaceId, userIds) {
    const memberships = await prisma.workspaceMember.findMany({
        where: {
            workspaceId,
            userId: { in: userIds }
        },
        include: {
            user: { select: USER_SELECT }
        }
    });

    const byUserId = new Map(memberships.map(function (row) {
        return [row.userId, row];
    }));

    for (const userId of userIds) {
        if (!byUserId.has(userId)) {
            const error = new Error('That person is not in your workspace');
            error.status = 404;
            throw error;
        }
    }

    return byUserId;
}

async function getConversationForUser(conversationId, userId) {
    const conversation = await prisma.directConversation.findUnique({
        where: { id: conversationId },
        include: {
            participantAUser: { select: USER_SELECT },
            participantBUser: { select: USER_SELECT }
        }
    });

    if (!conversation) return null;
    if (conversation.participantA !== userId && conversation.participantB !== userId) {
        return null;
    }

    return conversation;
}

function serializeDirectMessage(message) {
    const authorLabel = message.user?.name || message.user?.email || 'User';
    return {
        id: message.id,
        conversationId: message.conversationId,
        body: message.body,
        userId: message.userId,
        authorEmail: message.user?.email ?? null,
        authorName: message.user?.name ?? null,
        authorAvatarUrl: message.user?.avatarUrl ?? null,
        authorLabel,
        createdAt: message.createdAt
    };
}

async function serializeConversation(conversation, currentUserId) {
    const otherUserId = otherParticipantId(conversation, currentUserId);
    const membership = await prisma.workspaceMember.findUnique({
        where: {
            workspaceId_userId: {
                workspaceId: conversation.workspaceId,
                userId: otherUserId
            }
        },
        include: { user: { select: USER_SELECT } }
    });

    const otherUser = membership?.user
        || (conversation.participantA === otherUserId
            ? conversation.participantAUser
            : conversation.participantBUser);

    const lastMessage = await prisma.directMessage.findFirst({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: USER_SELECT } }
    });

    return {
        id: conversation.id,
        workspaceId: conversation.workspaceId,
        otherUser: {
            id: otherUser.id,
            email: otherUser.email,
            name: otherUser.name || null,
            avatarUrl: otherUser.avatarUrl || null,
            availability: otherUser.availability || 'available',
            statusMessage: otherUser.statusMessage || null,
            displayLabel: memberLabel(otherUser, membership?.teamEmail || null),
            teamEmail: membership?.teamEmail || null
        },
        lastMessage: lastMessage ? serializeDirectMessage(lastMessage) : null,
        updatedAt: conversation.updatedAt
    };
}

async function listConversationsForUser(userId, workspaceId) {
    const workspace = await getWorkspaceForUser(userId, workspaceId);
    if (!workspace) return [];

    const conversations = await prisma.directConversation.findMany({
        where: {
            workspaceId: workspace.id,
            OR: [{ participantA: userId }, { participantB: userId }]
        },
        include: {
            participantAUser: { select: USER_SELECT },
            participantBUser: { select: USER_SELECT }
        },
        orderBy: { updatedAt: 'desc' }
    });

    return Promise.all(conversations.map(function (conversation) {
        return serializeConversation(conversation, userId);
    }));
}

async function findOrCreateConversation(userId, recipientId, workspaceId) {
    const workspace = await getWorkspaceForUser(userId, workspaceId);
    if (!workspace) {
        const error = new Error('Workspace not found');
        error.status = 404;
        throw error;
    }

    await assertWorkspaceMembers(workspace.id, [userId, recipientId]);
    const pair = orderedParticipants(userId, recipientId);

    const conversation = await prisma.directConversation.upsert({
        where: {
            workspaceId_participantA_participantB: {
                workspaceId: workspace.id,
                participantA: pair.participantA,
                participantB: pair.participantB
            }
        },
        create: {
            workspaceId: workspace.id,
            participantA: pair.participantA,
            participantB: pair.participantB
        },
        update: {},
        include: {
            participantAUser: { select: USER_SELECT },
            participantBUser: { select: USER_SELECT }
        }
    });

    return serializeConversation(conversation, userId);
}

async function listDirectMessages(conversationId, userId) {
    const conversation = await getConversationForUser(conversationId, userId);
    if (!conversation) return null;

    const messages = await prisma.directMessage.findMany({
        where: { conversationId },
        include: { user: { select: USER_SELECT } },
        orderBy: { createdAt: 'asc' }
    });

    const serializedConversation = await serializeConversation(conversation, userId);

    return {
        conversation: serializedConversation,
        messages: messages.map(serializeDirectMessage)
    };
}

async function createDirectMessage(conversationId, userId, body) {
    const trimmed = String(body || '').trim();
    if (!trimmed) {
        const error = new Error('Message is required');
        error.status = 400;
        throw error;
    }

    const conversation = await getConversationForUser(conversationId, userId);
    if (!conversation) return null;

    const message = await prisma.directMessage.create({
        data: {
            conversationId,
            userId,
            body: trimmed
        },
        include: { user: { select: USER_SELECT } }
    });

    await prisma.directConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
    });

    return serializeDirectMessage(message);
}

module.exports = {
    listConversationsForUser,
    findOrCreateConversation,
    listDirectMessages,
    createDirectMessage
};
