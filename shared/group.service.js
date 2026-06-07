const { prisma } = require('./prisma.service.js');
const { isWorkspaceOwner } = require('./user.service.js');

function memberLabel(user, teamEmail) {
    if (user.name) return user.name;
    if (teamEmail) return teamEmail;
    return user.email;
}

function serializeGroupEntry(entry, ownerId) {
    if (entry.kind === 'member') {
        const user = entry.user;
        const teamEmail = entry.teamEmail || null;
        return {
            kind: 'member',
            userId: user.id,
            inviteId: null,
            email: user.email,
            name: user.name || null,
            avatarUrl: user.avatarUrl || null,
            teamEmail,
            displayLabel: memberLabel(user, teamEmail),
            isOwner: ownerId != null && user.id === ownerId,
            pending: false
        };
    }

    const invite = entry.invite;
    return {
        kind: 'invite',
        userId: null,
        inviteId: invite.id,
        email: invite.email,
        name: null,
        teamEmail: null,
        displayLabel: invite.email,
        isOwner: false,
        pending: !invite.acceptedAt && invite.expiresAt > new Date()
    };
}

async function ensureWorkspaceOwnerInGroup(groupId, workspaceId) {
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { ownerId: true }
    });
    if (!workspace?.ownerId) return;

    await prisma.groupMember.upsert({
        where: { groupId_userId: { groupId, userId: workspace.ownerId } },
        create: { groupId, userId: workspace.ownerId },
        update: {}
    });
}

async function serializeGroup(group) {
    const workspace = await prisma.workspace.findUnique({
        where: { id: group.workspaceId },
        select: { ownerId: true }
    });
    const ownerId = workspace?.ownerId ?? null;

    const membershipRows = await prisma.workspaceMember.findMany({
        where: {
            workspaceId: group.workspaceId,
            userId: { in: group.members.map(function (m) { return m.userId; }) }
        },
        select: { userId: true, teamEmail: true }
    });
    const teamEmailByUser = new Map(
        membershipRows.map(function (row) { return [row.userId, row.teamEmail || null]; })
    );

    const entries = [
        ...group.members.map(function (row) {
            return serializeGroupEntry({
                kind: 'member',
                user: row.user,
                teamEmail: teamEmailByUser.get(row.userId) || null
            }, ownerId);
        }),
        ...group.inviteLinks.map(function (row) {
            return serializeGroupEntry({ kind: 'invite', invite: row.invite }, ownerId);
        })
    ];

    return {
        id: group.id,
        workspaceId: group.workspaceId,
        name: group.name,
        color: group.color,
        createdAt: group.createdAt,
        members: entries,
        memberCount: entries.length
    };
}

const groupInclude = {
    members: {
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
        orderBy: { user: { email: 'asc' } }
    },
    inviteLinks: {
        include: { invite: true },
        orderBy: { invite: { email: 'asc' } }
    }
};

function serializeGroupMessagePreview(message) {
    const isSystem = message.kind === 'system';
    const authorLabel = isSystem ? 'System' : (message.user?.name || message.user?.email || 'User');

    return {
        id: message.id,
        groupId: message.groupId,
        kind: message.kind || 'user',
        isSystem,
        body: message.body,
        userId: message.userId,
        authorLabel,
        createdAt: message.createdAt
    };
}

async function loadLatestMessagesByGroupId(groupIds) {
    if (!groupIds.length) return new Map();

    const messages = await prisma.groupMessage.findMany({
        where: { groupId: { in: groupIds } },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } }
    });

    const latestByGroupId = new Map();
    for (const message of messages) {
        if (!latestByGroupId.has(message.groupId)) {
            latestByGroupId.set(message.groupId, message);
        }
    }
    return latestByGroupId;
}

async function listGroupsForWorkspace(workspaceId) {
    const groups = await prisma.workspaceGroup.findMany({
        where: { workspaceId },
        include: groupInclude,
        orderBy: { name: 'asc' }
    });
    await Promise.all(groups.map(function (group) {
        return ensureWorkspaceOwnerInGroup(group.id, workspaceId);
    }));
    const refreshed = await prisma.workspaceGroup.findMany({
        where: { workspaceId },
        include: groupInclude,
        orderBy: { name: 'asc' }
    });
    const serialized = await Promise.all(refreshed.map(serializeGroup));
    const latestByGroupId = await loadLatestMessagesByGroupId(serialized.map(function (group) {
        return group.id;
    }));

    return serialized.map(function (group) {
        const message = latestByGroupId.get(group.id);
        return {
            ...group,
            lastMessage: message ? serializeGroupMessagePreview(message) : null
        };
    });
}

