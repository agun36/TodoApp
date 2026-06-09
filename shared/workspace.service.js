const { prisma } = require('./prisma.service.js');

const FREE_MEMBER_LIMIT = Number(process.env.FREE_MEMBER_LIMIT || 3);
const FREE_PROJECT_LIMIT = Number(process.env.FREE_PROJECT_LIMIT || 3);
const FREE_GROUP_LIMIT = Number(process.env.FREE_GROUP_LIMIT || 2);

function isProPlan(workspace) {
    return !!(workspace && workspace.plan === 'paid');
}

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

async function countWorkspaceProjects(workspaceId) {
    const members = await prisma.workspaceMember.findMany({
        where: { workspaceId },
        select: { userId: true }
    });
    const userIds = members.map(function (member) {
        return member.userId;
    });
    if (userIds.length === 0) return 0;

    return prisma.project.count({
        where: {
            userId: { in: userIds },
            isInbox: false,
            status: 'active'
        }
    });
}

async function countWorkspaceGroups(workspaceId) {
    return prisma.workspaceGroup.count({ where: { workspaceId } });
}

function planLimitResponse(feature, used, limit) {
    return {
        allowed: false,
        reason: `Free plan includes ${limit} ${feature}. Upgrade to Pro for unlimited ${feature}.`,
        limit,
        used,
        code: 'plan_limit'
    };
}

async function canAddWorkspaceMember(workspace) {
    if (!workspace) return { allowed: false, reason: 'Workspace not found' };
    if (isProPlan(workspace)) return { allowed: true };

    const used = await countBillableMembers(workspace.id);
    if (used >= FREE_MEMBER_LIMIT) {
        return planLimitResponse('members', used, FREE_MEMBER_LIMIT);
    }
    return { allowed: true, limit: FREE_MEMBER_LIMIT, used };
}

async function canCreateProject(workspace) {
    if (!workspace) return { allowed: false, reason: 'Workspace not found' };
    if (isProPlan(workspace)) return { allowed: true };

    const used = await countWorkspaceProjects(workspace.id);
    if (used >= FREE_PROJECT_LIMIT) {
        return planLimitResponse('projects', used, FREE_PROJECT_LIMIT);
    }
    return { allowed: true, limit: FREE_PROJECT_LIMIT, used };
}

async function canCreateGroup(workspace) {
    if (!workspace) return { allowed: false, reason: 'Workspace not found' };
    if (isProPlan(workspace)) return { allowed: true };

    const used = await countWorkspaceGroups(workspace.id);
    if (used >= FREE_GROUP_LIMIT) {
        return planLimitResponse('groups', used, FREE_GROUP_LIMIT);
    }
    return { allowed: true, limit: FREE_GROUP_LIMIT, used };
}

function canUseKanban(workspace) {
    if (!workspace) return { allowed: false, reason: 'Workspace not found' };
    if (isProPlan(workspace)) return { allowed: true };
    return {
        allowed: false,
        reason: 'Kanban board is a Pro feature. Upgrade to use board view.',
        code: 'plan_feature'
    };
}

async function buildBillingSnapshot(workspace, options) {
    if (!workspace) return null;

    const opts = options || {};
    const isPro = isProPlan(workspace);
    const [membersUsed, projectsUsed, groupsUsed] = await Promise.all([
        countBillableMembers(workspace.id),
        countWorkspaceProjects(workspace.id),
        countWorkspaceGroups(workspace.id)
    ]);

    const snapshot = {
        plan: workspace.plan || 'free',
        freeMemberLimit: FREE_MEMBER_LIMIT,
        freeProjectLimit: FREE_PROJECT_LIMIT,
        freeGroupLimit: FREE_GROUP_LIMIT,
        membersAreFree: true,
        usage: {
            members: { used: membersUsed, limit: isPro ? null : FREE_MEMBER_LIMIT },
            projects: { used: projectsUsed, limit: isPro ? null : FREE_PROJECT_LIMIT },
            groups: { used: groupsUsed, limit: isPro ? null : FREE_GROUP_LIMIT }
        },
        features: {
            kanban: isPro
        }
    };

    if (opts.includeStripeConfigured) {
        const { isStripeConfigured, getPublishableKey } = require('./stripe.service.js');
        snapshot.stripeConfigured = isStripeConfigured();
        snapshot.publishableKey = snapshot.stripeConfigured ? getPublishableKey() : null;
    }

    return snapshot;
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
    FREE_PROJECT_LIMIT,
    FREE_GROUP_LIMIT,
    isProPlan,
    serializeWorkspace,
    getWorkspaceForOwner,
    getWorkspaceForUser,
    createWorkspaceForOwner,
    ensureOwnerMembership,
    countBillableMembers,
    countWorkspaceProjects,
    countWorkspaceGroups,
    canAddWorkspaceMember,
    canCreateProject,
    canCreateGroup,
    canUseKanban,
    buildBillingSnapshot,
    addWorkspaceMember,
    ownerNeedsOnboarding,
    updateWorkspacePlan,
    getAppBaseUrl,
    redirectToFrontend
};
