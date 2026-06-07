const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.FREE_MEMBER_LIMIT = process.env.FREE_MEMBER_LIMIT || '20';

const runId = Date.now();
const adminEmail = `portfolio-test-${runId}@example.com`;
process.env.ADMIN_EMAILS = adminEmail;

const app = require('../app');

const jsonHeaders = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
};

function authHeader(token) {
    return { ...jsonHeaders, Authorization: `Bearer ${token}` };
}

let token;
let userId;

before(async () => {
    const email = adminEmail;
    const signup = await request(app)
        .post('/signup')
        .set(jsonHeaders)
        .send({ email, password: 'test-password-123' });

    assert.equal(signup.status, 201);
    assert.equal(signup.body.success, true);
    assert.equal(signup.body.user.role, 'admin');
    token = signup.body.token;
    userId = signup.body.user.id;

    const onboarding = await request(app)
        .post('/onboarding')
        .set(authHeader(token))
        .send({
            workspaceName: `Workspace ${runId}`,
            teamType: 'startup',
            teamSize: '2-5',
            primaryUse: 'both'
        });

    assert.equal(onboarding.status, 201);
    assert.equal(onboarding.body.workspace.name, `Workspace ${runId}`);
});

test('GET /dashboard returns stats and activity feed', async () => {
    const res = await request(app)
        .get('/dashboard')
        .set(authHeader(token));

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.stats);
    assert.ok(Array.isArray(res.body.projects));
    assert.ok(res.body.recentActivity);
    assert.ok(Array.isArray(res.body.recentActivity.items));
    assert.equal(typeof res.body.recentActivity.page, 'number');
    assert.equal(typeof res.body.recentActivity.total, 'number');
});

test('GET /dashboard activity pagination', async () => {
    const res = await request(app)
        .get('/dashboard?activityPage=1&activityLimit=2')
        .set(authHeader(token));

    assert.equal(res.status, 200);
    assert.equal(res.body.recentActivity.limit, 2);
    assert.equal(res.body.recentActivity.page, 1);
    assert.ok(res.body.recentActivity.items.length <= 2);
});

test('GET /dashboard excludes personal todos from stats and recent tasks', async () => {
    const personalTitle = `Private dashboard note ${runId}`;
    await request(app)
        .post('/todos')
        .set(authHeader(token))
        .send({ kind: 'personal', title: personalTitle });

    const res = await request(app)
        .get('/dashboard')
        .set(authHeader(token));

    assert.equal(res.status, 200);
    assert.ok(
        !res.body.recentTodos.some((todo) => todo.title === personalTitle),
        'personal todos should not appear in recent tasks'
    );
});

test('POST /todos creates a personal todo', async () => {
    const create = await request(app)
        .post('/todos')
        .set(authHeader(token))
        .send({ kind: 'personal', title: `Journal entry ${runId}` });

    assert.equal(create.status, 201);
    assert.equal(create.body.todo.kind, 'personal');
    assert.equal(create.body.todo.title, `Journal entry ${runId}`);
    assert.equal(create.body.todo.projectId, null);
});

test('POST /todos creates a task and logs activity', async () => {
    const create = await request(app)
        .post('/todos')
        .set(authHeader(token))
        .send({ kind: 'task', title: `Ship portfolio ${runId}`, priority: 'high', status: 'todo' });

    assert.equal(create.status, 201);
    assert.equal(create.body.todo.title, `Ship portfolio ${runId}`);
    assert.equal(create.body.todo.priority, 'high');

    const dashboard = await request(app)
        .get('/dashboard')
        .set(authHeader(token));

    assert.ok(
        dashboard.body.recentActivity.items.some((item) => item.action === 'task.created')
    );
});

test('task comments and status updates', async () => {
    const list = await request(app)
        .get('/todos?kind=task')
        .set(authHeader(token));

    const todo = list.body.todos.find((t) => t.title === `Ship portfolio ${runId}`);
    assert.ok(todo);

    const comment = await request(app)
        .post(`/todos/${todo.id}/comments`)
        .set(authHeader(token))
        .send({ body: 'Looks good for the portfolio.' });

    assert.equal(comment.status, 201);
    assert.equal(comment.body.comment.body, 'Looks good for the portfolio.');

    const comments = await request(app)
        .get(`/todos/${todo.id}/comments`)
        .set(authHeader(token));

    assert.equal(comments.status, 200);
    assert.equal(comments.body.comments.length, 1);

    const status = await request(app)
        .patch(`/todos/${todo.id}/status`)
        .set(authHeader(token))
        .send({ status: 'in_progress' });

    assert.equal(status.status, 200);
    assert.equal(status.body.todo.status, 'in_progress');
});

