const { prisma } = require('./prisma.service.js');
const {
    findAccessibleProject,
    getProjectMembers,
    getAccessibleProjectIds,
    isProjectOwner
} = require('./project.service.js');
const { getWorkspaceForUser } = require('./workspace.service.js');
const { isWorkspaceOwner } = require('./user.service.js');
const { sendMeetingNotification } = require('./notification.service.js');

const VALID_DAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
];

function isValidMeetingDay(day) {
    return VALID_DAYS.includes(day);
}

function normalizeMeetingDays(input) {
    let days = [];

    if (Array.isArray(input?.meetingDays)) {
        days = input.meetingDays;
    } else if (input?.meetingDay) {
        days = [input.meetingDay];
    }

    const unique = new Set();
    days.forEach(function (day) {
        const trimmed = String(day || '').trim();
        if (isValidMeetingDay(trimmed)) unique.add(trimmed);
    });

    return VALID_DAYS.filter(function (day) { return unique.has(day); });
}

function formatMeetingDaysLabel(meetingDays, meetingTime) {
    const days = normalizeMeetingDays({ meetingDays });
    if (days.length === 0) return 'No days scheduled';

    const dayLabel = days.length === 1
        ? days[0]
        : days.length === 2
            ? `${days[0]} and ${days[1]}`
            : `${days.slice(0, -1).join(', ')}, and ${days[days.length - 1]}`;

    const time = meetingTime ? ` at ${meetingTime}` : '';
    return `Every ${dayLabel}${time}`;
}

function serializeMeeting(meeting) {
    const meetingDays = normalizeMeetingDays({ meetingDays: meeting.meetingDays });
    return {
        id: meeting.id,
        workspaceId: meeting.workspaceId,
        projectId: meeting.projectId,
        title: meeting.title,
        description: meeting.description,
        meetingDays,
        meetingDay: meetingDays[0] ?? null,
        meetingTime: meeting.meetingTime,
        scheduleLabel: formatMeetingDaysLabel(meetingDays, meeting.meetingTime),
        createdById: meeting.createdById,
        createdByEmail: meeting.createdBy?.email ?? null,
        active: meeting.active,
        createdAt: meeting.createdAt,
        project: meeting.project
            ? {
                id: meeting.project.id,
                name: meeting.project.name,
                color: meeting.project.color
            }
            : null
    };
}

async function canManageProjectMeetings(userId, projectId) {
    if (await isWorkspaceOwner(userId)) return true;
    return isProjectOwner(projectId, userId);
}

