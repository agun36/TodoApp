const { prisma } = require('./prisma.service.js');
const { serializeProject, accessibleProjectWhere } = require('./project.service.js');
const { getRecentActivity } = require('./activity.service.js');

function emptyProjectStats() {
    return { total: 0, inProgress: 0, done: 0, overdue: 0, active: 0 };
}

function accumulateTodoStats(todo, stats, now) {
    stats.total += 1;
    if (todo.status === 'in_progress') stats.inProgress += 1;
    if (todo.status === 'done') stats.done += 1;
    if (todo.status !== 'done' && todo.dueDate && new Date(todo.dueDate) < now) {
        stats.overdue += 1;
    }
    stats.active = stats.total - stats.done;
}

function accumulateGlobalTodoStats(todo, stats, now) {
    if (todo.status === 'in_progress') stats.inProgress += 1;
    if (todo.status === 'done') stats.done += 1;
    if (todo.status !== 'done' && todo.dueDate && new Date(todo.dueDate) < now) {
        stats.overdue += 1;
    }
    if (stats.byPriority[todo.priority] !== undefined) {
        stats.byPriority[todo.priority] += 1;
    }
}

async function getDashboardData(userId, options = {}) {
    const projects = await prisma.project.findMany({
        where: { ...accessibleProjectWhere(userId), status: 'active' },
        orderBy: [{ isInbox: 'desc' }, { createdAt: 'asc' }]
    });

    const todos = await prisma.todo.findMany({
        where: {
            kind: 'task',
            OR: [{ userId }, { assigneeId: userId }]
        },
        select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            projectId: true,
            createdAt: true
        },
        orderBy: { createdAt: 'desc' }
    });

    const projectNameById = new Map(projects.map((project) => [project.id, project.name]));

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const globalStats = {
        inProgress: 0,
        done: 0,
        overdue: 0,
        byPriority: { low: 0, medium: 0, high: 0 }
    };
    const projectStatsMap = new Map(
        projects.map((project) => [project.id, emptyProjectStats()])
    );

    todos.forEach((todo) => {
        accumulateGlobalTodoStats(todo, globalStats, now);

        if (todo.projectId && projectStatsMap.has(todo.projectId)) {
            accumulateTodoStats(todo, projectStatsMap.get(todo.projectId), now);
        }
    });

    const projectsWithStats = projects.map((project) =>
        serializeProject(
            project,
            projectStatsMap.get(project.id) || emptyProjectStats(),
            userId
        )
    );

    const recentActivity = await getRecentActivity(userId, {
        page: options.activityPage,
        limit: options.activityLimit
    });

    return {
        stats: {
            totalProjects: projects.length,
            totalTasks: todos.length,
            active: todos.length - globalStats.done,
            inProgress: globalStats.inProgress,
            done: globalStats.done,
            overdue: globalStats.overdue,
            byPriority: globalStats.byPriority
        },
        projects: projectsWithStats,
        recentTodos: todos.slice(0, 8).map((todo) => ({
            id: todo.id,
            title: todo.title,
            status: todo.status,
            priority: todo.priority,
            dueDate: todo.dueDate,
            projectId: todo.projectId,
            projectName: todo.projectId ? projectNameById.get(todo.projectId) ?? null : null,
            createdAt: todo.createdAt
        })),
        recentActivity
    };
}

module.exports = { getDashboardData };
