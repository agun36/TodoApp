const express = require('express');
const router = express.Router();
require('dotenv').config();
const { prisma } = require('../shared/prisma.service.js');
const { wantsJson, jsonOk, jsonError } = require('../shared/api-response.js');
const { requireAuth } = require('../shared/require-auth.js');
const {
    ensureInboxProject,
    findAccessibleProject,
    resolveAssigneeForProject,
    getProjectMembers,
    accessibleProjectWhere,
    enrichProjects: enrichProjectsWithStats,
    getAccessibleProjectIds
} = require('../shared/project.service.js');
const { findUserById } = require('../shared/user.service.js');
const { logActivity, serializeComment } = require('../shared/activity.service.js');

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const VALID_KINDS = ['personal', 'task'];
const VALID_STATUSES = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_SCOPES = ['all', 'mine', 'assigned'];

const workspaceInflight = new Map();
let workspaceMutex = Promise.resolve();

function runWorkspaceExclusive(work) {
    const next = workspaceMutex.then(work);
    workspaceMutex = next.catch(function () {});
    return next;
}

function workspaceRequestKey(userId, query) {
    return userId + '|' + JSON.stringify({
        scope: query.scope || 'all',
        projectId: query.projectId || null,
        assigneeId: query.assigneeId || null,
        filter: query.filter || 'all',
        sort: query.sort || 'newest',
        q: query.q || '',
        status: query.status || '',
        priority: query.priority || ''
    });
}

function buildTaskWhereFromProjects(userId, scope, projectIds, query) {
    let accessWhere;

    if (scope === 'mine') {
        accessWhere = { userId };
    } else if (scope === 'assigned') {
        accessWhere = { assigneeId: userId };
    } else {
        const or = [{ userId }, { assigneeId: userId }];
        if (projectIds.length) {
            or.push({ projectId: { in: projectIds } });
        }
        accessWhere = { OR: or };
    }

    const where = { ...accessWhere, kind: 'task' };

    if (query.projectId) {
        where.projectId = String(query.projectId);
    }

    if (query.assigneeId) {
        const assigneeFilter = String(query.assigneeId);
        if (assigneeFilter === 'me') {
            where.assigneeId = userId;
        } else if (assigneeFilter === 'unassigned') {
            where.assigneeId = null;
        } else {
            where.assigneeId = assigneeFilter;
        }
    }

    return where;
}

const TASK_TODO_SELECT = {
    id: true,
    kind: true,
    title: true,
    status: true,
    priority: true,
    description: true,
    order: true,
    projectId: true,
    assigneeId: true,
    userId: true,
    createdAt: true,
    dueDate: true,
    repeatType: true,
    repeatOn: true,
    done: true
};

async function attachTaskTodoRelations(todos, rawProjects) {
    const projectMap = new Map(rawProjects.map(function (project) {
        return [project.id, project];
    }));
    const userIds = new Set();
    todos.forEach(function (todo) {
        if (todo.userId) userIds.add(todo.userId);
        if (todo.assigneeId) userIds.add(todo.assigneeId);
    });

    let userMap = new Map();
    if (userIds.size) {
        const users = await prisma.user.findMany({
            where: { id: { in: [...userIds] } },
            select: { id: true, email: true }
        });
        userMap = new Map(users.map(function (user) { return [user.id, user]; }));
    }

    return todos.map(function (todo) {
        const project = todo.projectId ? projectMap.get(todo.projectId) : null;
        const assignee = todo.assigneeId ? userMap.get(todo.assigneeId) : null;
        const owner = userMap.get(todo.userId);
        return {
            ...todo,
            project: project
                ? { id: project.id, name: project.name, color: project.color }
                : null,
            assignee: assignee
                ? { id: assignee.id, email: assignee.email }
                : null,
            user: owner
                ? { id: owner.id, email: owner.email }
                : null
        };
    });
}

function isStaleSessionError(error) {
    return error?.code === 'P2003'
        || error?.message === 'SESSION_EXPIRED'
        || error?.status === 401;
}

function workspaceErrorResponse(error) {
    if (isStaleSessionError(error)) {
        return {
            status: 401,
            message: 'Your session is no longer valid. Please sign out and sign in again.'
        };
    }
    if (String(error?.message || '').includes('timeout')) {
        return {
            status: 500,
            message: 'Database is busy. Keep `npx prisma dev` running and use only one backend process (`npm run dev`).'
        };
    }
    return {
        status: 500,
        message: 'Failed to load tasks. Check that the database is reachable.'
    };
}