async function getGroupForWorkspace(groupId, workspaceId) {
    await ensureWorkspaceOwnerInGroup(groupId, workspaceId);
    const group = await prisma.workspaceGroup.findFirst({
        where: { id: groupId, workspaceId },
        include: groupInclude
    });
    if (!group) return null;
    return serializeGroup(group);
}

async function createGroup(workspaceId, { name, color }) {
    const group = await prisma.workspaceGroup.create({
        data: {
            workspaceId,
            name: String(name || '').trim(),
            color: color || '#6366f1'
        }
    });
    await ensureWorkspaceOwnerInGroup(group.id, workspaceId);
    return getGroupForWorkspace(group.id, workspaceId);
}

async function deleteGroup(groupId, workspaceId) {
    const group = await prisma.workspaceGroup.findFirst({
        where: { id: groupId, workspaceId }
    });
    if (!group) return null;
    await prisma.workspaceGroup.delete({ where: { id: groupId } });
    return group;
}

async function getWorkspaceMemberLabel(workspaceId, userId) {
    const membership = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        include: { user: { select: { id: true, email: true, name: true } } }
    });
    if (!membership) return 'Someone';
    return memberLabel(membership.user, membership.teamEmail);
}

async function getUserLabel(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true }
    });
    if (!user) return 'Someone';
    return memberLabel(user, null);
}

async function postGroupSystemMessage(groupId, actorId, body, systemEvent) {
    return prisma.groupMessage.create({
        data: {
            groupId,
            userId: actorId,
            kind: 'system',
            body,
            systemEvent: systemEvent || undefined
        },
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } }
    });
}

async function addPeopleToGroup(groupId, workspaceId, { userIds, inviteIds, actorId }) {
    const group = await prisma.workspaceGroup.findFirst({
        where: { id: groupId, workspaceId }
    });
    if (!group) return null;

    const added = [];
    const skipped = [];
    const actorLabel = actorId ? await getUserLabel(actorId) : 'Someone';

    for (const userId of userIds || []) {
        const membership = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId } }
        });
        if (!membership) {
            skipped.push({ userId, reason: 'not_in_workspace' });
            continue;
        }
        const existing = await prisma.groupMember.findUnique({
            where: { groupId_userId: { groupId, userId } }
        });
        if (existing) {
            skipped.push({ userId, reason: 'already_in_group' });
            continue;
        }
        await prisma.groupMember.create({ data: { groupId, userId } });
        added.push({ kind: 'member', userId });

        if (actorId) {
            const subjectLabel = await getWorkspaceMemberLabel(workspaceId, userId);
            const welcomeBody = userId === actorId
                ? `${subjectLabel} joined #${group.name}. Welcome to the group!`
                : `${subjectLabel} has been added to #${group.name} by ${actorLabel}. Welcome aboard!`;
            await postGroupSystemMessage(groupId, actorId, welcomeBody, {
                type: userId === actorId ? 'member_joined' : 'member_added',
                subjectUserId: userId,
                actorUserId: actorId,
                groupName: group.name
            });
        }
    }

    for (const inviteId of inviteIds || []) {
        const invite = await prisma.invite.findFirst({
            where: { id: inviteId, workspaceId, acceptedAt: null }
        });
        if (!invite) {
            skipped.push({ inviteId, reason: 'invite_not_found' });
            continue;
        }
        if (invite.expiresAt < new Date()) {
            skipped.push({ inviteId, reason: 'invite_expired' });
            continue;
        }
        const existing = await prisma.groupInvite.findUnique({
            where: { groupId_inviteId: { groupId, inviteId } }
        });
        if (existing) {
            skipped.push({ inviteId, reason: 'already_in_group' });
            continue;
        }
        await prisma.groupInvite.create({ data: { groupId, inviteId } });
        added.push({ kind: 'invite', inviteId });

        if (actorId) {
            const inviteBody = `${invite.email} has been added to #${group.name} by ${actorLabel}. They'll join this chat once they accept the workspace invite.`;
            await postGroupSystemMessage(groupId, actorId, inviteBody, {
                type: 'invite_added',
                inviteId,
                email: invite.email,
                actorUserId: actorId,
                groupName: group.name
            });
        }
    }

    return {
        group: await getGroupForWorkspace(groupId, workspaceId),
        added,
        skipped
    };
}

