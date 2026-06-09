var express = require('express');
var router = express.Router();
const { prisma } = require('../shared/prisma.service.js');
const { wantsJson, jsonOk, jsonError } = require('../shared/api-response.js');
const { requireAuth } = require('../shared/require-auth.js');
const { logActivity } = require('../shared/activity.service.js');
const {
    serializeUser,
    isWorkspaceOwner,
    isWorkspaceManager,
    getWorkspaceRole,
    setWorkspaceMemberRole,
    findUserById,
    getManageableProjects,
    normalizeEmail,
    normalizeInvitedMemberRole,
    updateOwnProfile
} = require('../shared/user.service.js');
const {
    getWorkspaceForOwner,
    getWorkspaceForRequest,
    listWorkspacesForUser,
    serializeWorkspace,
    canAddWorkspaceMember,
    ownerNeedsOnboarding,
    buildBillingSnapshot
} = require('../shared/workspace.service.js');
const { getWorkspaceIdFromRequest } = require('../shared/require-auth.js');
const {
    createWorkspaceInvite,
    serializeInvite,
    buildWhatsAppUrl,
    buildInviteUrl
} = require('../shared/invite.service.js');

function parseUserId(value) {
    const userId = String(value || '').trim();
    return userId.length > 0 ? userId : null;
}

async function listWorkspaceUsers(workspaceId, ownerId) {
    const memberships = await prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatarUrl: true,
                    role: true,
                    statusMessage: true,
                    availability: true,
                    phone: true,
                    extension: true,
                    department: true,
                    designation: true,
                    location: true,
                    timezone: true,
                    bio: true,
                    language: true
                }
            }
        },
        orderBy: { joinedAt: 'asc' }
    });
    return memberships.map(function (row) {
        const isOwner = row.user.id === ownerId;
        return {
            ...serializeUser(row.user),
            teamEmail: row.teamEmail || null,
            displayEmail: row.teamEmail || row.user.email,
            isOwner,
            workspaceRole: isOwner ? 'owner' : (row.role || 'member')
        };
    });
}

async function assertTeamEmailAvailable(workspaceId, teamEmail, excludeUserId) {
    if (!teamEmail) return null;
    const taken = await prisma.workspaceMember.findFirst({
        where: {
            workspaceId,
            teamEmail: { equals: teamEmail, mode: 'insensitive' },
            userId: excludeUserId ? { not: excludeUserId } : undefined
        }
    });
    if (taken) {
        return 'That workspace email is already used by someone else in this workspace';
    }
    return null;
}

router.get('/', requireAuth, async function (req, res) {
    try {
        const currentUser = await findUserById(req.auth.userId);
        if (!currentUser) {
            return jsonError(res, 'Your session is no longer valid. Please sign in again.', 401);
        }
        const activeUser = (await normalizeInvitedMemberRole(currentUser.id)) || currentUser;

        const workspace = await getWorkspaceForRequest(req);
        const isOwner = workspace ? workspace.ownerId === activeUser.id : false;
        const workspaceRole = workspace
            ? await getWorkspaceRole(activeUser.id, workspace)
            : null;
        const canManageWorkspace = isOwner || workspaceRole === 'admin';
        const users = workspace
            ? await listWorkspaceUsers(workspace.id, workspace.ownerId)
            : (await prisma.user.findMany({
                select: { id: true, email: true, name: true, avatarUrl: true, role: true },
                orderBy: { email: 'asc' }
            })).map(serializeUser);

        const manageableProjects = await getManageableProjects(activeUser.id, {
            userRole: activeUser.role,
            workspaceRole
        });
        const needsOnboarding = await ownerNeedsOnboarding(activeUser);

        let currentUserPayload = {
            ...serializeUser(activeUser),
            isOwner,
            workspaceRole
        };
        if (workspace) {
            const selfMembership = await prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: { workspaceId: workspace.id, userId: activeUser.id }
                }
            });
            currentUserPayload.teamEmail = selfMembership?.teamEmail || null;
            currentUserPayload.displayEmail = selfMembership?.teamEmail || activeUser.email;
        }

        const workspaces = await listWorkspacesForUser(activeUser.id);

        const payload = {
            users,
            currentUser: currentUserPayload,
            canManageWorkspace,
            manageableProjects,
            workspace: serializeWorkspace(workspace),
            workspaces,
            activeWorkspaceId: workspace?.id ?? null,
            needsOnboarding,
            billing: workspace && isOwner ? await buildBillingSnapshot(workspace) : null
        };

        if (canManageWorkspace && workspace) {
            const invites = await prisma.invite.findMany({
                where: { workspaceId: workspace.id, acceptedAt: null },
                orderBy: { createdAt: 'desc' }
            });
            const inviterName = currentUser.name || currentUser.email.split('@')[0];
            payload.invites = invites.map(function (invite) {
                const serialized = serializeInvite(invite);
                serialized.whatsappUrl = buildWhatsAppUrl(
                    serialized.inviteUrl,
                    inviterName,
                    workspace.name
                );
                return serialized;
            });
        }

        if (wantsJson(req)) {
            return jsonOk(res, payload);
        }

        return res.render('users', {
            title: 'Users',
            users: payload.users,
            invites: payload.invites || []
        });
    } catch (error) {
        console.error(error);
        if (wantsJson(req)) {
            return jsonError(res, 'An error occurred', 500);
        }
        return res.status(500).render('error', {
            message: 'An error occurred',
            error: { status: 500, stack: '' }
        });
    }
});

