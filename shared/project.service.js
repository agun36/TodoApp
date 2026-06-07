const { prisma } = require('./prisma.service.js');

const VALID_PROJECT_STATUSES = ['active', 'archived'];

function isValidProjectStatus(status) {
    return VALID_PROJECT_STATUSES.includes(status);
}

function accessibleProjectWhere(userId) {
    return {
        OR: [
            { userId },
            { members: { some: { userId } } }
        ]
    };
}

async function ensureProjectOwnerMember(projectId, userId, role = 'owner') {
    const existing = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } }
    });
    if (existing) return existing;

    return prisma.projectMember.create({
        data: { projectId, userId, role }
    });
}

const inboxEnsureByUser = new Map();

async function ensureInboxProject(userId, options) {
    let repair = !options || options.repair !== false;
    const inFlight = inboxEnsureByUser.get(userId);
    if (inFlight) return inFlight;

    const work = (async function () {
        let inbox = await prisma.project.findFirst({
            where: { userId, isInbox: true }
        });

        if (!inbox) {
            inbox = await prisma.project.create({
                data: {
                    name: 'Inbox',
                    isInbox: true,
                    color: '#64748b',
                    userId
                }
            });
            repair = true;
        }

        await ensureProjectOwnerMember(inbox.id, userId, 'owner');

        if (repair) {
            await prisma.todo.updateMany({
                where: { userId, kind: 'personal', projectId: { not: null } },
                data: { projectId: null }
            });

            await prisma.todo.updateMany({
                where: { userId, projectId: null, kind: 'task' },
                data: { projectId: inbox.id }
            });
        }

        return inbox;
    })();

    inboxEnsureByUser.set(userId, work);
    try {
        return await work;
    } finally {
        inboxEnsureByUser.delete(userId);
    }
}

async function isProjectOwner(projectId, userId) {
    const project = await prisma.project.findFirst({
        where: { id: projectId, userId }
    });
    return !!project;
}

async function isProjectMember(projectId, userId) {
    const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } }
    });
    return !!member;
}

async function canAccessProject(projectId, userId) {
    return isProjectMember(projectId, userId);
}

async function getProjectMembers(projectId) {
    const members = await prisma.projectMember.findMany({
        where: { projectId },
        include: { user: { select: { id: true, email: true } } },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }]
    });

    return members.map((member) => ({
        id: member.user.id,
        email: member.user.email,
        role: member.role,
        joinedAt: member.joinedAt
    }));
}

async function resolveAssigneeForProject(assigneeId, projectId) {
    if (!assigneeId) return null;

    const member = await prisma.projectMember.findFirst({
        where: {
            projectId,
            userId: String(assigneeId).trim()
        }
    });
    return member ? member.userId : null;
}

async function findAccessibleProject(projectId, userId) {
    return prisma.project.findFirst({
        where: {
            id: projectId,
            ...accessibleProjectWhere(userId)
        }
    });
}

function emptyProjectStats() {
    return { total: 0, inProgress: 0, done: 0, overdue: 0, active: 0 };
}

function buildProjectStatsFromTodos(todos) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let total = todos.length;
    let inProgress = 0;
    let done = 0;
    let overdue = 0;

    todos.forEach((todo) => {
        if (todo.status === 'in_progress') inProgress += 1;
        if (todo.status === 'done') done += 1;
        if (todo.status !== 'done' && todo.dueDate && new Date(todo.dueDate) < now) {
            overdue += 1;
        }
    });

    return { total, inProgress, done, overdue, active: total - done };
}

async function getProjectStats(projectId) {
    const todos = await prisma.todo.findMany({
        where: { projectId, kind: 'task' },
        select: { status: true, dueDate: true }
    });
    return buildProjectStatsFromTodos(todos);
}

async function getProjectStatsMap(projectIds) {
    const map = new Map();
    if (projectIds.length === 0) return map;

    projectIds.forEach(function (projectId) {
        map.set(projectId, emptyProjectStats());
    });

    const todos = await prisma.todo.findMany({
        where: { projectId: { in: projectIds }, kind: 'task' },
        select: { projectId: true, status: true, dueDate: true }
    });

    const grouped = new Map();
    todos.forEach(function (todo) {
        if (!grouped.has(todo.projectId)) grouped.set(todo.projectId, []);
        grouped.get(todo.projectId).push(todo);
    });

    grouped.forEach(function (projectTodos, projectId) {
        map.set(projectId, buildProjectStatsFromTodos(projectTodos));
    });

    return map;
}

async function getProjectMemberCounts(projectIds) {
    const map = new Map();
    if (projectIds.length === 0) return map;

    const rows = await prisma.projectMember.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds } },
        _count: { _all: true }
    });

    rows.forEach(function (row) {
        map.set(row.projectId, row._count._all);
    });

    return map;
}

async function getAccessibleProjectIds(userId, status) {
    const where = { ...accessibleProjectWhere(userId) };
    if (status) where.status = status;
    const projects = await prisma.project.findMany({
        where,
        select: { id: true }
    });
    return projects.map(function (project) { return project.id; });
}

async function enrichProjects(userId, projects) {
    const projectIds = projects.map(function (project) { return project.id; });
    // Sequential queries — avoids grabbing multiple pool connections at once on Prisma dev.
    const statsMap = await getProjectStatsMap(projectIds);
    const memberCounts = await getProjectMemberCounts(projectIds);

    return projects.map(function (project) {
        const stats = statsMap.get(project.id) || emptyProjectStats();
        const serialized = serializeProject(project, stats, userId);
        serialized.memberCount = memberCounts.get(project.id) || 0;
        return serialized;
    });
}

function serializeProject(project, stats, contextUserId) {
    return {
        id: project.id,
        name: project.name,
        description: project.description,
        color: project.color,
        status: project.status,
        isInbox: project.isInbox,
        isOwner: project.userId === contextUserId,
        ownerId: project.userId,
        createdAt: project.createdAt,
        stats,
        memberCount: project._count?.members ?? project.memberCount ?? null
    };
}

async function syncWorkspaceMemberProjects(userId) {
    const membership = await prisma.workspaceMember.findFirst({
        where: { userId, role: 'member' },
        include: { workspace: { select: { ownerId: true } } }
    });
    if (!membership) return;

    const ownerProjects = await prisma.project.findMany({
        where: { userId: membership.workspace.ownerId, status: 'active' },
        select: { id: true }
    });

    for (const project of ownerProjects) {
        await ensureProjectOwnerMember(project.id, userId, 'member');
    }
}

module.exports = {
    ensureInboxProject,
    ensureProjectOwnerMember,
    getProjectStats,
    getProjectStatsMap,
    getAccessibleProjectIds,
    enrichProjects,
    serializeProject,
    accessibleProjectWhere,
    isProjectOwner,
    isProjectMember,
    canAccessProject,
    getProjectMembers,
    resolveAssigneeForProject,
    findAccessibleProject,
    syncWorkspaceMemberProjects,
    VALID_PROJECT_STATUSES,
    isValidProjectStatus
};
