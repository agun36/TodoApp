const { prisma } = require('./prisma.service.js');
const { getWorkspaceForUser } = require('./workspace.service.js');

function getAdminEmails() {
    return (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map(function (email) { return email.trim().toLowerCase(); })
        .filter(Boolean);
}

const MAX_AVATAR_BYTES = 400 * 1024;

const AVAILABILITY_VALUES = new Set([
    'available',
    'busy',
    'away',
    'meeting',
    'dnd',
    'offline'
]);

const PROFILE_LIMITS = {
    statusMessage: 160,
    phone: 30,
    extension: 20,
    department: 100,
    designation: 100,
    location: 100,
    timezone: 64,
    bio: 500,
    language: 10
};

function trimOrNull(value, maxLength) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (maxLength && trimmed.length > maxLength) {
        const err = new Error(`Value is too long (max ${maxLength} characters)`);
        err.status = 400;
        throw err;
    }
    return trimmed;
}

function serializeUser(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.name || null,
        avatarUrl: user.avatarUrl || null,
        role: user.role || 'member',
        statusMessage: user.statusMessage || null,
        availability: user.availability || 'available',
        phone: user.phone || null,
        extension: user.extension || null,
        department: user.department || null,
        designation: user.designation || null,
        location: user.location || null,
        timezone: user.timezone || null,
        bio: user.bio || null,
        language: user.language || 'en'
    };
}

function validateAvatarUrl(value) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;

    const str = String(value).trim();
    if (!str) return null;

    if (/^https?:\/\//i.test(str)) {
        if (str.length > 2048) {
            const err = new Error('Avatar URL is too long');
            err.status = 400;
            throw err;
        }
        return str;
    }

    const match = str.match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) {
        const err = new Error('Avatar must be a JPEG, PNG, WebP, or GIF image');
        err.status = 400;
        throw err;
    }

    const bytes = Buffer.from(match[2], 'base64').length;
    if (bytes > MAX_AVATAR_BYTES) {
        const err = new Error('Avatar image is too large (max 400 KB)');
        err.status = 400;
        throw err;
    }

    return str;
}

function isAdmin(user) {
    return user && user.role === 'admin';
}

const WORKSPACE_ROLES = ['owner', 'admin', 'member'];
const ASSIGNABLE_WORKSPACE_ROLES = ['admin', 'member'];

async function isWorkspaceOwner(userId) {
    if (!userId) return false;
    const workspace = await prisma.workspace.findUnique({ where: { ownerId: userId } });
    return !!workspace;
}

async function getWorkspaceRole(userId, workspace) {
    if (!userId || !workspace) return null;
    if (workspace.ownerId === userId) return 'owner';

    const membership = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId } }
    });
    if (!membership) return null;
    return membership.role || 'member';
}

async function isWorkspaceManager(userId, requestedWorkspaceId) {
    const workspace = await getWorkspaceForUser(userId, requestedWorkspaceId);
    if (!workspace) return false;
    const role = await getWorkspaceRole(userId, workspace);
    return role === 'owner' || role === 'admin';
}

async function setWorkspaceMemberRole(workspaceId, ownerId, targetUserId, role) {
    const workspace = await prisma.workspace.findFirst({
        where: { id: workspaceId, ownerId }
    });
    if (!workspace) {
        const err = new Error('Only the workspace owner can assign roles');
        err.status = 403;
        throw err;
    }
    if (targetUserId === workspace.ownerId) {
        const err = new Error('The workspace owner role cannot be changed');
        err.status = 400;
        throw err;
    }
    if (!ASSIGNABLE_WORKSPACE_ROLES.includes(role)) {
        const err = new Error('Role must be admin or member');
        err.status = 400;
        throw err;
    }

    const membership = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, role: true } } }
    });
    if (!membership) {
        const err = new Error('This person is not in your workspace');
        err.status = 404;
        throw err;
    }

    const updated = await prisma.workspaceMember.update({
        where: { id: membership.id },
        data: { role }
    });

    return {
        ...serializeUser(membership.user),
        teamEmail: updated.teamEmail || null,
        displayEmail: updated.teamEmail || membership.user.email,
        isOwner: false,
        workspaceRole: updated.role
    };
}

async function isInvitedWorkspaceMember(userId) {
    if (!userId) return false;
    const ownsWorkspace = await isWorkspaceOwner(userId);
    if (ownsWorkspace) return false;
    const membership = await prisma.workspaceMember.findFirst({ where: { userId } });
    return !!membership;
}

async function findUserById(userId) {
    return prisma.user.findUnique({ where: { id: userId } });
}

async function adminCount() {
    return prisma.user.count({ where: { role: 'admin' } });
}

function shouldBootstrapAdmin(email) {
    const normalized = String(email || '').trim().toLowerCase();
    return getAdminEmails().includes(normalized);
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

async function isSignupAllowed(email) {
    const normalized = normalizeEmail(email);
    return !!(normalized && normalized.includes('@'));
}

async function resolveRoleForNewUser(email, options) {
    if (options && options.joiningViaInvite) return 'member';
    return 'admin';
}

async function normalizeInvitedMemberRole(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'admin') return user;
    if (!(await isInvitedWorkspaceMember(userId))) return user;
    return prisma.user.update({
        where: { id: userId },
        data: { role: 'member' }
    });
}

