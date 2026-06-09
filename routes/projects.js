const express = require('express');
const router = express.Router();
const { prisma } = require('../shared/prisma.service.js');
const { wantsJson, jsonOk, jsonError } = require('../shared/api-response.js');
const { requireAuth } = require('../shared/require-auth.js');
const {
    ensureInboxProject,
    ensureProjectOwnerMember,
    getProjectStats,
    enrichProjects: enrichProjectsWithStats,
    serializeProject,
    isValidProjectStatus,
    accessibleProjectWhere,
    findAccessibleProject,
    isProjectOwner,
    getProjectMembers
} = require('../shared/project.service.js');
const { logActivity } = require('../shared/activity.service.js');
const { getWorkspaceForUser, canCreateProject } = require('../shared/workspace.service.js');

function parseProjectId(value) {
    if (value === undefined || value === null) return null;
    const id = String(value).trim();
    return id.length > 0 ? id : null;
}

function parseUserId(value) {
    return parseProjectId(value);
}

function projectStatusFilter(view) {
    if (view === 'archived') return { status: 'archived' };
    if (view === 'all') return {};
    return { status: 'active' };
}

// GET all projects with stats (?view=active|archived|all)
router.get('/', requireAuth, async function (req, res) {
    const hasInbox = await prisma.project.findFirst({
        where: { userId: req.auth.userId, isInbox: true },
        select: { id: true }
    });
    if (!hasInbox) {
        await ensureInboxProject(req.auth.userId, { repair: false });
    }

    const view = req.query.view || 'active';
    const projects = await prisma.project.findMany({
        where: { ...accessibleProjectWhere(req.auth.userId), ...projectStatusFilter(view) },
        orderBy: [{ isInbox: 'desc' }, { createdAt: 'asc' }]
    });

    const enriched = await enrichProjectsWithStats(req.auth.userId, projects);

    if (wantsJson(req)) {
        return jsonOk(res, { projects: enriched, view });
    }

    return res.render('projects', {
        title: 'Projects',
        projects: enriched,
        view,
        message: req.query.message || ''
    });
});

// POST create project
router.post('/', requireAuth, async function (req, res) {
    const { name, description, color } = req.body;

    if (!name || !name.trim()) {
        if (wantsJson(req)) return jsonError(res, 'Project name is required', 400);
        return res.redirect('/projects?message=Project+name+is+required');
    }

    const trimmedName = name.trim();
    if (trimmedName.toLowerCase() === 'inbox') {
        if (wantsJson(req)) return jsonError(res, 'Inbox is reserved', 409);
        return res.redirect('/projects?message=Inbox+is+reserved');
    }

    const existing = await prisma.project.findFirst({
        where: { userId: req.auth.userId, name: trimmedName }
    });
    if (existing) {
        if (wantsJson(req)) return jsonError(res, 'Project already exists', 409);
        return res.redirect('/projects?message=Project+already+exists');
    }

    const workspace = await getWorkspaceForUser(req.auth.userId);
    const projectCapacity = await canCreateProject(workspace);
    if (!projectCapacity.allowed) {
        if (wantsJson(req)) return jsonError(res, projectCapacity.reason, 402);
        return res.redirect('/projects?message=' + encodeURIComponent(projectCapacity.reason));
    }

    const project = await prisma.project.create({
        data: {
            name: trimmedName,
            description: description?.trim() || null,
            color: color || '#4f46e5',
            userId: req.auth.userId
        }
    });

    await ensureProjectOwnerMember(project.id, req.auth.userId, 'owner');

    const stats = await getProjectStats(project.id);

    if (wantsJson(req)) {
        return jsonOk(res, { message: 'Project created', project: serializeProject(project, stats, req.auth.userId) }, 201);
    }
    return res.redirect('/todos?projectId=' + project.id);
});

// GET project members (for assignee picker)
router.get('/:id/members', requireAuth, async function (req, res) {
    const projectId = parseProjectId(req.params.id);
    if (!projectId) return jsonError(res, 'Invalid project id', 400);

    const project = await findAccessibleProject(projectId, req.auth.userId);
    if (!project) return jsonError(res, 'Project not found', 404);

    const members = await getProjectMembers(projectId);
    return jsonOk(res, { members, projectId });
});