async function removePersonFromGroup(groupId, workspaceId, { userId, inviteId }) {
    const group = await prisma.workspaceGroup.findFirst({
        where: { id: groupId, workspaceId }
    });
    if (!group) return null;

    if (userId) {
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { ownerId: true }
        });
        if (workspace && userId === workspace.ownerId) {
            const error = new Error('The workspace owner stays in every group channel');
            error.status = 400;
            throw error;
        }
        await prisma.groupMember.deleteMany({ where: { groupId, userId } });
    }
    if (inviteId) {
        await prisma.groupInvite.deleteMany({ where: { groupId, inviteId } });
    }

    return getGroupForWorkspace(groupId, workspaceId);
}

async function promoteInviteGroupAssignments(inviteId, userId) {
    const links = await prisma.groupInvite.findMany({
        where: { inviteId },
        include: {
            group: { select: { id: true, name: true, workspaceId: true } }
        }
    });
    if (links.length === 0) return;

    for (const link of links) {
        await prisma.groupMember.upsert({
            where: { groupId_userId: { groupId: link.groupId, userId } },
            create: { groupId: link.groupId, userId },
            update: {}
        });

        const subjectLabel = await getWorkspaceMemberLabel(link.group.workspaceId, userId);
        const joinBody = `${subjectLabel} joined #${link.group.name}. Say hello and welcome them to the group!`;
        await postGroupSystemMessage(link.groupId, userId, joinBody, {
            type: 'member_joined',
            subjectUserId: userId,
            groupName: link.group.name
        });
    }
    await prisma.groupInvite.deleteMany({ where: { inviteId } });
}

function uniqueAliases(values) {
    const seen = new Set();
    const aliases = [];

    function addAlias(value) {
        const trimmed = String(value || '').trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        aliases.push(trimmed);
    }

    for (const value of values) {
        addAlias(value);
        const trimmed = String(value || '').trim();
        if (trimmed.includes(' ')) {
            addAlias(trimmed.split(/\s+/)[0]);
        }
        if (trimmed.includes('@')) {
            addAlias(trimmed.split('@')[0]);
        }
    }

    return aliases.sort(function (a, b) { return b.length - a.length; });
}

const BROADCAST_MENTION_TOKENS = [
    {
        scope: 'all',
        displayLabel: 'all',
        aliases: ['channel', 'all']
    },
    {
        scope: 'available',
        displayLabel: 'available',
        aliases: ['available']
    },
    {
        scope: 'here',
        displayLabel: 'here',
        aliases: ['here']
    }
];

function buildBroadcastMentionOptions() {
    return BROADCAST_MENTION_TOKENS.map(function (token) {
        return {
            kind: 'broadcast',
            scope: token.scope,
            userId: null,
            displayLabel: token.displayLabel,
            avatarUrl: null,
            aliases: token.aliases.slice(),
            description: broadcastMentionDescription(token.scope)
        };
    });
}

function broadcastMentionDescription(scope) {
    if (scope === 'all') return 'Notify everyone in this channel';
    if (scope === 'available') return 'Notify members who are Available';
    if (scope === 'here') return 'Notify members who are active right now';
    return 'Notify channel members';
}

function buildMentionRoster(group) {
    const members = group.members
        .filter(function (entry) { return entry.kind === 'member' && entry.userId; })
        .map(function (entry) {
            return {
                kind: 'user',
                userId: entry.userId,
                displayLabel: entry.displayLabel,
                avatarUrl: entry.avatarUrl || null,
                aliases: uniqueAliases([
                    entry.displayLabel,
                    entry.name,
                    entry.teamEmail,
                    entry.email
                ])
            };
        });

    return buildBroadcastMentionOptions().concat(members);
}

