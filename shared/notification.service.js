const nodemailer = require('nodemailer');
const dns = require('dns');

function smtpConfigured() {
    return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function smtpPass() {
    return String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
}

let transporterPromise = null;

async function getSmtpTransporter() {
    if (!transporterPromise) {
        transporterPromise = (async function () {
            const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
            const port = Number(process.env.SMTP_PORT) || 465;
            const secure = port === 465;
            const { address } = await dns.promises.lookup(smtpHost, { family: 4 });
            return nodemailer.createTransport({
                host: address,
                port,
                secure,
                connectionTimeout: 10_000,
                greetingTimeout: 10_000,
                socketTimeout: 15_000,
                tls: { servername: smtpHost },
                auth: {
                    user: process.env.SMTP_USER,
                    pass: smtpPass()
                }
            });
        })().catch(function (err) {
            transporterPromise = null;
            throw err;
        });
    }
    return transporterPromise;
}

/**
 * Send todo reminder email to user
 * @param {string} email - User's email address
 * @param {string} todoTitle - Title of the todo
 * @param {string} dueDate - When the todo is due
 * @param {boolean} isRecurring - Whether this is a recurring todo
 */
async function sendTodoReminder(email, todoTitle, dueDate, isRecurring = false) {
    try {
        if (!smtpConfigured()) {
            console.log(`[Notification] Would send to ${email}: "${todoTitle}" due ${dueDate}`);
            return { sent: false, skipped: true };
        }

        const dueDateFormatted = new Date(dueDate).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });

        const subject = `Reminder: ${todoTitle}`;
        const recurringText = isRecurring ? ' (Recurring)' : '';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2>📋 Todo Reminder${recurringText}</h2>
                <p>Your todo <strong>"${todoTitle}"</strong> is due on <strong>${dueDateFormatted}</strong>.</p>
                <p>
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}/todos" 
                       style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        View Your Todos
                    </a>
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="color: #666; font-size: 12px;">This is an automated reminder from your TodoApp</p>
            </div>
        `;

        await (await getSmtpTransporter()).sendMail({
            from: process.env.SMTP_USER,
            to: email,
            subject: subject,
            html: html
        });

        console.log(`[Notification] Email sent to ${email} for todo: "${todoTitle}"`);
        return { sent: true };
    } catch (error) {
        console.error('[Notification Error]', error.message);
        return { sent: false, error: error.message };
    }
}

/**
 * Send digest email with all due todos for the day
 * @param {string} email - User's email address
 * @param {Array} todos - Array of todos due today
 */
async function sendDailyDigest(email, todos) {
    try {
        if (!smtpConfigured()) {
            console.log(`[Notification] Would send digest to ${email}: ${todos.length} todos due`);
            return { sent: false, skipped: true };
        }

        if (todos.length === 0) return { sent: false, skipped: true };

        const todosList = todos
            .map(t => `<li><strong>${t.title}</strong>${t.repeatLabel ? ` - ${t.repeatLabel}` : ''}</li>`)
            .join('');

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2>📅 Today's Todo Reminder</h2>
                <p>You have <strong>${todos.length}</strong> todo(s) due today:</p>
                <ul style="padding-left: 20px;">
                    ${todosList}
                </ul>
                <p>
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}/todos" 
                       style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        View All Todos
                    </a>
                </p>
            </div>
        `;

        await (await getSmtpTransporter()).sendMail({
            from: process.env.SMTP_USER,
            to: email,
            subject: `Daily Reminder: ${todos.length} todo(s) due today`,
            html: html
        });

        console.log(`[Notification] Daily digest sent to ${email}`);
        return { sent: true };
    } catch (error) {
        console.error('[Notification Error]', error.message);
        return { sent: false, error: error.message };
    }
}

/**
 * Send workspace invite email
 */