async function loadTasksWorkspace(userId, email, query) {
    const currentUser = await findUserById(userId);
    if (!currentUser) {
        const err = new Error('SESSION_EXPIRED');
        err.status = 401;
        throw err;
    }

    const scope = VALID_SCOPES.includes(query.scope) ? query.scope : 'all';

    let rawProjects = await prisma.project.findMany({
        where: { ...accessibleProjectWhere(userId), status: 'active' },
        orderBy: [{ isInbox: 'desc' }, { createdAt: 'asc' }]
    });

    const hasInbox = rawProjects.some(function (project) {
        return project.isInbox && project.userId === userId;
    });
    if (!hasInbox) {
        await ensureInboxProject(userId, { repair: false });
        rawProjects = await prisma.project.findMany({
            where: { ...accessibleProjectWhere(userId), status: 'active' },
            orderBy: [{ isInbox: 'desc' }, { createdAt: 'asc' }]
        });
    }

    const projectIds = rawProjects.map(function (project) { return project.id; });
    const where = buildTaskWhereFromProjects(userId, scope, projectIds, query);

    const flatTodos = await prisma.todo.findMany({
        where,
        select: TASK_TODO_SELECT
    });
    const rawTodos = await attachTaskTodoRelations(flatTodos, rawProjects);
    const projects = await enrichProjectsWithStats(userId, rawProjects);
    const todos = applyTodoListFilters(rawTodos.map(enrichTodo), query);

    return {
        email,
        kind: 'task',
        projects,
        todos: todos.map(function (todo) { return serializeTodoForUser(todo, userId); }),
        filter: query.filter || 'all',
        sort: query.sort || 'newest',
        query: query.q || '',
        projectId: query.projectId || null,
        scope,
        assigneeId: query.assigneeId || null
    };
}

function parseKind(value) {
    return value === 'task' ? 'task' : 'personal';
}
const STATUS_LABELS = { todo: 'To do', in_progress: 'In progress', done: 'Done' };
const TODO_INCLUDES = {
    project: { select: { id: true, name: true, color: true } },
    assignee: { select: { id: true, email: true } },
    user: { select: { id: true, email: true } }
};

function todoAccessWhere(userId) {
    return {
        OR: [
            { userId },
            { assigneeId: userId },
            { project: accessibleProjectWhere(userId) }
        ]
    };
}

function buildTodoScopeWhere(userId, scope) {
    if (scope === 'mine') return { userId };
    if (scope === 'assigned') return { assigneeId: userId };
    return todoAccessWhere(userId);
}