// POST add project member (owner only, by email)
router.post('/:id/members', requireAuth, async function (req, res) {
    const projectId = parseProjectId(req.params.id);
    const { email, userId: bodyUserId } = req.body;

    if (!projectId) {
        if (wantsJson(req)) return jsonError(res, 'Invalid project id', 400);
        return res.redirect('/projects');
    }

    const project = await prisma.project.findFirst({
        where: { id: projectId, userId: req.auth.userId }
    });
    if (!project) {
        if (wantsJson(req)) return jsonError(res, 'Project not found or you are not the owner', 404);
        return res.redirect('/projects?message=Not+authorized');
    }
    if (project.isInbox) {
        if (wantsJson(req)) return jsonError(res, 'Cannot add members to Inbox', 400);
        return res.redirect('/projects/' + projectId);
    }

    let targetUser = null;
    if (bodyUserId) {
        targetUser = await prisma.user.findUnique({ where: { id: String(bodyUserId).trim() } });
    } else if (email) {
        targetUser = await prisma.user.findFirst({
            where: { email: { equals: String(email).trim(), mode: 'insensitive' } }
        });
    }

    if (!targetUser) {
        if (wantsJson(req)) return jsonError(res, 'User not found', 404);
        return res.redirect('/projects/' + projectId + '?message=User+not+found');
    }

    if (targetUser.id === req.auth.userId) {
        if (wantsJson(req)) return jsonError(res, 'You are already the project owner', 409);
        return res.redirect('/projects/' + projectId);
    }

    const existingMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: targetUser.id } }
    });
    if (existingMember) {
        if (wantsJson(req)) return jsonError(res, 'User is already a member', 409);
        return res.redirect('/projects/' + projectId + '?message=Already+a+member');
    }

    await prisma.projectMember.create({
        data: { projectId, userId: targetUser.id, role: 'member' }
    });

    await logActivity({
        actorId: req.auth.userId,
        action: 'project.member_added',
        entityType: 'project',
        entityId: projectId,
        projectId,
        message: `${req.auth.email} added ${targetUser.email} to ${project.name}`
    });

    const members = await getProjectMembers(projectId);

    if (wantsJson(req)) {
        return jsonOk(res, { message: 'Member added', members }, 201);
    }
    return res.redirect('/projects/' + projectId + '?message=Member+added');
});

// DELETE remove project member (owner only, cannot remove owner)
router.delete('/:id/members/:userId', requireAuth, async function (req, res) {
    return removeMemberHandler(req, res, parseProjectId(req.params.id), parseUserId(req.params.userId));
});

router.post('/:id/members/remove/:userId', requireAuth, async function (req, res) {
    return removeMemberHandler(req, res, parseProjectId(req.params.id), parseUserId(req.params.userId));
});

async function removeMemberHandler(req, res, projectId, memberUserId) {
    if (!projectId || !memberUserId) {
        if (wantsJson(req)) return jsonError(res, 'Invalid id', 400);
        return res.redirect('/projects');
    }

    const project = await prisma.project.findFirst({
        where: { id: projectId, userId: req.auth.userId }
    });
    if (!project) {
        if (wantsJson(req)) return jsonError(res, 'Project not found or you are not the owner', 404);
        return res.redirect('/projects');
    }

    const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: memberUserId } }
    });
    if (!member) {
        if (wantsJson(req)) return jsonError(res, 'Member not found', 404);
        return res.redirect('/projects/' + projectId);
    }
    if (member.role === 'owner') {
        if (wantsJson(req)) return jsonError(res, 'Cannot remove project owner', 400);
        return res.redirect('/projects/' + projectId);
    }

    const removedUser = await prisma.user.findUnique({
        where: { id: memberUserId },
        select: { email: true }
    });

    await prisma.projectMember.delete({
        where: { projectId_userId: { projectId, userId: memberUserId } }
    });

    await logActivity({
        actorId: req.auth.userId,
        action: 'project.member_removed',
        entityType: 'project',
        entityId: projectId,
        projectId,
        message: `${req.auth.email} removed ${removedUser?.email ?? 'a member'} from ${project.name}`
    });

    await prisma.todo.updateMany({
        where: { projectId, assigneeId: memberUserId },
        data: { assigneeId: null }
    });

    if (wantsJson(req)) {
        return jsonOk(res, { message: 'Member removed', userId: memberUserId });
    }
    return res.redirect('/projects/' + projectId + '?message=Member+removed');
}

// GET single project
router.get('/:id', requireAuth, async function (req, res) {
    const projectId = parseProjectId(req.params.id);
    if (!projectId) {
        if (wantsJson(req)) return jsonError(res, 'Invalid project id', 400);
        return res.redirect('/projects');
    }

    const project = await findAccessibleProject(projectId, req.auth.userId);
    if (!project) {
        if (wantsJson(req)) return jsonError(res, 'Project not found', 404);
        return res.redirect('/projects?message=Project+not+found');
    }

    const [stats, members] = await Promise.all([
        getProjectStats(project.id),
        getProjectMembers(project.id)
    ]);
    const serialized = serializeProject(project, stats, req.auth.userId);
    serialized.memberCount = members.length;
    const isOwner = await isProjectOwner(projectId, req.auth.userId);

    if (wantsJson(req)) {
        return jsonOk(res, { project: serialized, members, isOwner });
    }

    return res.render('project-detail', {
        title: project.name,
        project: serialized,
        members,
        isOwner,
        message: req.query.message || ''
    });
});

// PATCH update project (API)
router.patch('/:id', requireAuth, async function (req, res) {
    return updateProjectHandler(req, res, parseProjectId(req.params.id));
});