test('GET /projects returns inbox project', async () => {
    const res = await request(app)
        .get('/projects')
        .set(authHeader(token));

    assert.equal(res.status, 200);
    assert.ok(res.body.projects.some((p) => p.isInbox));
});

test('POST /projects creates a project', async () => {
    const res = await request(app)
        .post('/projects')
        .set(authHeader(token))
        .send({ name: `Portfolio project ${runId}`, color: '#4f46e5' });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.project.name, `Portfolio project ${runId}`);
});

test('project owner can delete project and move tasks to inbox', async () => {
    const create = await request(app)
        .post('/projects')
        .set(authHeader(token))
        .send({ name: `Delete me ${runId}`, color: '#111111' });

    assert.equal(create.status, 201);
    const projectId = create.body.project.id;

    const task = await request(app)
        .post('/todos')
        .set(authHeader(token))
        .send({ kind: 'task', title: `Task in deleted project ${runId}`, projectId });

    assert.equal(task.status, 201);
    assert.equal(task.body.todo.projectId, projectId);

    const del = await request(app)
        .delete(`/projects/${projectId}`)
        .set(authHeader(token));

    assert.equal(del.status, 200);
    assert.equal(del.body.message, 'Project deleted');

    const projects = await request(app)
        .get('/projects')
        .set(authHeader(token));

    assert.ok(!projects.body.projects.some((project) => project.id === projectId));

    const list = await request(app)
        .get('/todos?kind=task')
        .set(authHeader(token));

    const moved = list.body.todos.find((todo) => todo.id === task.body.todo.id);
    assert.ok(moved);
    assert.notEqual(moved.projectId, projectId);
});

test('unauthenticated requests are rejected', async () => {
    const res = await request(app)
        .get('/todos')
        .set(jsonHeaders);

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
});

test('GET /users returns team directory with admin role for first user', async () => {
    const res = await request(app)
        .get('/users')
        .set(authHeader(token));

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.currentUser.role, 'admin');
    assert.ok(Array.isArray(res.body.users));
    assert.ok(Array.isArray(res.body.manageableProjects));
});

test('workspace admin can invite and add member to project', async () => {
    const inviteEmail = `invited-${runId}@example.com`;
    const teamEmail = `ada-${runId}@team.example.com`;

    const invite = await request(app)
        .post('/users/invite')
        .set(authHeader(token))
        .send({ email: inviteEmail });

    assert.equal(invite.status, 201);
    assert.equal(invite.body.invite.email, inviteEmail);
    assert.ok(invite.body.invite.token);
    assert.ok(invite.body.invite.inviteUrl);

    const memberSignup = await request(app)
        .post('/signup')
        .set(jsonHeaders)
        .send({
            inviteToken: invite.body.invite.token,
            name: 'Invited Member',
            password: 'test-password-123'
        });

    assert.equal(memberSignup.status, 201);
    assert.equal(memberSignup.body.user.role, 'member');
    const memberId = memberSignup.body.user.id;

    const teamBefore = await request(app)
        .get('/users')
        .set(authHeader(token));

    const memberBefore = teamBefore.body.users.find((u) => u.id === memberId);
    assert.ok(memberBefore);
    assert.equal(memberBefore.teamEmail, null);
    assert.equal(memberBefore.displayEmail, inviteEmail);

    const assignTeamEmail = await request(app)
        .patch(`/users/${memberId}/team-email`)
        .set(authHeader(token))
        .send({ teamEmail });

    assert.equal(assignTeamEmail.status, 200);
    assert.equal(assignTeamEmail.body.user.teamEmail, teamEmail);
    assert.equal(assignTeamEmail.body.user.displayEmail, teamEmail);

    const team = await request(app)
        .get('/users')
        .set(authHeader(token));

    const member = team.body.users.find((u) => u.id === memberId);
    assert.ok(member);
    assert.equal(member.teamEmail, teamEmail);
    assert.equal(member.displayEmail, teamEmail);
    assert.equal(member.email, inviteEmail);

    const projects = await request(app)
        .get('/projects')
        .set(authHeader(token));

    const project = projects.body.projects.find((p) => p.name === `Portfolio project ${runId}`);
    assert.ok(project);

    const addMember = await request(app)
        .post(`/users/${memberId}/projects`)
        .set(authHeader(token))
        .send({ projectIds: [project.id] });

    assert.ok(
        addMember.status === 201 || addMember.status === 200,
        `expected 201 or 200, got ${addMember.status}`
    );
    assert.ok(
        addMember.body.added.length === 1 ||
            addMember.body.skipped.some(function (row) {
                return row.projectId === project.id && row.reason === 'already_member';
            })
    );

    const members = await request(app)
        .get(`/projects/${project.id}/members`)
        .set(authHeader(token));

    assert.ok(members.body.members.some((member) => member.id === memberId));
});