function applyTodoListFilters(todos, query) {
    if (query && typeof query.q === 'string' && query.q.trim()) {
        const search = query.q.trim().toLowerCase();
        todos = todos.filter((t) => t.title.toLowerCase().includes(search));
    }

    if (query.filter === 'active') {
        todos = todos.filter((t) => t.status !== 'done');
    } else if (query.filter === 'completed') {
        todos = todos.filter((t) => t.status === 'done');
    }

    if (query.status && VALID_STATUSES.includes(query.status)) {
        todos = todos.filter((t) => t.status === query.status);
    }

    if (query.priority && VALID_PRIORITIES.includes(query.priority)) {
        todos = todos.filter((t) => t.priority === query.priority);
    }

    if (query.sort === 'oldest') {
        todos.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (query.sort === 'az') {
        todos.sort((a, b) => a.title.localeCompare(b.title));
    } else if (query.sort === 'priority') {
        const rank = { high: 0, medium: 1, low: 2 };
        todos.sort((a, b) => (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1));
    } else if (query.sort === 'due') {
        todos.sort(function (a, b) {
            if (!a.dueDate && !b.dueDate) {
                return new Date(b.createdAt) - new Date(a.createdAt);
            }
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        });
    } else if (query.sort === 'order') {
        todos.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    } else {
        todos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return todos;
}

async function buildTaskTodoWhere(req) {
    const userId = req.auth.userId;
    const scope = VALID_SCOPES.includes(req.query.scope) ? req.query.scope : 'all';
    let accessWhere;

    if (scope === 'mine') {
        accessWhere = { userId };
    } else if (scope === 'assigned') {
        accessWhere = { assigneeId: userId };
    } else {
        const projectIds = await getAccessibleProjectIds(userId, 'active');
        const or = [{ userId }, { assigneeId: userId }];
        if (projectIds.length) {
            or.push({ projectId: { in: projectIds } });
        }
        accessWhere = { OR: or };
    }

    const where = { ...accessWhere, kind: 'task' };

    if (req.query.projectId) {
        where.projectId = String(req.query.projectId);
    }

    if (req.query.assigneeId) {
        const assigneeFilter = String(req.query.assigneeId);
        if (assigneeFilter === 'me') {
            where.assigneeId = userId;
        } else if (assigneeFilter === 'unassigned') {
            where.assigneeId = null;
        } else {
            where.assigneeId = assigneeFilter;
        }
    }

    return { scope, where };
}

function parseRepeatDays(repeatOn) {
    if (!repeatOn) return [];
    if (Array.isArray(repeatOn)) {
        return repeatOn.map((day) => String(day).trim()).filter((day) => weekdays.includes(day));
    }
    return String(repeatOn)
        .split(',')
        .map((day) => day.trim())
        .filter((day) => weekdays.includes(day));
}

function normalizeRepeatOn(input) {
    if (input?.repeatDays) {
        const days = parseRepeatDays(input.repeatDays);
        return days.length ? days.join(',') : null;
    }
    const days = parseRepeatDays(input?.repeatOn);
    return days.length ? days.join(',') : null;
}

function getNextWeeklyDate(repeatOn) {
    const dayNames = parseRepeatDays(repeatOn);
    if (!dayNames.length) return null;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let offset = 0; offset < 7; offset += 1) {
        const candidate = new Date(now);
        candidate.setDate(candidate.getDate() + offset);
        if (dayNames.includes(weekdays[candidate.getDay()])) {
            return candidate;
        }
    }

    return null;
}

function getUpcomingDates(todo, count = 4) {
    if (todo.repeatType === 'weekly' && todo.repeatOn) {
        const dayNames = parseRepeatDays(todo.repeatOn);
        if (!dayNames.length) {
            return todo.dueDate ? [new Date(todo.dueDate)] : [];
        }

        const dayIndexes = new Set(dayNames.map((day) => weekdays.indexOf(day)).filter((index) => index >= 0));
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const cursor = todo.dueDate ? new Date(todo.dueDate) : new Date(now);
        cursor.setHours(0, 0, 0, 0);
        if (cursor < now) {
            cursor.setTime(now.getTime());
        }

        const dates = [];
        for (let i = 0; i < 90 && dates.length < count; i += 1) {
            if (dayIndexes.has(cursor.getDay())) {
                dates.push(new Date(cursor));
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return dates;
    }
    if (todo.dueDate) {
        return [new Date(todo.dueDate)];
    }
    return [];
}

function buildRepeatLabel(todo) {
    if (todo.repeatType === 'weekly' && todo.repeatOn) {
        const days = parseRepeatDays(todo.repeatOn);
        if (days.length === 1) return `Repeats every ${days[0]}`;
        if (days.length > 1) return `Repeats every ${days.join(', ')}`;
    }
    return null;
}

function parseTodoId(value) {
    if (value === undefined || value === null) return null;
    const todoId = String(value).trim();
    return todoId.length > 0 ? todoId : null;
}

function buildDueMeta(todo, upcomingDates) {
    if (!upcomingDates.length) {
        return { dueLabel: null, dueRelative: null, isOverdue: false };
    }

    const due = upcomingDates[0];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dueDay.getTime() - now.getTime()) / 86400000);
    const dueLabel = due.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
    });

    let dueRelative = dueLabel;
    let isOverdue = false;

    if (todo.status !== 'done') {
        if (diffDays < 0) {
            dueRelative = 'Overdue';
            isOverdue = true;
        } else if (diffDays === 0) {
            dueRelative = 'Today';
        } else if (diffDays === 1) {
            dueRelative = 'Tomorrow';
        } else if (diffDays <= 6) {
            dueRelative = due.toLocaleDateString(undefined, { weekday: 'long' });
        }
    }

    return { dueLabel, dueRelative, isOverdue };
}

function enrichTodo(todo) {
    const upcomingDates = getUpcomingDates(todo, 4);
    const dueMeta = buildDueMeta(todo, upcomingDates);
    return {
        ...todo,
        upcomingDates,
        dueLabel: dueMeta.dueLabel,
        dueRelative: dueMeta.dueRelative,
        isOverdue: dueMeta.isOverdue,
        upcomingLabels: upcomingDates.slice(1).map((d) => d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })),
        repeatLabel: buildRepeatLabel(todo),
        done: todo.status === 'done'
    };
}

function serializeTodo(todo) {
    const enriched = enrichTodo(todo);
    return {
        id: enriched.id,
        kind: enriched.kind || 'personal',
        title: enriched.title,
        done: enriched.done,
        status: enriched.status,
        priority: enriched.priority,
        description: enriched.description,
        order: enriched.order,
        projectId: enriched.projectId,
        projectName: enriched.project?.name ?? null,
        projectColor: enriched.project?.color ?? null,
        assigneeId: enriched.assigneeId ?? null,
        assigneeEmail: enriched.assignee?.email ?? null,
        ownerId: enriched.userId,
        ownerEmail: enriched.user?.email ?? null,
        isAssignedToMe: false,
        createdAt: enriched.createdAt,
        dueDate: enriched.dueDate,
        repeatType: enriched.repeatType,
        repeatOn: enriched.repeatOn,
        dueLabel: enriched.dueLabel,
        dueRelative: enriched.dueRelative,
        isOverdue: enriched.isOverdue,
        repeatLabel: enriched.repeatLabel
    };
}