function matchMentionToken(afterAt, alias) {
    const aliasLower = alias.toLowerCase();
    const afterLower = afterAt.toLowerCase();
    if (!afterLower.startsWith(aliasLower) && !aliasLower.startsWith(afterLower)) return false;
    if (!afterLower.startsWith(aliasLower)) return true;
    const nextChar = afterAt[alias.length];
    return !nextChar || /[\s,.!?;:]/.test(nextChar);
}

async function loadAvailabilityByUserId(userIds) {
    if (!userIds.length) return new Map();
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, availability: true }
    });
    return new Map(users.map(function (row) {
        return [row.id, row.availability || 'available'];
    }));
}

function resolveBroadcastTargets(scope, roster, authorId, availabilityByUserId) {
    const members = roster.filter(function (entry) {
        return entry.kind === 'user' && entry.userId && entry.userId !== authorId;
    });

    if (scope === 'all') {
        return members.map(function (entry) { return entry.userId; });
    }

    if (scope === 'available') {
        return members
            .filter(function (entry) {
                return (availabilityByUserId.get(entry.userId) || 'available') === 'available';
            })
            .map(function (entry) { return entry.userId; });
    }

    if (scope === 'here') {
        return members
            .filter(function (entry) {
                const availability = availabilityByUserId.get(entry.userId) || 'available';
                return availability !== 'offline' && availability !== 'dnd';
            })
            .map(function (entry) { return entry.userId; });
    }

    return [];
}

async function parseMentionsInBody(body, roster, authorId) {
    const text = String(body || '');
    const mentionRecords = [];
    const mentionedUserIds = new Set();
    const broadcastTokens = [];

    for (const token of BROADCAST_MENTION_TOKENS) {
        for (const alias of token.aliases) {
            broadcastTokens.push({
                kind: 'broadcast',
                scope: token.scope,
                alias,
                displayLabel: token.displayLabel
            });
        }
    }
    broadcastTokens.sort(function (a, b) { return b.alias.length - a.alias.length; });

    const aliasEntries = [];
    for (const person of roster) {
        if (person.kind === 'broadcast') continue;
        for (const alias of person.aliases) {
            aliasEntries.push({
                kind: 'user',
                userId: person.userId,
                alias,
                displayLabel: person.displayLabel
            });
        }
    }
    aliasEntries.sort(function (a, b) { return b.alias.length - a.alias.length; });

    const memberIds = roster
        .filter(function (entry) { return entry.kind === 'user' && entry.userId; })
        .map(function (entry) { return entry.userId; });
    const availabilityByUserId = await loadAvailabilityByUserId(memberIds);
    const usedBroadcastScopes = new Set();

    let searchFrom = 0;
    while (searchFrom < text.length) {
        const atIndex = text.indexOf('@', searchFrom);
        if (atIndex === -1) break;

        const charBeforeAt = atIndex > 0 ? text[atIndex - 1] : ' ';
        if (charBeforeAt && !/[\s([{]/.test(charBeforeAt)) {
            searchFrom = atIndex + 1;
            continue;
        }

        const afterAt = text.slice(atIndex + 1);
        let matched = null;

        for (const entry of broadcastTokens) {
            if (!matchMentionToken(afterAt, entry.alias)) continue;
            matched = entry;
            break;
        }

        if (!matched) {
            for (const entry of aliasEntries) {
                if (!matchMentionToken(afterAt, entry.alias)) continue;
                matched = entry;
                break;
            }
        }

        if (matched) {
            if (matched.kind === 'broadcast') {
                if (!usedBroadcastScopes.has(matched.scope)) {
                    usedBroadcastScopes.add(matched.scope);
                    const notifiedUserIds = resolveBroadcastTargets(
                        matched.scope,
                        roster,
                        authorId,
                        availabilityByUserId
                    );
                    for (const targetId of notifiedUserIds) {
                        mentionedUserIds.add(targetId);
                    }
                    mentionRecords.push({
                        kind: 'broadcast',
                        scope: matched.scope,
                        userId: null,
                        alias: matched.alias,
                        displayLabel: matched.displayLabel,
                        notifiedUserIds
                    });
                }
                searchFrom = atIndex + 1 + matched.alias.length;
                continue;
            }

            if (!mentionedUserIds.has(matched.userId)) {
                mentionedUserIds.add(matched.userId);
                mentionRecords.push({
                    kind: 'user',
                    userId: matched.userId,
                    alias: matched.alias,
                    displayLabel: matched.displayLabel
                });
            }
        }

        searchFrom = atIndex + 1;
    }

    return mentionRecords;
}

async function canAccessGroupChat(groupId, userId) {
    const group = await prisma.workspaceGroup.findFirst({
        where: { id: groupId },
        include: groupInclude
    });
    if (!group) return null;

    await ensureWorkspaceOwnerInGroup(groupId, group.workspaceId);

    const refreshed = await prisma.workspaceGroup.findFirst({
        where: { id: groupId },
        include: groupInclude
    });
    if (!refreshed) return null;

    const isOwner = await isWorkspaceOwner(userId);
    if (isOwner) {
        return { group: refreshed, roster: buildMentionRoster(await serializeGroup(refreshed)) };
    }

    const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } }
    });
    if (!membership) return null;

    const serialized = await serializeGroup(refreshed);
    return { group: refreshed, roster: buildMentionRoster(serialized) };
}