// POST edit project (HTML form)
router.post('/edit/:id', requireAuth, async function (req, res) {
    return updateProjectHandler(req, res, parseProjectId(req.params.id));
});

async function updateProjectHandler(req, res, projectId) {
    if (!projectId) {
        if (wantsJson(req)) return jsonError(res, 'Invalid project id', 400);
        return res.redirect('/projects');
    }

    const project = await prisma.project.findFirst({
        where: { id: projectId, userId: req.auth.userId }
    });
    if (!project) {
        if (wantsJson(req)) return jsonError(res, 'Project not found', 404);
        return res.redirect('/projects?message=Project+not+found');
    }

    const { name, description, color, status } = req.body;
    const data = {};

    if (name !== undefined) {
        if (!name.trim()) {
            if (wantsJson(req)) return jsonError(res, 'Project name is required', 400);
            return res.redirect('/projects/' + projectId + '?message=Name+required');
        }
        if (project.isInbox) {
            if (wantsJson(req)) return jsonError(res, 'Cannot rename Inbox', 400);
            return res.redirect('/projects/' + projectId);
        }
        data.name = name.trim();
    }
    if (description !== undefined) data.description = description?.trim() || null;
    if (color !== undefined) data.color = color;
    if (status !== undefined && !project.isInbox) {
        if (!isValidProjectStatus(status)) {
            if (wantsJson(req)) return jsonError(res, 'Invalid status', 400);
            return res.redirect('/projects/' + projectId);
        }
        data.status = status;
    }

    const updated = await prisma.project.update({
        where: { id: projectId },
        data
    });

    const stats = await getProjectStats(updated.id);

    if (wantsJson(req)) {
        return jsonOk(res, { message: 'Project updated', project: serializeProject(updated, stats, req.auth.userId) });
    }
    return res.redirect('/projects/' + projectId);
}

// DELETE project (API — moves tasks to inbox)
router.delete('/:id', requireAuth, async function (req, res) {
    return deleteProjectHandler(req, res, parseProjectId(req.params.id));
});

// POST delete project (HTML form)
router.post('/delete/:id', requireAuth, async function (req, res) {
    return deleteProjectHandler(req, res, parseProjectId(req.params.id));
});

async function deleteProjectHandler(req, res, projectId) {
    if (!projectId) {
        if (wantsJson(req)) return jsonError(res, 'Invalid project id', 400);
        return res.redirect('/projects');
    }

    const project = await prisma.project.findFirst({
        where: { id: projectId, userId: req.auth.userId }
    });
    if (!project) {
        if (wantsJson(req)) return jsonError(res, 'Project not found', 404);
        return res.redirect('/projects?message=Project+not+found');
    }
    if (project.isInbox) {
        if (wantsJson(req)) return jsonError(res, 'Cannot delete Inbox', 400);
        return res.redirect('/projects?message=Cannot+delete+Inbox');
    }

    const inbox = await ensureInboxProject(req.auth.userId);

    await prisma.todo.updateMany({
        where: { projectId },
        data: { projectId: inbox.id }
    });

    await logActivity({
        actorId: req.auth.userId,
        action: 'project.deleted',
        entityType: 'project',
        entityId: projectId,
        projectId: null,
        message: `${req.auth.email} deleted project "${project.name}"`
    });

    await prisma.project.delete({ where: { id: projectId } });

    if (wantsJson(req)) {
        return jsonOk(res, { message: 'Project deleted', id: projectId });
    }
    return res.redirect('/projects?message=Project+deleted');
}

// POST archive / restore (HTML + JSON via wantsJson)
router.post('/:id/archive', requireAuth, async function (req, res) {
    return setProjectStatus(req, res, parseProjectId(req.params.id), 'archived');
});

router.post('/:id/restore', requireAuth, async function (req, res) {
    return setProjectStatus(req, res, parseProjectId(req.params.id), 'active');
});

async function setProjectStatus(req, res, projectId, status) {
    if (!projectId) {
        if (wantsJson(req)) return jsonError(res, 'Invalid project id', 400);
        return res.redirect('/projects');
    }

    const project = await prisma.project.findFirst({
        where: { id: projectId, userId: req.auth.userId }
    });
    if (!project) {
        if (wantsJson(req)) return jsonError(res, 'Project not found', 404);
        return res.redirect('/projects');
    }
    if (project.isInbox) {
        if (wantsJson(req)) return jsonError(res, 'Cannot archive Inbox', 400);
        return res.redirect('/projects');
    }

    const updated = await prisma.project.update({
        where: { id: projectId },
        data: { status }
    });

    const stats = await getProjectStats(updated.id);
    const message = status === 'archived' ? 'Project archived' : 'Project restored';

    if (wantsJson(req)) {
        return jsonOk(res, { message, project: serializeProject(updated, stats, req.auth.userId) });
    }
    return res.redirect('/projects?view=' + (status === 'archived' ? 'archived' : 'active') + '&message=' + encodeURIComponent(message));
}

module.exports = router;