function serializeTodoForUser(todo, currentUserId) {
    const serialized = serializeTodo(todo);
    serialized.isAssignedToMe = serialized.assigneeId === currentUserId && serialized.ownerId !== currentUserId;
    return serialized;
}

async function findAccessibleTodo(todoId, userId) {
    return prisma.todo.findFirst({
        where: { id: todoId, kind: 'task', ...todoAccessWhere(userId) }
    });
}

async function findPersonalTodo(todoId, userId) {
    return prisma.todo.findFirst({
        where: { id: todoId, userId, kind: 'personal' }
    });
}

async function recordTaskActivity({ actorId, actorEmail, action, todo, message, metadata }) {
    await logActivity({
        actorId,
        action,
        entityType: 'todo',
        entityId: todo.id,
        projectId: todo.projectId ?? null,
        message: message || `${actorEmail} updated "${todo.title}"`,
        metadata: metadata || undefined
    });
}

async function resolveProjectId(userId, projectId) {
    if (!projectId) {
        const inbox = await ensureInboxProject(userId);
        return inbox.id;
    }

    const project = await findAccessibleProject(projectId, userId);
    if (!project) return null;
    return project.id;
}

async function updateTodoHandler(req, res, todoId) {
    const {
        title,
        dueDate,
        repeatType,
        repeatOn,
        priority,
        status,
        description,
        projectId,
        assigneeId
    } = req.body;

    if (!todoId) {
        if (wantsJson(req)) return jsonError(res, 'Invalid todo id', 400);
        return res.redirect('/todos');
    }
    if (!title || !title.trim()) {
        if (wantsJson(req)) return jsonError(res, 'title is required', 400);
        return res.redirect('/todos');
    }

    const existing = await prisma.todo.findFirst({
        where: { id: todoId, userId: req.auth.userId }
    });
    if (!existing) {
        if (wantsJson(req)) return jsonError(res, 'Todo not found or you cannot edit it', 404);
        return res.redirect('/todos');
    }

    const isPersonal = existing.kind === 'personal';

    const normalizedRepeatOn = normalizeRepeatOn({ repeatOn, repeatDays: req.body.repeatDays });
    const selectedRepeatType = repeatType === 'weekly' && normalizedRepeatOn ? 'weekly' : 'none';
    const dueDateValue = dueDate
        ? new Date(dueDate)
        : (selectedRepeatType === 'weekly' ? getNextWeeklyDate(normalizedRepeatOn) : null);

    const data = {
        title: title.trim(),
        dueDate: dueDateValue,
        repeatType: selectedRepeatType,
        repeatOn: selectedRepeatType === 'weekly' ? normalizedRepeatOn : null
    };

    if (!isPersonal && description !== undefined) {
        data.description = description?.trim() || null;
    }

    if (isPersonal) {
        if (status !== undefined && (status === 'todo' || status === 'done')) {
            data.status = status;
            data.done = status === 'done';
        }
    } else {
        if (priority !== undefined && VALID_PRIORITIES.includes(priority)) {
            data.priority = priority;
        }
        if (status !== undefined && VALID_STATUSES.includes(status)) {
            data.status = status;
            data.done = status === 'done';
        }
        if (projectId !== undefined) {
            const resolvedProjectId = await resolveProjectId(req.auth.userId, projectId || null);
            if (!resolvedProjectId) {
                if (wantsJson(req)) return jsonError(res, 'Project not found', 404);
                return res.redirect('/todos');
            }
            data.projectId = resolvedProjectId;
        }
        if (assigneeId !== undefined) {
            const targetProjectId = data.projectId ?? existing.projectId;
            if (!assigneeId) {
                data.assigneeId = null;
            } else {
                const resolvedAssigneeId = await resolveAssigneeForProject(assigneeId, targetProjectId);
                if (!resolvedAssigneeId) {
                    if (wantsJson(req)) return jsonError(res, 'Assignee must be a member of this project', 404);
                    return res.redirect('/todos');
                }
                data.assigneeId = resolvedAssigneeId;
            }
        }
    }

    Object.keys(data).forEach((key) => {
        if (data[key] === undefined) delete data[key];
    });

    const todo = await prisma.todo.update({
        where: { id: todoId },
        data,
        include: TODO_INCLUDES
    });

    if (!isPersonal) {
        if (data.assigneeId !== undefined && data.assigneeId !== existing.assigneeId) {
            const assigneeLabel = todo.assignee?.email ?? 'Unassigned';
            await recordTaskActivity({
                actorId: req.auth.userId,
                actorEmail: req.auth.email,
                action: 'task.assigned',
                todo,
                message: `${req.auth.email} assigned "${todo.title}" to ${assigneeLabel}`
            });
        }
        if (data.status !== undefined && data.status !== existing.status) {
            await recordTaskActivity({
                actorId: req.auth.userId,
                actorEmail: req.auth.email,
                action: 'task.status_changed',
                todo,
                message: `${req.auth.email} moved "${todo.title}" to ${STATUS_LABELS[data.status]}`
            });
        }
    }

    if (wantsJson(req)) {
        return jsonOk(res, { message: 'Todo updated', todo: serializeTodoForUser(todo, req.auth.userId) });
    }
    return res.redirect('/todos');
}

