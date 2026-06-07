const { prisma } = require('./prisma.service.js');

async function logActivity({
    actorId,
    action,
    entityType,
    entityId,
    projectId = null,
    message,
    metadata = null
}) {
    return prisma.activity.create({
        data: {
            actorId,
            action,
            entityType,
            entityId,
            projectId,
            message,
            metadata: metadata || undefined
        }
    });
}

function serializeActivity(activity) {
    return {
        id: activity.id,
        action: activity.action,
        message: activity.message,
        entityType: activity.entityType,
        entityId: activity.entityId,
        projectId: activity.projectId,
        actorId: activity.actorId,
        actorEmail: activity.actor?.email ?? null,
        createdAt: activity.createdAt
    };
}

async function getRecentActivity(userId, options = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(options.limit) || 5));
    const skip = (page - 1) * limit;

    const accessibleTodoIds = await prisma.todo.findMany({
        where: {
            OR: [{ userId }, { assigneeId: userId }]
        },
        select: { id: true }
    });
    const todoIds = accessibleTodoIds.map((t) => t.id);

    const memberProjectIds = await prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true }
    });
    const projectIds = memberProjectIds.map((m) => m.projectId);

    const where = {
        OR: [
            { actorId: userId },
            { entityType: 'todo', entityId: { in: todoIds } },
            { projectId: { in: projectIds } }
        ]
    };

    const [activities, total] = await Promise.all([
        prisma.activity.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: { actor: { select: { id: true, email: true } } }
        }),
        prisma.activity.count({ where })
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
        items: activities.map(serializeActivity),
        page,
        limit,
        total,
        totalPages
    };
}

function serializeComment(comment) {
    return {
        id: comment.id,
        todoId: comment.todoId,
        body: comment.body,
        userId: comment.userId,
        authorEmail: comment.user?.email ?? null,
        createdAt: comment.createdAt
    };
}

module.exports = {
    logActivity,
    serializeActivity,
    getRecentActivity,
    serializeComment
};