async function listMeetingsForUser(userId, workspaceId) {
    const workspace = await getWorkspaceForUser(userId, workspaceId);
    if (!workspace) return { meetings: [], canManage: false };

    const projectIds = await getAccessibleProjectIds(userId, 'active');
    const isOwner = await isWorkspaceOwner(userId);

    const meetings = projectIds.length
        ? await prisma.teamMeeting.findMany({
            where: {
                workspaceId: workspace.id,
                projectId: { in: projectIds },
                active: true
            },
            include: {
                project: { select: { id: true, name: true, color: true } },
                createdBy: { select: { id: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
        })
        : [];

    const serialized = meetings
        .map(serializeMeeting)
        .sort(function (a, b) {
            const aIndex = VALID_DAYS.indexOf(a.meetingDays[0] || '');
            const bIndex = VALID_DAYS.indexOf(b.meetingDays[0] || '');
            return aIndex - bIndex;
        });

    return {
        meetings: serialized,
        canManage: isOwner
    };
}

async function getMeetingRecipientEmails(projectId) {
    const members = await getProjectMembers(projectId);
    const emails = new Set();
    members.forEach(function (member) {
        if (member.email) emails.add(member.email);
    });
    return [...emails];
}

async function notifyMeetingTeam(meeting, actorEmail, options) {
    const emails = await getMeetingRecipientEmails(meeting.projectId);
    const results = [];
    for (const email of emails) {
        const result = await sendMeetingNotification({
            to: email,
            meeting,
            actorEmail,
            kind: options?.kind || 'scheduled',
            todayLabel: options?.todayLabel || null
        });
        results.push({ email, ...result });
    }
    return { emails, results };
}

async function createMeeting({
    userId,
    workspaceId,
    actorEmail,
    projectId,
    title,
    description,
    meetingDays,
    meetingDay,
    meetingTime
}) {
    const workspace = await getWorkspaceForUser(userId, workspaceId);
    if (!workspace) {
        const err = new Error('Workspace not found');
        err.status = 404;
        throw err;
    }

    const project = await findAccessibleProject(projectId, userId);
    if (!project) {
        const err = new Error('Project not found');
        err.status = 404;
        throw err;
    }

    if (!(await canManageProjectMeetings(userId, projectId))) {
        const err = new Error('Only the workspace owner or project owner can schedule meetings');
        err.status = 403;
        throw err;
    }

    const trimmedTitle = String(title || '').trim();
    if (!trimmedTitle) {
        const err = new Error('Meeting title is required');
        err.status = 400;
        throw err;
    }

    const days = normalizeMeetingDays({ meetingDays, meetingDay });
    if (days.length === 0) {
        const err = new Error('Select at least one meeting day');
        err.status = 400;
        throw err;
    }

    const meeting = await prisma.teamMeeting.create({
        data: {
            workspaceId: workspace.id,
            projectId: project.id,
            title: trimmedTitle,
            description: description?.trim() || null,
            meetingDays: days,
            meetingTime: meetingTime?.trim() || null,
            createdById: userId
        },
        include: {
            project: { select: { id: true, name: true, color: true } },
            createdBy: { select: { id: true, email: true } }
        }
    });

    const notifyResult = await notifyMeetingTeam(meeting, actorEmail, { kind: 'scheduled' });

    return {
        meeting: serializeMeeting(meeting),
        notifyResult
    };
}

async function deleteMeeting(meetingId, userId, workspaceId) {
    const meeting = await prisma.teamMeeting.findUnique({
        where: { id: meetingId },
        include: {
            project: { select: { id: true, name: true, color: true } },
            createdBy: { select: { id: true, email: true } }
        }
    });
    if (!meeting || !meeting.active) return null;

    const workspace = await getWorkspaceForUser(userId, workspaceId);
    if (!workspace || meeting.workspaceId !== workspace.id) return null;

    if (
        meeting.createdById !== userId &&
        !(await canManageProjectMeetings(userId, meeting.projectId))
    ) {
        const err = new Error('You cannot delete this meeting');
        err.status = 403;
        throw err;
    }

    await prisma.teamMeeting.update({
        where: { id: meetingId },
        data: { active: false }
    });

    return serializeMeeting(meeting);
}

async function resendMeetingNotification(meetingId, userId, actorEmail, workspaceId) {
    const meeting = await prisma.teamMeeting.findUnique({
        where: { id: meetingId },
        include: {
            project: { select: { id: true, name: true, color: true } },
            createdBy: { select: { id: true, email: true } }
        }
    });
    if (!meeting || !meeting.active) return null;

    const workspace = await getWorkspaceForUser(userId, workspaceId);
    if (!workspace || meeting.workspaceId !== workspace.id) return null;

    if (!(await canManageProjectMeetings(userId, meeting.projectId))) {
        const err = new Error('You cannot notify this team');
        err.status = 403;
        throw err;
    }

    const notifyResult = await notifyMeetingTeam(meeting, actorEmail, { kind: 'reminder' });
    return { meeting: serializeMeeting(meeting), notifyResult };
}

async function listMeetingsForDay(dayName) {
    return prisma.teamMeeting.findMany({
        where: { active: true, meetingDays: { has: dayName } },
        include: {
            project: { select: { id: true, name: true, color: true } },
            createdBy: { select: { id: true, email: true } }
        }
    });
}

module.exports = {
    VALID_DAYS,
    isValidMeetingDay,
    normalizeMeetingDays,
    formatMeetingDaysLabel,
    listMeetingsForUser,
    createMeeting,
    deleteMeeting,
    resendMeetingNotification,
    listMeetingsForDay,
    canManageProjectMeetings,
    serializeMeeting
};