// GET tasks page bundle — projects + tasks in one request (faster than parallel fetches)
router.get('/workspace', requireAuth, async function (req, res) {
    if (!wantsJson(req)) {
        return res.redirect('/tasks');
    }

    const userId = req.auth.userId;
    const cacheKey = workspaceRequestKey(userId, req.query);

    if (workspaceInflight.has(cacheKey)) {
        try {
            const payload = await workspaceInflight.get(cacheKey);
            return jsonOk(res, payload);
        } catch (error) {
            console.error('[todos workspace GET]', error);
            const { status, message } = workspaceErrorResponse(error);
            return jsonError(res, message, status);
        }
    }

    const work = runWorkspaceExclusive(function () {
        return loadTasksWorkspace(userId, req.auth.email, req.query);
    });
    workspaceInflight.set(cacheKey, work);

    try {
        const payload = await work;
        return jsonOk(res, payload);
    } catch (error) {
        console.error('[todos workspace GET]', error);
        const { status, message } = workspaceErrorResponse(error);
        return jsonError(res, message, status);
    } finally {
        workspaceInflight.delete(cacheKey);
    }
});

// GET todos (?kind=personal|task — personal is private; task is PM work)
router.get('/', requireAuth, async function (req, res) {
    try {
    const kind = parseKind(req.query.kind);

    if (kind === 'personal') {
        let todos = await prisma.todo.findMany({
            where: { userId: req.auth.userId, kind: 'personal' }
        });
        todos = todos.map(enrichTodo);

        if (req.query && typeof req.query.q === 'string' && req.query.q.trim()) {
            const search = req.query.q.trim().toLowerCase();
            todos = todos.filter((t) => t.title.toLowerCase().includes(search));
        }
        if (req.query.filter === 'active') {
            todos = todos.filter((t) => !t.done);
        } else if (req.query.filter === 'completed') {
            todos = todos.filter((t) => t.done);
        }

        if (req.query.sort === 'oldest') {
            todos.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } else if (req.query.sort === 'az') {
            todos.sort((a, b) => a.title.localeCompare(b.title));
        } else if (req.query.sort === 'due') {
            todos.sort(function (a, b) {
                if (!a.dueDate && !b.dueDate) {
                    return new Date(b.createdAt) - new Date(a.createdAt);
                }
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate) - new Date(b.dueDate);
            });
        } else {
            todos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        if (wantsJson(req)) {
            return jsonOk(res, {
                email: req.auth.email,
                kind: 'personal',
                todos: todos.map((todo) => serializeTodoForUser(todo, req.auth.userId)),
                filter: req.query.filter || 'all',
                sort: req.query.sort || 'newest',
                query: req.query.q || ''
            });
        }

        return res.render('todos', {
            title: 'My todos',
            todos,
            kind: 'personal',
            filter: req.query.filter || 'all',
            sort: req.query.sort || 'newest',
            query: req.query.q || '',
            email: req.auth.email,
            currentUserId: req.auth.userId
        });
    }

    const { scope, where } = await buildTaskTodoWhere(req);

    if (wantsJson(req)) {
        const rawTodos = await prisma.todo.findMany({
            where,
            include: TODO_INCLUDES
        });
        const todos = applyTodoListFilters(rawTodos.map(enrichTodo), req.query);

        return jsonOk(res, {
            email: req.auth.email,
            kind: 'task',
            todos: todos.map((todo) => serializeTodoForUser(todo, req.auth.userId)),
            filter: req.query.filter || 'all',
            sort: req.query.sort || 'newest',
            query: req.query.q || '',
            projectId: req.query.projectId || null,
            scope,
            assigneeId: req.query.assigneeId || null
        });
    }

    await ensureInboxProject(req.auth.userId, { repair: false });

    const [rawProjects, rawTodos] = await Promise.all([
        prisma.project.findMany({
            where: { ...accessibleProjectWhere(req.auth.userId), status: 'active' },
            orderBy: [{ isInbox: 'desc' }, { createdAt: 'asc' }]
        }),
        prisma.todo.findMany({
            where,
            include: TODO_INCLUDES
        })
    ]);

    const projects = await enrichProjectsWithStats(req.auth.userId, rawProjects);
    const todos = applyTodoListFilters(rawTodos.map(enrichTodo), req.query);

    let projectMembers = [];
    const memberProjectId = req.query.projectId || projects.find((p) => p.isInbox)?.id;
    if (memberProjectId) {
        projectMembers = await getProjectMembers(String(memberProjectId));
    }

    res.render('todos', {
        title: 'Todo List',
        todos,
        projects,
        projectMembers,
        projectId: req.query.projectId || '',
        filter: req.query.filter || 'all',
        sort: req.query.sort || 'newest',
        statusFilter: req.query.status || '',
        priorityFilter: req.query.priority || '',
        scope,
        assigneeFilter: req.query.assigneeId || '',
        query: req.query.q || '',
        editing: req.query.edit || null,
        email: req.auth.email,
        currentUserId: req.auth.userId
    });
    } catch (error) {
        console.error('[todos GET]', error);
        if (wantsJson(req)) {
            return jsonError(res, 'Failed to load tasks. Check that the database is reachable.', 500);
        }
        return res.status(500).render('error', {
            message: 'Failed to load tasks',
            error: { status: 500, stack: '' }
        });
    }
});