async function promoteAdminIfConfigured(userId, email) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role === 'admin') return user;

    if (await isInvitedWorkspaceMember(userId)) return null;

    const shouldPromote =
        shouldBootstrapAdmin(email) || (await adminCount()) === 0;

    if (!shouldPromote) return null;

    return prisma.user.update({
        where: { id: userId },
        data: { role: 'admin' }
    });
}

async function acceptInviteForEmail(email, userId) {
    const { acceptInviteForEmail: acceptByEmail } = require('./invite.service.js');
    return acceptByEmail(email, userId);
}

async function assertTeamEmailAvailable(workspaceId, teamEmail, excludeUserId) {
    if (!teamEmail) return;
    const taken = await prisma.workspaceMember.findFirst({
        where: {
            workspaceId,
            teamEmail: { equals: teamEmail, mode: 'insensitive' },
            userId: excludeUserId ? { not: excludeUserId } : undefined
        }
    });
    if (taken) {
        const err = new Error('That workspace email is already used by someone else in this workspace');
        err.status = 409;
        throw err;
    }
}

async function updateOwnProfile(userId, payload, requestedWorkspaceId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
    }

    const updates = {};
    if (payload && payload.name !== undefined) {
        updates.name = String(payload.name).trim() || null;
    }
    if (payload && payload.avatarUrl !== undefined) {
        updates.avatarUrl = validateAvatarUrl(payload.avatarUrl);
    }
    if (payload && payload.statusMessage !== undefined) {
        updates.statusMessage = trimOrNull(payload.statusMessage, PROFILE_LIMITS.statusMessage);
    }
    if (payload && payload.availability !== undefined) {
        const availability = String(payload.availability || '').trim().toLowerCase();
        if (!AVAILABILITY_VALUES.has(availability)) {
            const err = new Error('Invalid availability status');
            err.status = 400;
            throw err;
        }
        updates.availability = availability;
    }
    if (payload && payload.phone !== undefined) {
        updates.phone = trimOrNull(payload.phone, PROFILE_LIMITS.phone);
    }
    if (payload && payload.extension !== undefined) {
        updates.extension = trimOrNull(payload.extension, PROFILE_LIMITS.extension);
    }
    if (payload && payload.department !== undefined) {
        updates.department = trimOrNull(payload.department, PROFILE_LIMITS.department);
    }
    if (payload && payload.designation !== undefined) {
        updates.designation = trimOrNull(payload.designation, PROFILE_LIMITS.designation);
    }
    if (payload && payload.location !== undefined) {
        updates.location = trimOrNull(payload.location, PROFILE_LIMITS.location);
    }
    if (payload && payload.timezone !== undefined) {
        updates.timezone = trimOrNull(payload.timezone, PROFILE_LIMITS.timezone);
    }
    if (payload && payload.bio !== undefined) {
        updates.bio = trimOrNull(payload.bio, PROFILE_LIMITS.bio);
    }
    if (payload && payload.language !== undefined) {
        updates.language = trimOrNull(payload.language, PROFILE_LIMITS.language) || 'en';
    }

    let updatedUser = user;
    if (Object.keys(updates).length > 0) {
        updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updates
        });
    }

    const workspace = await getWorkspaceForUser(userId, requestedWorkspaceId);
    if (workspace && payload && payload.teamEmail !== undefined) {
        const teamEmailRaw = String(payload.teamEmail).trim();
        const teamEmail = teamEmailRaw ? normalizeEmail(teamEmailRaw) : null;
        if (teamEmail && !teamEmail.includes('@')) {
            const err = new Error('Workspace email must be a valid email address');
            err.status = 400;
            throw err;
        }

        await assertTeamEmailAvailable(workspace.id, teamEmail, userId);

        await prisma.workspaceMember.update({
            where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
            data: { teamEmail }
        });
    }

    const isOwner = workspace ? workspace.ownerId === userId : false;
    const workspaceRole = workspace ? await getWorkspaceRole(userId, workspace) : null;
    const result = {
        ...serializeUser(updatedUser),
        isOwner,
        workspaceRole
    };

    if (workspace) {
        const membership = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: workspace.id, userId } }
        });
        result.teamEmail = membership?.teamEmail || null;
        result.displayEmail = membership?.teamEmail || updatedUser.email;
    }

    return result;
}

async function getManageableProjects(userId, options) {
    const where = {
        isInbox: false,
        status: 'active'
    };

    const userRole = typeof options === 'string' ? options : options?.userRole;
    const workspaceRole = typeof options === 'object' ? options?.workspaceRole : null;
    const canManageAll =
        userRole === 'admin' || workspaceRole === 'owner' || workspaceRole === 'admin';

    if (!canManageAll) {
        where.userId = userId;
    }

    const projects = await prisma.project.findMany({
        where,
        orderBy: [{ isInbox: 'desc' }, { name: 'asc' }],
        select: { id: true, name: true, color: true, userId: true, isInbox: true }
    });

    return projects;
}

module.exports = {
    WORKSPACE_ROLES,
    ASSIGNABLE_WORKSPACE_ROLES,
    serializeUser,
    isAdmin,
    isWorkspaceOwner,
    isWorkspaceManager,
    getWorkspaceRole,
    setWorkspaceMemberRole,
    isInvitedWorkspaceMember,
    findUserById,
    normalizeEmail,
    isSignupAllowed,
    resolveRoleForNewUser,
    normalizeInvitedMemberRole,
    promoteAdminIfConfigured,
    acceptInviteForEmail,
    getManageableProjects,
    updateOwnProfile
};