router.post('/invite', requireAuth, async function (req, res) {
    const currentUser = await findUserById(req.auth.userId);
    if (!currentUser) return jsonError(res, 'User not found', 404);
    if (!(await isWorkspaceManager(currentUser.id, getWorkspaceIdFromRequest(req)))) {
        return jsonError(res, 'Only the workspace owner or an admin can invite people', 403);
    }

    const workspace = await getWorkspaceForRequest(req);
    if (!workspace) {
        return jsonError(res, 'Complete workspace onboarding before inviting teammates', 400);
    }

    const email = normalizeEmail(req.body.email);
    if (!email || !email.includes('@')) {
        return jsonError(res, 'A valid email is required', 400);
    }

    const existingMember = await prisma.workspaceMember.findFirst({
        where: {
            workspaceId: workspace.id,
            user: { email: { equals: email, mode: 'insensitive' } }
        }
    });
    if (existingMember) {
        return jsonError(res, 'This person is already in your workspace', 409);
    }

    const capacity = await canAddWorkspaceMember(workspace);
    if (!capacity.allowed) {
        return jsonError(res, capacity.reason, 402);
    }

    const invite = await createWorkspaceInvite({
        workspaceId: workspace.id,
        email,
        invitedById: currentUser.id,
        invitedByUser: currentUser,
        workspace
    });

    const inviterName = currentUser.name || currentUser.email.split('@')[0];
    invite.whatsappUrl = buildWhatsAppUrl(
        invite.inviteUrl,
        inviterName,
        workspace.name,
        req.body.phone
    );

    return jsonOk(res, {
        message: invite.emailSent
            ? 'Invite sent by email. You can also share the link or WhatsApp.'
            : invite.emailSkipped
                ? 'Invite created. Email is not configured ù share the link or WhatsApp below.'
                : 'Invite created, but the email could not be sent. Share the link or WhatsApp below.',
        invite
    }, 201);
});

router.delete('/invites/:id', requireAuth, async function (req, res) {
    const currentUser = await findUserById(req.auth.userId);
    if (!currentUser) return jsonError(res, 'User not found', 404);
    if (!(await isWorkspaceManager(currentUser.id, getWorkspaceIdFromRequest(req)))) {
        return jsonError(res, 'Only the workspace owner or an admin can revoke invites', 403);
    }

    const workspace = await getWorkspaceForRequest(req);
    if (!workspace) return jsonError(res, 'Workspace not found', 404);

    const inviteId = parseUserId(req.params.id);
    if (!inviteId) return jsonError(res, 'Invalid invite id', 400);

    const invite = await prisma.invite.findFirst({
        where: { id: inviteId, workspaceId: workspace.id }
    });
    if (!invite) return jsonError(res, 'Invite not found', 404);

    await prisma.invite.delete({ where: { id: inviteId } });
    return jsonOk(res, { message: 'Invite revoked', id: inviteId });
});

