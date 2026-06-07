const crypto = require('crypto');
const { prisma } = require('./prisma.service.js');
const { sendInviteEmail } = require('./notification.service.js');
const { normalizeEmail } = require('./user.service.js');
const { addWorkspaceMember, getAppBaseUrl } = require('./workspace.service.js');

const INVITE_TTL_DAYS = 7;

function generateInviteToken() {
    return crypto.randomBytes(24).toString('hex');
}

function inviteExpiresAt() {
    const date = new Date();
    date.setDate(date.getDate() + INVITE_TTL_DAYS);
    return date;
}

function buildInviteUrl(token) {
    return getAppBaseUrl() + '/invite/' + token;
}

function buildWhatsAppUrl(inviteUrl, inviterName, workspaceName, phone) {
    const text = encodeURIComponent(
        inviterName + ' invited you to ' + workspaceName + ' on TaskFlow. Join here: ' + inviteUrl
    );
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits) {
        return 'https://wa.me/' + digits + '?text=' + text;
    }
    return 'https://wa.me/?text=' + text;
}

function serializeInvitePublic(invite, workspace, inviter) {
    const expired = invite.expiresAt < new Date();
    const pending = !invite.acceptedAt && !expired;
    return {
        id: invite.id,
        email: invite.email,
        token: invite.token,
        workspace: workspace ? { id: workspace.id, name: workspace.name } : null,
        inviter: inviter ? { name: inviter.name || inviter.email, email: inviter.email } : null,
        expiresAt: invite.expiresAt,
        acceptedAt: invite.acceptedAt,
        pending,
        expired,
        inviteUrl: buildInviteUrl(invite.token),
        whatsappUrl: workspace && inviter
            ? buildWhatsAppUrl(
                buildInviteUrl(invite.token),
                inviter.name || inviter.email.split('@')[0],
                workspace.name
            )
            : null
    };
}

function serializeInvite(invite) {
    const expired = invite.expiresAt < new Date();
    return {
        id: invite.id,
        email: invite.email,
        token: invite.token,
        invitedById: invite.invitedById,
        workspaceId: invite.workspaceId,
        acceptedAt: invite.acceptedAt,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        pending: !invite.acceptedAt && !expired,
        expired,
        inviteUrl: buildInviteUrl(invite.token),
        whatsappUrl: null
    };
}

async function findValidInviteByToken(token) {
    const invite = await prisma.invite.findUnique({
        where: { token: String(token || '').trim() },
        include: {
            workspace: true,
            invitedBy: { select: { id: true, email: true, name: true } }
        }
    });
    if (!invite) return null;
    if (invite.acceptedAt) return { invite, status: 'accepted' };
    if (invite.expiresAt < new Date()) return { invite, status: 'expired' };
    return { invite, status: 'valid' };
}

async function findValidInviteByEmail(email) {
    const normalized = normalizeEmail(email);
    return prisma.invite.findFirst({
        where: {
            email: { equals: normalized, mode: 'insensitive' },
            acceptedAt: null,
            expiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: 'desc' }
    });
}

async function createWorkspaceInvite({ workspaceId, email, invitedById, invitedByUser, workspace }) {
    const normalized = normalizeEmail(email);
    const token = generateInviteToken();
    const expiresAt = inviteExpiresAt();

    const invite = await prisma.invite.upsert({
        where: {
            workspaceId_email: { workspaceId, email: normalized }
        },
        create: {
            email: normalized,
            token,
            workspaceId,
            invitedById,
            expiresAt
        },
        update: {
            token,
            invitedById,
            acceptedAt: null,
            expiresAt,
            createdAt: new Date()
        }
    });

    const inviteUrl = buildInviteUrl(invite.token);
    const inviterName = invitedByUser.name || invitedByUser.email.split('@')[0];
    const whatsappUrl = buildWhatsAppUrl(inviteUrl, inviterName, workspace.name);

    const emailResult = await sendInviteEmail({
        to: normalized,
        inviterName,
        workspaceName: workspace.name,
        inviteUrl
    });

    const serialized = serializeInvite(invite);
    serialized.whatsappUrl = whatsappUrl;
    serialized.inviteUrl = inviteUrl;
    serialized.emailSent = !!emailResult.sent;
    serialized.emailSkipped = !!emailResult.skipped;
    if (emailResult.error) serialized.emailError = emailResult.error;
    return serialized;
}

async function acceptInvite(invite, userId) {
    await addWorkspaceMember(invite.workspaceId, userId, 'member');
    const { promoteInviteGroupAssignments } = require('./group.service.js');
    await promoteInviteGroupAssignments(invite.id, userId);

    const workspace = await prisma.workspace.findUnique({
        where: { id: invite.workspaceId },
        select: { ownerId: true }
    });
    if (workspace) {
        const { ensureProjectOwnerMember } = require('./project.service.js');
        const ownerProjects = await prisma.project.findMany({
            where: { userId: workspace.ownerId, status: 'active' },
            select: { id: true }
        });
        for (const project of ownerProjects) {
            await ensureProjectOwnerMember(project.id, userId, 'member');
        }
    }

    return prisma.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() }
    });
}

async function acceptInviteForEmail(email, userId) {
    const invite = await findValidInviteByEmail(email);
    if (!invite) return null;
    return acceptInvite(invite, userId);
}

module.exports = {
    INVITE_TTL_DAYS,
    generateInviteToken,
    inviteExpiresAt,
    buildInviteUrl,
    buildWhatsAppUrl,
    serializeInvite,
    serializeInvitePublic,
    findValidInviteByToken,
    findValidInviteByEmail,
    createWorkspaceInvite,
    acceptInvite,
    acceptInviteForEmail
};