// POST create todo (kind=personal for private notes; kind=task for PM work)
router.post('/', requireAuth, async function (req, res) {
    const {
        title,
        dueDate,
        repeatType,
        repeatOn,
        priority,
        status,
        description,
        projectId,
        assigneeId,
        kind: bodyKind
    } = req.body;

    if (!title || !title.trim()) {
        if (wantsJson(req)) return jsonError(res, 'title is required', 400);
        return res.redirect('/todos');
    }

    const kind = parseKind(bodyKind);

    if (kind === 'personal') {
        const normalizedRepeatOn = normalizeRepeatOn({ repeatOn, repeatDays: req.body.repeatDays });
        const selectedRepeatType = repeatType === 'weekly' && normalizedRepeatOn ? 'weekly' : 'none';
        const dueDateValue = dueDate
            ? new Date(dueDate)
            : (selectedRepeatType === 'weekly' ? getNextWeeklyDate(normalizedRepeatOn) : null);

        const todo = await prisma.todo.create({
            data: {
                kind: 'personal',
                title: title.trim(),
                dueDate: dueDateValue,
                repeatType: selectedRepeatType,
                repeatOn: selectedRepeatType === 'weekly' ? normalizedRepeatOn : null,
                userId: req.auth.userId,
                projectId: null,
                assigneeId: null,
                done: false,
                status: 'todo'
            }
        });

        if (wantsJson(req)) {
            return jsonOk(res, {
                message: 'Todo created',
                todo: serializeTodoForUser(enrichTodo(todo), req.auth.userId)
            }, 201);
        }
        return res.redirect('/todos');
    }

    const resolvedProjectId = await resolveProjectId(req.auth.userId, projectId || null);
    if (!resolvedProjectId) {
        if (wantsJson(req)) return jsonError(res, 'Project not found', 404);
        return res.redirect('/todos');
    }

    let resolvedAssigneeId = null;
    if (assigneeId) {
        resolvedAssigneeId = await resolveAssigneeForProject(assigneeId, resolvedProjectId);
        if (!resolvedAssigneeId) {
            if (wantsJson(req)) return jsonError(res, 'Assignee must be a member of this project', 404);
            return res.redirect('/todos');
        }
    }

    const normalizedRepeatOn = normalizeRepeatOn({ repeatOn, repeatDays: req.body.repeatDays });
    const selectedRepeatType = repeatType === 'weekly' && normalizedRepeatOn ? 'weekly' : 'none';
    const dueDateValue = dueDate
        ? new Date(dueDate)
        : (selectedRepeatType === 'weekly' ? getNextWeeklyDate(normalizedRepeatOn) : undefined);

    const selectedStatus = VALID_STATUSES.includes(status) ? status : 'todo';
    const selectedPriority = VALID_PRIORITIES.includes(priority) ? priority : 'medium';

    const todo = await prisma.todo.create({
        data: {
            kind: 'task',
            title: title.trim(),
            dueDate: dueDateValue,
            repeatType: selectedRepeatType,
            repeatOn: selectedRepeatType === 'weekly' ? normalizedRepeatOn : null,
            priority: selectedPriority,
            status: selectedStatus,
            done: selectedStatus === 'done',
            description: description?.trim() || null,
            projectId: resolvedProjectId,
            assigneeId: resolvedAssigneeId,
            userId: req.auth.userId
        },
        include: TODO_INCLUDES
    });

    await recordTaskActivity({
        actorId: req.auth.userId,
        actorEmail: req.auth.email,
        action: 'task.created',
        todo,
        message: `${req.auth.email} created "${todo.title}"`
    });

    if (wantsJson(req)) {
        return jsonOk(res, { message: 'Todo created', todo: serializeTodoForUser(todo, req.auth.userId) }, 201);
    }
    res.redirect('/todos');
});