test('signup without invite is rejected once workspace has an admin', async () => {
    const res = await request(app)
        .post('/signup')
        .set(jsonHeaders)
        .send({ email: `uninvited-${runId}@example.com`, password: 'test-password-123' });

    assert.equal(res.status, 403);
    assert.match(res.body.message, /invite only/i);
});

test('workspace owner can create groups and add invitees before they join', async () => {
    const inviteEmail = `group-invite-${runId}@example.com`;

    const invite = await request(app)
        .post('/users/invite')
        .set(authHeader(token))
        .send({ email: inviteEmail });

    assert.equal(invite.status, 201);
    const inviteId = invite.body.invite.id;

    const createGroup = await request(app)
        .post('/groups')
        .set(authHeader(token))
        .send({ name: `Engineering ${runId}`, color: '#4f46e5' });

    assert.equal(createGroup.status, 201);
    assert.equal(createGroup.body.group.name, `Engineering ${runId}`);

    const addInvite = await request(app)
        .post(`/groups/${createGroup.body.group.id}/members`)
        .set(authHeader(token))
        .send({ inviteIds: [inviteId] });

    assert.equal(addInvite.status, 201);
    assert.equal(addInvite.body.group.members.length, 2);
    assert.ok(addInvite.body.group.members.some(function (entry) {
        return entry.kind === 'member' && entry.userId === userId && entry.isOwner;
    }));
    assert.ok(addInvite.body.group.members.some(function (entry) {
        return entry.kind === 'invite' && entry.email === inviteEmail;
    }));

    const memberSignup = await request(app)
        .post('/signup')
        .set(jsonHeaders)
        .send({
            inviteToken: invite.body.invite.token,
            name: 'Group Member',
            password: 'test-password-123'
        });

    assert.equal(memberSignup.status, 201);
    const memberId = memberSignup.body.user.id;

    const groups = await request(app)
        .get('/groups')
        .set(authHeader(token));

    const group = groups.body.groups.find((g) => g.id === createGroup.body.group.id);
    assert.ok(group);
    assert.equal(group.members.length, 2);
    assert.ok(group.members.some(function (entry) {
        return entry.kind === 'member' && entry.userId === memberId;
    }));
    assert.ok(group.members.some(function (entry) {
        return entry.kind === 'member' && entry.userId === userId && entry.isOwner;
    }));
});

test('group members can chat and mention each other with @alias', async () => {
    const inviteEmail = `chat-member-${runId}@example.com`;

    const invite = await request(app)
        .post('/users/invite')
        .set(authHeader(token))
        .send({ email: inviteEmail });

    assert.equal(invite.status, 201);

    const createGroup = await request(app)
        .post('/groups')
        .set(authHeader(token))
        .send({ name: `Chat Group ${runId}`, color: '#6366f1' });

    assert.equal(createGroup.status, 201);
    const groupId = createGroup.body.group.id;
    assert.ok(createGroup.body.group.members.some(function (entry) {
        return entry.kind === 'member' && entry.userId === userId && entry.isOwner;
    }));

    const memberSignup = await request(app)
        .post('/signup')
        .set(jsonHeaders)
        .send({
            inviteToken: invite.body.invite.token,
            name: 'Chat Member',
            password: 'test-password-123'
        });

    assert.equal(memberSignup.status, 201);
    const memberToken = memberSignup.body.token;

    await request(app)
        .patch('/users/me/profile')
        .set(authHeader(token))
        .send({ name: 'Workspace Owner' });

    await request(app)
        .post(`/groups/${groupId}/members`)
        .set(authHeader(token))
        .send({ userIds: [memberSignup.body.user.id] });

    const mentionOwner = await request(app)
        .post(`/groups/${groupId}/messages`)
        .set(authHeader(memberToken))
        .send({ body: 'Hey @Workspace Owner, please review this update.' });

    assert.equal(mentionOwner.status, 201);
    assert.equal(mentionOwner.body.chatMessage.mentions.length, 1);
    assert.equal(mentionOwner.body.chatMessage.mentions[0].userId, userId);

    const ownerMessage = await request(app)
        .post(`/groups/${groupId}/messages`)
        .set(authHeader(token))
        .send({ body: 'Welcome @Chat Member — please review the sprint board.' });

    assert.equal(ownerMessage.status, 201);
    assert.equal(ownerMessage.body.chatMessage.mentions.length, 1);
    assert.equal(ownerMessage.body.chatMessage.mentions[0].alias, 'Chat Member');

    const memberMessage = await request(app)
        .post(`/groups/${groupId}/messages`)
        .set(authHeader(memberToken))
        .send({ body: 'Thanks! I am on it.' });

    assert.equal(memberMessage.status, 201);

    const messages = await request(app)
        .get(`/groups/${groupId}/messages`)
        .set(authHeader(memberToken));

    assert.equal(messages.status, 200);

    const userMessages = messages.body.messages.filter(function (row) {
        return !row.isSystem;
    });
    const systemMessages = messages.body.messages.filter(function (row) {
        return row.isSystem;
    });

    assert.equal(userMessages.length, 3);
    assert.ok(systemMessages.length >= 1);
    assert.ok(
        systemMessages.some(function (row) {
            return /added to #|joined #|welcome/i.test(row.body);
        })
    );
    assert.ok(messages.body.roster.some(function (entry) {
        return entry.userId === userId;
    }));
    assert.ok(messages.body.roster.some((entry) => entry.displayLabel === 'Chat Member'));
});