async function sendInviteEmail({ to, inviterName, workspaceName, inviteUrl }) {
    try {
        if (!smtpConfigured()) {
            console.log(`[Notification] SMTP not configured — invite link for ${to}: ${inviteUrl}`);
            return { sent: false, skipped: true, reason: 'smtp_not_configured' };
        }

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2>You're invited to TaskFlow</h2>
                <p><strong>${inviterName}</strong> invited you to join <strong>${workspaceName}</strong>.</p>
                <p>
                    <a href="${inviteUrl}"
                       style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Accept invite
                    </a>
                </p>
                <p style="color: #666; font-size: 12px;">This link expires in 7 days.</p>
                <p style="color: #666; font-size: 12px;">Or copy this link: ${inviteUrl}</p>
            </div>
        `;

        await (await getSmtpTransporter()).sendMail({
            from: process.env.SMTP_USER,
            to,
            subject: `${inviterName} invited you to ${workspaceName} on TaskFlow`,
            html
        });

        console.log(`[Notification] Invite email sent to ${to}`);
        return { sent: true };
    } catch (error) {
        console.error('[Notification Error]', error.message);
        return { sent: false, error: error.message };
    }
}

function formatMeetingSchedule(meeting) {
    const days = Array.isArray(meeting.meetingDays) && meeting.meetingDays.length
        ? meeting.meetingDays
        : meeting.meetingDay
            ? [meeting.meetingDay]
            : [];
    const time = meeting.meetingTime ? ` at ${meeting.meetingTime}` : '';

    if (days.length === 0) return `Scheduled meeting${time}`;
    if (days.length === 1) return `Every ${days[0]}${time}`;
    if (days.length === 2) return `Every ${days[0]} and ${days[1]}${time}`;
    return `Every ${days.slice(0, -1).join(', ')}, and ${days[days.length - 1]}${time}`;
}

/**
 * Notify a team member about a scheduled or recurring meeting.
 */
async function sendMeetingNotification({
    to,
    meeting,
    actorEmail,
    kind = 'scheduled',
    todayLabel = null
}) {
    try {
        const schedule = formatMeetingSchedule(meeting);
        const projectName = meeting.project?.name ?? 'your team';
        const appUrl = process.env.APP_URL || 'http://localhost:5173';
        const isReminder = kind === 'reminder';
        const reminderDay = todayLabel || (
            Array.isArray(meeting.meetingDays) ? meeting.meetingDays[0] : meeting.meetingDay
        );

        if (!smtpConfigured()) {
            console.log(
                `[Notification] Would send meeting ${kind} to ${to}: "${meeting.title}" (${schedule})`
            );
            return { sent: false, skipped: true };
        }

        const subject = isReminder
            ? `Reminder: ${meeting.title} today (${projectName})`
            : `Meeting scheduled: ${meeting.title} (${projectName})`;

        const intro = isReminder
            ? `<p>This is your <strong>${reminderDay}</strong> reminder for <strong>${meeting.title}</strong> with <strong>${projectName}</strong>.</p>`
            : `<p><strong>${actorEmail}</strong> scheduled a recurring team meeting for <strong>${projectName}</strong>.</p>`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2>📅 ${isReminder ? 'Meeting reminder' : 'New team meeting'}</h2>
                ${intro}
                <p><strong>${meeting.title}</strong></p>
                <p><strong>When:</strong> ${schedule}</p>
                ${meeting.description ? `<p><strong>Details:</strong> ${meeting.description}</p>` : ''}
                <p>
                    <a href="${appUrl}/meetings"
                       style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        View meetings
                    </a>
                </p>
            </div>
        `;

        await (await getSmtpTransporter()).sendMail({
            from: process.env.SMTP_USER,
            to,
            subject,
            html
        });

        console.log(`[Notification] Meeting ${kind} email sent to ${to}`);
        return { sent: true };
    } catch (error) {
        console.error('[Notification Error]', error.message);
        return { sent: false, error: error.message };
    }
}

module.exports = {
    sendTodoReminder,
    sendDailyDigest,
    sendInviteEmail,
    sendMeetingNotification,
    smtpConfigured
};