router.post('/edit', requireAuth, async function (req, res) {
    return updateTodoHandler(req, res, parseTodoId(req.body.id));
});

async function editTodoByParam(req, res) {
    return updateTodoHandler(req, res, parseTodoId(req.params.id));
}

router.put('/edit/:id', requireAuth, editTodoByParam);
router.patch('/edit/:id', requireAuth, editTodoByParam);

router.get('/:id/comments', requireAuth, async function (req, res) {
    const todoId = parseTodoId(req.params.id);
    if (!todoId) return jsonError(res, 'Invalid todo id', 400);

    const existing = await findAccessibleTodo(todoId, req.auth.userId);
    if (!existing) return jsonError(res, 'Task not found', 404);

    const comments = await prisma.taskComment.findMany({
        where: { todoId },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, email: true } } }
    });

    return jsonOk(res, { comments: comments.map(serializeComment) });
});

router.post('/:id/comments', requireAuth, async function (req, res) {
    const todoId = parseTodoId(req.params.id);
    const { body } = req.body;

    if (!todoId) return jsonError(res, 'Invalid todo id', 400);
    if (!body || !String(body).trim()) return jsonError(res, 'Comment body is required', 400);

    const existing = await findAccessibleTodo(todoId, req.auth.userId);
    if (!existing) return jsonError(res, 'Todo not found', 404);

    const comment = await prisma.taskComment.create({
        data: { todoId, userId: req.auth.userId, body: String(body).trim() },
        include: { user: { select: { id: true, email: true } } }
    });

    await recordTaskActivity({
        actorId: req.auth.userId,
        actorEmail: req.auth.email,
        action: 'task.commented',
        todo: existing,
        message: `${req.auth.email} commented on "${existing.title}"`
    });

    return jsonOk(res, { message: 'Comment added', comment: serializeComment(comment) }, 201);
});

router.delete('/:id/comments/:commentId', requireAuth, async function (req, res) {
    const todoId = parseTodoId(req.params.id);
    const commentId = parseTodoId(req.params.commentId);

    if (!todoId || !commentId) return jsonError(res, 'Invalid id', 400);

    const existing = await findAccessibleTodo(todoId, req.auth.userId);
    if (!existing) return jsonError(res, 'Todo not found', 404);

    const comment = await prisma.taskComment.findFirst({
        where: { id: commentId, todoId }
    });
    if (!comment) return jsonError(res, 'Comment not found', 404);

    const canDelete = comment.userId === req.auth.userId || existing.userId === req.auth.userId;
    if (!canDelete) return jsonError(res, 'You cannot delete this comment', 403);

    await prisma.taskComment.delete({ where: { id: commentId } });
    return jsonOk(res, { message: 'Comment deleted', id: commentId });
});

// PATCH move task to another project
router.patch('/:id/project', requireAuth, async function (req, res) {
    const todoId = parseTodoId(req.params.id);
    const { projectId } = req.body;

    if (!todoId) return jsonError(res, 'Invalid todo id', 400);

    const existing = await prisma.todo.findFirst({
        where: { id: todoId, userId: req.auth.userId, kind: 'task' }
    });
    if (!existing) return jsonError(res, 'Task not found or you cannot move it', 404);

    const resolvedProjectId = await resolveProjectId(req.auth.userId, projectId || null);
    if (!resolvedProjectId) return jsonError(res, 'Project not found', 404);

    const todo = await prisma.todo.update({
        where: { id: todoId },
        data: { projectId: resolvedProjectId },
        include: TODO_INCLUDES
    });

    if (existing.projectId !== resolvedProjectId) {
        await recordTaskActivity({
            actorId: req.auth.userId,
            actorEmail: req.auth.email,
            action: 'task.moved',
            todo,
            message: `${req.auth.email} moved "${todo.title}" to ${todo.project?.name ?? 'another project'}`
        });
    }

    return jsonOk(res, { message: 'Task moved', todo: serializeTodoForUser(todo, req.auth.userId) });
});

