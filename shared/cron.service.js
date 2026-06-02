const cron = require('node-cron');
const { prisma } = require('./prisma.service');
const { sendDailyDigest } = require('./notification.service');

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
                    repeatLabel: todo.repeatType === 'weekly' ? `Repeats every ${todo.repeatOn}` : null
                });
            });

            // Send digest to each user
            for (const [email, todos] of Object.entries(todosByUser)) {
                await sendDailyDigest(email, todos);
            }

            console.log(`[Scheduler] Daily reminders completed - ${Object.keys(todosByUser).length} users notified`);
        } catch (error) {
            console.error('[Scheduler Error]', error.message);
        }
    });
}

module.exports = { startScheduler };