router.patch('/me/profile', requireAuth, async function (req, res) {
    try {
        const user = await updateOwnProfile(req.auth.userId, {
            name: req.body.name,
            teamEmail: req.body.teamEmail,
            avatarUrl: req.body.avatarUrl,
            statusMessage: req.body.statusMessage,
            availability: req.body.availability,
            phone: req.body.phone,
            extension: req.body.extension,
            department: req.body.department,
            designation: req.body.designation,
            location: req.body.location,
            timezone: req.body.timezone,
            bio: req.body.bio,
            language: req.body.language
        }, getWorkspaceIdFromRequest(req));
        return jsonOk(res, { message: 'Profile updated', user });
    } catch (error) {
        if (error && error.status) {
            return jsonError(res, error.message, error.status);
        }
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

router.patch('/:userId/team-email', requireAuth, async function (req, res) {
    const targetUserId = parseUserId(req.params.userId);
    if (!targetUserId) return jsonError(res, 'Invalid user id', 400);

    const currentUser = await findUserById(req.auth.userId);
    if (!currentUser) return jsonError(res, 'User not found', 404);
    if (!(await isWorkspaceManager(currentUser.id, getWorkspaceIdFromRequest(req)))) {
        return jsonError(res, 'Only the workspace owner or an admin can assign workspace emails', 403);
    }

    const workspace = await getWorkspaceForRequest(req);
    if (!workspace) return jsonError(res, 'Workspace not found', 404);

    const membership = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: targetUserId } },
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, role: true } } }
    });
    if (!membership) {
        return jsonError(res, 'This person is not in your workspace', 404);
    }

    const teamEmailRaw = String(req.body.teamEmail || '').trim();
    const teamEmail = teamEmailRaw ? normalizeEmail(teamEmailRaw) : null;
    if (teamEmail && !teamEmail.includes('@')) {
        return jsonError(res, 'Workspace email must be a valid email address', 400);
    }

    const conflict = await assertTeamEmailAvailable(workspace.id, teamEmail, targetUserId);
    if (conflict) return jsonError(res, conflict, 409);

    const updated = await prisma.workspaceMember.update({
        where: { id: membership.id },
        data: { teamEmail }
    });

    const userPayload = {
        ...serializeUser(membership.user),
        teamEmail: updated.teamEmail || null,
        displayEmail: updated.teamEmail || membership.user.email,
        isOwner: membership.user.id === workspace.ownerId,
        workspaceRole: membership.user.id === workspace.ownerId ? 'owner' : (membership.role || 'member')
    };

    return jsonOk(res, {
        message: teamEmail ? 'Workspace email assigned' : 'Workspace email removed',
        user: userPayload
    });
});

router.patch('/:userId/workspace-role', requireAuth, async function (req, res) {
    const targetUserId = parseUserId(req.params.userId);
    if (!targetUserId) return jsonError(res, 'Invalid user id', 400);

    const currentUser = await findUserById(req.auth.userId);
    if (!currentUser) return jsonError(res, 'User not found', 404);

    const workspace = await getWorkspaceForOwner(currentUser.id);
    if (!workspace) {
        return jsonError(res, 'Only the workspace owner can assign roles', 403);
    }

    if (targetUserId === currentUser.id) {
        return jsonError(res, 'You cannot change your own role', 400);
    }

    const role = String(req.body.role || '').trim().toLowerCase();
    try {
        const user = await setWorkspaceMemberRole(workspace.id, workspace.ownerId, targetUserId, role);
        return jsonOk(res, {
            message: role === 'admin' ? 'User promoted to admin' : 'User set to member',
            user
        });
    } catch (error) {
        if (error && error.status) {
            return jsonError(res, error.message, error.status);
        }
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

router.post('/:userId/projects', requireAuth, async function (req, res) {
    const targetUserId = parseUserId(req.params.userId);
    const projectIds = Array.isArray(req.body.projectIds) ? req.body.projectIds : [];

    if (!targetUserId) return jsonError(res, 'Invalid user id', 400);
    if (projectIds.length === 0) return jsonError(res, 'Select at least one project', 400);

    const currentUser = await findUserById(req.auth.userId);
    if (!currentUser) return jsonError(res, 'User not found', 404);

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) return jsonError(res, 'User not found', 404);
    if (targetUser.id === currentUser.id) {
        return jsonError(res, 'You are already on your own projects', 400);
    }

    const uniqueProjectIds = [...new Set(projectIds.map(function (id) { return String(id).trim(); }).filter(Boolean))];
    const projects = await prisma.project.findMany({
        where: {
            id: { in: uniqueProjectIds },
            isInbox: false,
            status: 'active'
        }
    });

    if (projects.length !== uniqueProjectIds.length) {
        return jsonError(res, 'One or more projects were not found', 404);
    }

    const callerCanManageWorkspace = await isWorkspaceManager(
        currentUser.id,
        getWorkspaceIdFromRequest(req)
    );
    for (const project of projects) {
        if (!callerCanManageWorkspace && project.userId !== currentUser.id) {
            return jsonError(res, 'You can only add members to projects you own', 403);
        }
    }

    const added = [];
    const skipped = [];

    for (const project of projects) {
        if (project.userId === targetUser.id) {
            skipped.push({ projectId: project.id, reason: 'owner' });
            continue;
        }

        const existing = await prisma.projectMember.findUnique({
            where: { projectId_userId: { projectId: project.id, userId: targetUser.id } }
        });
        if (existing) {
            skipped.push({ projectId: project.id, reason: 'already_member' });
            continue;
        }

        await prisma.projectMember.create({
            data: { projectId: project.id, userId: targetUser.id, role: 'member' }
        });

        await logActivity({
            actorId: currentUser.id,
            action: 'project.member_added',
            entityType: 'project',
            entityId: project.id,
            projectId: project.id,
            message: `${currentUser.email} added ${targetUser.email} to ${project.name}`
        });

        added.push({ projectId: project.id, name: project.name });
    }

    return jsonOk(res, {
        message: added.length ? 'Member added to projects' : 'No new project memberships were created',
        added,
        skipped
    }, added.length ? 201 : 200);
});

module.exports = router;