function serializeGroupMessage(message, rosterByUserId) {
    const storedMentions = Array.isArray(message.mentions) ? message.mentions : [];
    const mentions = storedMentions.map(function (entry) {
        if (entry.kind === 'broadcast') {
            return {
                kind: 'broadcast',
                scope: entry.scope,
                userId: null,
                alias: entry.alias,
                displayLabel: entry.displayLabel || entry.alias,
                notifiedUserIds: Array.isArray(entry.notifiedUserIds) ? entry.notifiedUserIds : []
            };
        }

        const rosterEntry = rosterByUserId.get(entry.userId);
        return {
            kind: 'user',
            userId: entry.userId,
            alias: entry.alias,
            displayLabel: entry.displayLabel || rosterEntry?.displayLabel || entry.alias
        };
    });

    const authorLabel = message.user?.name || message.user?.email || 'User';

    const isSystem = message.kind === 'system';

    return {
        id: message.id,
        groupId: message.groupId,
        kind: message.kind || 'user',
        isSystem,
        body: message.body,
        userId: message.userId,
        authorEmail: isSystem ? null : (message.user?.email ?? null),
        authorName: isSystem ? null : (message.user?.name ?? null),
        authorAvatarUrl: isSystem ? null : (message.user?.avatarUrl ?? null),
        authorLabel: isSystem ? 'System' : authorLabel,
        mentions: isSystem ? [] : mentions,
        systemEvent: message.systemEvent ?? null,
        createdAt: message.createdAt
    };
}

async function listGroupMessages(groupId, userId) {
    const access = await canAccessGroupChat(groupId, userId);
    if (!access) return null;

    const rosterByUserId = new Map(
        access.roster.map(function (entry) { return [entry.userId, entry]; })
    );

    const messages = await prisma.groupMessage.findMany({
        where: { groupId },
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' }
    });

    return {
        groupId,
        roster: access.roster,
        messages: messages.map(function (message) {
            return serializeGroupMessage(message, rosterByUserId);
        })
    };
}

async function createGroupMessage(groupId, userId, body) {
    const trimmed = String(body || '').trim();
    if (!trimmed) {
        const error = new Error('Message is required');
        error.status = 400;
        throw error;
    }

    const access = await canAccessGroupChat(groupId, userId);
    if (!access) return null;

    const mentions = await parseMentionsInBody(trimmed, access.roster, userId);
    const message = await prisma.groupMessage.create({
        data: {
            groupId,
            userId,
            body: trimmed,
            mentions: mentions.length ? mentions : undefined
        },
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } }
    });

    const rosterByUserId = new Map(
        access.roster.map(function (entry) { return [entry.userId, entry]; })
    );

    return serializeGroupMessage(message, rosterByUserId);
}

module.exports = {
    listGroupsForWorkspace,
    getGroupForWorkspace,
    createGroup,
    deleteGroup,
    addPeopleToGroup,
    removePersonFromGroup,
    promoteInviteGroupAssignments,
    canAccessGroupChat,
    listGroupMessages,
    createGroupMessage,
    buildMentionRoster,
    buildBroadcastMentionOptions,
    parseMentionsInBody
};