test('group chat supports Cliq-style @all and @available mentions', async () => {
    const inviteEmail = `broadcast-member-${runId}@example.com`;

    const invite = await request(app)
        .post('/users/invite')
        .set(authHeader(token))
        .send({ email: inviteEmail });

    assert.equal(invite.status, 201);

    const createGroup = await request(app)
        .post('/groups')
        .set(authHeader(token))
        .send({ name: `Broadcast Group ${runId}`, color: '#14b8a6' });

    assert.equal(createGroup.status, 201);
    const groupId = createGroup.body.group.id;

    const memberSignup = await request(app)
        .post('/signup')
        .set(jsonHeaders)
        .send({
            inviteToken: invite.body.invite.token,
            name: 'Broadcast Member',
            password: 'test-password-123'
        });

    assert.equal(memberSignup.status, 201);
    const memberToken = memberSignup.body.token;
    const memberId = memberSignup.body.user.id;

    await request(app)
        .post(`/groups/${groupId}/members`)
        .set(authHeader(token))
        .send({ userIds: [memberId] });

    await request(app)
        .patch('/users/me/profile')
        .set(authHeader(token))
        .send({ availability: 'meeting' });

    await request(app)
        .patch('/users/me/profile')
        .set(authHeader(memberToken))
        .send({ availability: 'available' });

    const rosterRes = await request(app)
        .get(`/groups/${groupId}/messages`)
        .set(authHeader(token));

    assert.equal(rosterRes.status, 200);
    assert.ok(rosterRes.body.roster.some(function (entry) {
        return entry.kind === 'broadcast' && entry.scope === 'all';
    }));

    const allMessage = await request(app)
        .post(`/groups/${groupId}/messages`)
        .set(authHeader(memberToken))
        .send({ body: '@all standup in five minutes' });

    assert.equal(allMessage.status, 201);
    assert.equal(allMessage.body.chatMessage.mentions.length, 1);
    assert.equal(allMessage.body.chatMessage.mentions[0].kind, 'broadcast');
    assert.equal(allMessage.body.chatMessage.mentions[0].scope, 'all');
    assert.ok(allMessage.body.chatMessage.mentions[0].notifiedUserIds.includes(userId));

    const availableMessage = await request(app)
        .post(`/groups/${groupId}/messages`)
        .set(authHeader(token))
        .send({ body: '@available please confirm your tasks' });

    assert.equal(availableMessage.status, 201);
    assert.equal(availableMessage.body.chatMessage.mentions.length, 1);
    assert.equal(availableMessage.body.chatMessage.mentions[0].scope, 'available');
    assert.deepEqual(availableMessage.body.chatMessage.mentions[0].notifiedUserIds, [memberId]);
});

