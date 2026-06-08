const { prisma } = require('./prisma.service.js');

const FREE_MEMBER_LIMIT = Number(process.env.FREE_MEMBER_LIMIT || 3);

function serializeWorkspace(workspace) {
    if (!workspace) return null;
    return {
        id: workspace.id,
        name: workspace.name,
        teamType: workspace.teamType,
        teamSize: workspace.teamSize,
        primaryUse: workspace.primaryUse,
        plan: workspace.plan || 'free',
        ownerId: workspace.ownerId
    };
}

async function getWorkspaceForOwner(ownerId) {
    return prisma.workspace.findUnique({ where: { ownerId } });
}

async function getWorkspaceForUser(userId) {
    const owned = await prisma.workspace.findUnique({ where: { ownerId: userId } });
    if (owned) return owned;

    const membership = await prisma.workspaceMember.findFirst({
        where: { userId },
        include: { workspace: true }
    });
    return membership?.workspace ?? null;
}

async function ensureOwnerMembership(workspaceId, ownerId) {
    return prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId, userId: ownerId } },
        create: { workspaceId, userId: ownerId, role: 'owner' },
        update: { role: 'owner' }
    });
}

async function createWorkspaceForOwner(ownerId, data) {
    const existing = await prisma.workspace.findUnique({ where: { ownerId } });
    if (existing) return existing;

    const workspace = await prisma.workspace.create({
        data: {
            name: data.name,
            teamType: data.teamType || null,
            teamSize: data.teamSize || null,
            primaryUse: data.primaryUse || null,
            plan: 'free',
            ownerId
        }
    });

    await ensureOwnerMembership(workspace.id, ownerId);
    return workspace;
}

async function countBillableMembers(workspaceId) {
    const [members, pendingInvites] = await Promise.all([
        prisma.workspaceMember.count({
            where: { workspaceId, role: 'member' }
        }),
        prisma.invite.count({
            where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } }
        })
    ]);
    return members + pendingInvites;
}

async function canAddWorkspaceMember(workspace) {
    if (!workspace) return { allowed: false, reason: 'Workspace not found' };
    if (workspace.plan === 'paid') return { allowed: true };

    const used = await countBillableMembers(workspace.id);
    if (used >= FREE_MEMBER_LIMIT) {
        return {
            allowed: false,
            reason: `Free plan includes ${FREE_MEMBER_LIMIT} members. Upgrade to invite more people.`,
            limit: FREE_MEMBER_LIMIT,
            used
        };
    }
    return { allowed: true, limit: FREE_MEMBER_LIMIT, used };
}

async function addWorkspaceMember(workspaceId, userId, role) {
    return prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId, userId } },
        create: { workspaceId, userId, role: role || 'member' },
        update: {}
    });
}

async function updateWorkspacePlan(ownerId, plan) {
    const workspace = await getWorkspaceForOwner(ownerId);
    if (!workspace) return null;

    const normalized = plan === 'paid' ? 'paid' : 'free';
    return prisma.workspace.update({
        where: { id: workspace.id },
        data: { plan: normalized }
    });
}

async function ownerNeedsOnboarding(user) {
    if (!user) return false;
    const { isInvitedWorkspaceMember } = require('./user.service.js');
    if (await isInvitedWorkspaceMember(user.id)) return false;
    const workspace = await getWorkspaceForOwner(user.id);
    return !workspace;
}

function getAppBaseUrl() {
    return (process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function redirectToFrontend(res, path) {
    return res.redirect(getAppBaseUrl() + path);
}

module.exports = {
    FREE_MEMBER_LIMIT,
    serializeWorkspace,
    getWorkspaceForOwner,
    getWorkspaceForUser,
    createWorkspaceForOwner,
    ensureOwnerMembership,
    countBillableMembers,
    canAddWorkspaceMember,
    addWorkspaceMember,
    ownerNeedsOnboarding,
    updateWorkspacePlan,
    getAppBaseUrl,
    redirectToFrontend
};
