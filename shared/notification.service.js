const nodemailer = require('nodemailer');

// Initialize email transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * Send todo reminder email to user
 * @param {string} email - User's email address
 * @param {string} todoTitle - Title of the todo
 * @param {string} dueDate - When the todo is due
 * @param {boolean} isRecurring - Whether this is a recurring todo
 */
async function sendTodoReminder(email, todoTitle, dueDate, isRecurring = false) {
    try {
        // Skip sending if SMTP credentials not configured
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.log(`[Notification] Would send to ${email}: "${todoTitle}" due ${dueDate}`);
            return;
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

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: email,
            subject: subject,
            html: html
        });

        console.log(`[Notification] Email sent to ${email} for todo: "${todoTitle}"`);
    } catch (error) {
        console.error('[Notification Error]', error.message);
    }
}

/**
 * Send digest email with all due todos for the day
 * @param {string} email - User's email address
 * @param {Array} todos - Array of todos due today
 */
async function sendDailyDigest(email, todos) {
    try {
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.log(`[Notification] Would send digest to ${email}: ${todos.length} todos due`);
            return;
        }

        if (todos.length === 0) return;

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

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: email,
            subject: `Daily Reminder: ${todos.length} todo(s) due today`,
            html: html
        });

        console.log(`[Notification] Daily digest sent to ${email}`);
    } catch (error) {
        console.error('[Notification Error]', error.message);
    }
}

module.exports = { sendTodoReminder, sendDailyDigest };