// PATCH status (kanban for tasks; done/todo toggle for personal todos)
router.patch('/:id/status', requireAuth, async function (req, res) {
    const todoId = parseTodoId(req.params.id);
    const { status, order } = req.body;

    if (!todoId) return jsonError(res, 'Invalid todo id', 400);
    if (!status) return jsonError(res, 'Status is required', 400);

    const personal = await findPersonalTodo(todoId, req.auth.userId);
    if (personal) {
        if (status !== 'todo' && status !== 'done') {
            return jsonError(res, 'Personal todos support only todo or done', 400);
        }
        const todo = await prisma.todo.update({
            where: { id: todoId },
            data: { status, done: status === 'done' }
        });
        return jsonOk(res, {
            message: 'Todo updated',
            todo: serializeTodoForUser(enrichTodo(todo), req.auth.userId)
        });
    }

    if (!VALID_STATUSES.includes(status)) {
        return jsonError(res, 'Valid status required: todo, in_progress, done', 400);
    }

    const existing = await findAccessibleTodo(todoId, req.auth.userId);
    if (!existing) return jsonError(res, 'Task not found', 404);

    const data = {
        status,
        done: status === 'done'
    };
    if (order !== undefined) data.order = Number(order) || 0;

    const todo = await prisma.todo.update({
        where: { id: todoId },
        data,
        include: TODO_INCLUDES
    });

    if (existing.status !== status) {
        await recordTaskActivity({
            actorId: req.auth.userId,
            actorEmail: req.auth.email,
            action: 'task.status_changed',
            todo,
            message: `${req.auth.email} moved "${todo.title}" to ${STATUS_LABELS[status]}`
        });
    }

    return jsonOk(res, { message: 'Status updated', todo: serializeTodoForUser(todo, req.auth.userId) });
});

async function deleteTodoHandler(req, res, todoId) {
    if (!todoId) {
        if (wantsJson(req)) return jsonError(res, 'Invalid todo id', 400);
        return res.redirect('/todos');
    }

    const existing = await prisma.todo.findFirst({
        where: { id: todoId, userId: req.auth.userId }
    });
    if (!existing) {
        if (wantsJson(req)) return jsonError(res, 'Todo not found', 404);
        return res.redirect('/todos');
    }

    if (existing.kind === 'task') {
        await recordTaskActivity({
            actorId: req.auth.userId,
            actorEmail: req.auth.email,
            action: 'task.deleted',
            todo: existing,
            message: `${req.auth.email} deleted "${existing.title}"`
        });
    }

    await prisma.todo.delete({ where: { id: todoId } });

    if (wantsJson(req)) return jsonOk(res, { message: 'Todo deleted', id: todoId });
    return res.redirect('/todos');
}

router.post('/delete', requireAuth, async function (req, res) {
    return deleteTodoHandler(req, res, parseTodoId(req.body.id));
});

router.delete('/delete/:id', requireAuth, async function (req, res) {
    return deleteTodoHandler(req, res, parseTodoId(req.params.id));
});

// toggle — cycle status for API, legacy HTML redirect
router.post('/toggle', requireAuth, async function (req, res) {
    const todoId = parseTodoId(req.body.id);
    if (!todoId) return res.redirect('/todos');

    const personal = await findPersonalTodo(todoId, req.auth.userId);
    if (personal) {
        const nextDone = !personal.done;
        await prisma.todo.update({
            where: { id: todoId },
            data: {
                done: nextDone,
                status: nextDone ? 'done' : 'todo'
            }
        });
    } else {
        const todo = await findAccessibleTodo(todoId, req.auth.userId);
        if (todo) {
            const nextStatus = todo.status === 'todo'
                ? 'in_progress'
                : todo.status === 'in_progress'
                    ? 'done'
                    : 'todo';

            await prisma.todo.update({
                where: { id: todoId },
                data: { status: nextStatus, done: nextStatus === 'done' }
            });
        }
    }

    if (wantsJson(req)) {
        return jsonOk(res, { message: 'Status toggled' });
    }
    res.redirect('/todos');
});

router.post('/clear', requireAuth, async function (req, res) {
    const result = await prisma.todo.deleteMany({
        where: {
            userId: req.auth.userId,
            kind: 'personal',
            done: true
        }
    });

    if (wantsJson(req)) {
        return jsonOk(res, { message: 'Completed todos cleared', count: result.count });
    }
    res.redirect('/todos');
});

module.exports = router;
