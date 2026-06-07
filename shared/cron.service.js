const cron = require('node-cron');
const { prisma } = require('./prisma.service');
const { sendDailyDigest, sendMeetingNotification } = require('./notification.service');
const { listMeetingsForDay } = require('./meeting.service.js');
const { getProjectMembers } = require('./project.service.js');

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Start background scheduler for sending daily todo reminders
 * Runs at 8 AM every morning
 */
function startScheduler() {
    console.log('[Scheduler] Starting daily reminder scheduler (8 AM daily)');
    
    cron.schedule('0 8 * * *', async () => {
        try {
            console.log('[Scheduler] Running daily reminder check...');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

            // Get all incomplete todos due today
            const dueTodos = await prisma.todo.findMany({
                where: {
                    dueDate: {
                        gte: today,
                        lt: tomorrow
                    },
                    done: false
                },
                include: { user: true }
            });

            console.log(`[Scheduler] Found ${dueTodos.length} todos due today`);

            // Group todos by user
            const todosByUser = {};
            dueTodos.forEach(todo => {
                const email = todo.user.email;
                if (!todosByUser[email]) {
                    todosByUser[email] = [];
                }
                todosByUser[email].push({
                    title: todo.title,
                    dueDate: todo.dueDate,
                    repeatLabel: (() => {
                        if (todo.repeatType !== 'weekly' || !todo.repeatOn) return null;
                        const days = String(todo.repeatOn).split(',').map((d) => d.trim()).filter(Boolean);
                        if (days.length === 1) return `Repeats every ${days[0]}`;
                        if (days.length > 1) return `Repeats every ${days.join(', ')}`;
                        return null;
                    })()
                });
            });

            // Send digest to each user
            for (const [email, todos] of Object.entries(todosByUser)) {
                await sendDailyDigest(email, todos);
            }

            console.log(`[Scheduler] Daily reminders completed - ${Object.keys(todosByUser).length} users notified`);

            const todayName = weekdays[new Date().getDay()];
            const meetingsToday = await listMeetingsForDay(todayName);
            console.log(`[Scheduler] Found ${meetingsToday.length} team meeting(s) for ${todayName}`);

            for (const meeting of meetingsToday) {
                const members = await getProjectMembers(meeting.projectId);
                for (const member of members) {
                    await sendMeetingNotification({
                        to: member.email,
                        meeting,
                        actorEmail: meeting.createdBy?.email || 'TaskFlow',
                        kind: 'reminder',
                        todayLabel: todayName
                    });
                }
            }
        } catch (error) {
            console.error('[Scheduler Error]', error.message);
        }
    });
}

module.exports = { startScheduler };