test('workspace members can send private direct messages', async () => {
    const inviteEmail = `dm-member-${runId}@example.com`;

    const invite = await request(app)
        .post('/users/invite')
        .set(authHeader(token))
        .send({ email: inviteEmail });

    assert.equal(invite.status, 201);

    const memberSignup = await request(app)
        .post('/signup')
        .set(jsonHeaders)
        .send({
            inviteToken: invite.body.invite.token,
            name: 'DM Member',
            password: 'test-password-123'
        });

    assert.equal(memberSignup.status, 201);
    const memberToken = memberSignup.body.token;
    const memberId = memberSignup.body.user.id;

    const openChat = await request(app)
        .post('/messages')
        .set(authHeader(token))
        .send({ recipientId: memberId });

    assert.equal(openChat.status, 201);
    const conversationId = openChat.body.conversation.id;
    assert.equal(openChat.body.conversation.otherUser.id, memberId);

    const ownerMessage = await request(app)
        .post(`/messages/${conversationId}/messages`)
        .set(authHeader(token))
        .send({ body: 'Hey, can we sync privately?' });

    assert.equal(ownerMessage.status, 201);
    assert.equal(ownerMessage.body.chatMessage.body, 'Hey, can we sync privately?');

    const memberReply = await request(app)
        .post(`/messages/${conversationId}/messages`)
        .set(authHeader(memberToken))
        .send({ body: 'Sure, I am available now.' });

    assert.equal(memberReply.status, 201);

    const thread = await request(app)
        .get(`/messages/${conversationId}/messages`)
        .set(authHeader(memberToken));

    assert.equal(thread.status, 200);
    assert.equal(thread.body.messages.length, 2);
    assert.equal(thread.body.conversation.otherUser.id, userId);

    const inbox = await request(app)
        .get('/messages')
        .set(authHeader(memberToken));

    assert.equal(inbox.status, 200);
    assert.ok(inbox.body.conversations.some(function (row) {
        return row.id === conversationId && row.otherUser.id === userId;
    }));
});

test('workspace owner can assign admin and member roles', async () => {
    const inviteEmail = `role-member-${runId}@example.com`;

    const invite = await request(app)
        .post('/users/invite')
        .set(authHeader(token))
        .send({ email: inviteEmail });

    assert.equal(invite.status, 201);

    const memberSignup = await request(app)
        .post('/signup')
        .set(jsonHeaders)
        .send({
            inviteToken: invite.body.invite.token,
            name: 'Role Member',
            password: 'test-password-123'
        });

    assert.equal(memberSignup.status, 201);
    const memberId = memberSignup.body.user.id;

    const promote = await request(app)
        .patch(`/users/${memberId}/workspace-role`)
        .set(authHeader(token))
        .send({ role: 'admin' });

    assert.equal(promote.status, 200);
    assert.equal(promote.body.user.workspaceRole, 'admin');

    const memberSession = await request(app)
        .get('/users')
        .set(authHeader(memberSignup.body.token));

    assert.equal(memberSession.status, 200);
    assert.equal(memberSession.body.currentUser.workspaceRole, 'admin');
    assert.equal(memberSession.body.canManageWorkspace, true);

    const demote = await request(app)
        .patch(`/users/${memberId}/workspace-role`)
        .set(authHeader(token))
        .send({ role: 'member' });

    assert.equal(demote.status, 200);
    assert.equal(demote.body.user.workspaceRole, 'member');
});

test('workspace owner can update own profile', async () => {
    const teamEmail = `owner-work-${runId}@team.example.com`;
    const avatarUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    const update = await request(app)
        .patch('/users/me/profile')
        .set(authHeader(token))
        .send({
            name: 'Workspace Owner',
            teamEmail,
            avatarUrl,
            statusMessage: 'In a meeting',
            availability: 'meeting',
            phone: '+1 555 0100',
            extension: '204',
            department: 'Product',
            designation: 'Founder',
            location: 'Lagos',
            timezone: 'Africa/Lagos',
            bio: 'Building the workspace.',
            language: 'en'
        });

    assert.equal(update.status, 200);
    assert.equal(update.body.user.name, 'Workspace Owner');
    assert.equal(update.body.user.teamEmail, teamEmail);
    assert.equal(update.body.user.displayEmail, teamEmail);
    assert.equal(update.body.user.avatarUrl, avatarUrl);
    assert.equal(update.body.user.statusMessage, 'In a meeting');
    assert.equal(update.body.user.availability, 'meeting');
    assert.equal(update.body.user.phone, '+1 555 0100');
    assert.equal(update.body.user.designation, 'Founder');
    assert.equal(update.body.user.bio, 'Building the workspace.');

    const team = await request(app)
        .get('/users')
        .set(authHeader(token));

    assert.equal(team.body.currentUser.name, 'Workspace Owner');
    assert.equal(team.body.currentUser.teamEmail, teamEmail);
    assert.equal(team.body.currentUser.displayEmail, teamEmail);
    assert.equal(team.body.currentUser.avatarUrl, avatarUrl);

    const ownerInList = team.body.users.find(function (row) {
        return row.id === team.body.currentUser.id;
    });
    assert.ok(ownerInList);
    assert.equal(ownerInList.displayEmail, teamEmail);
    assert.equal(ownerInList.avatarUrl, avatarUrl);
});
