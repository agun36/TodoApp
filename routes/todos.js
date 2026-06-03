const express = require('express');
const router = express.Router();
require('dotenv').config();
const { prisma } = require('../shared/prisma.service.js');
const { wantsJson, jsonOk, jsonError } = require('../shared/api-response.js');
const { requireAuth } = require('../shared/require-auth.js');

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getNextWeeklyDate(dayName) {
    const targetDay = weekdays.indexOf(dayName);
    if (targetDay === -1) return null;
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const diff = (targetDay - date.getDay() + 7) % 7 || 7;
    date.setDate(date.getDate() + diff);
    return date;
}

function calculateNextDueDate(todo) {
    if (todo.repeatType === 'weekly' && todo.repeatOn) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const due = todo.dueDate ? new Date(todo.dueDate) : null;
        if (due && due >= now) return due;
        return getNextWeeklyDate(todo.repeatOn);
    }
    return todo.dueDate ? new Date(todo.dueDate) : null;
}

function getUpcomingDates(todo, count = 4) {
    if (todo.repeatType === 'weekly' && todo.repeatOn) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const startingDate = todo.dueDate ? new Date(todo.dueDate) : now;
        const firstDate = startingDate >= now ? startingDate : getNextWeeklyDate(todo.repeatOn);
        const dates = [];
        const current = new Date(firstDate);
        current.setHours(0, 0, 0, 0);
        const targetDay = weekdays.indexOf(todo.repeatOn);
        if (targetDay === -1) return dates;
        const diff = (targetDay - current.getDay() + 7) % 7;
        if (diff !== 0) {
            current.setDate(current.getDate() + diff);
        }
        for (let i = 0; i < count; i += 1) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 7);
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
        return `Repeats every ${todo.repeatOn}`;
    }
    return null;
}

function parseTodoId(value) {
    const todoId = parseInt(value, 10);
    return Number.isNaN(todoId) ? null : todoId;
}

async function updateTodoHandler(req, res, todoId) {
    const { title, dueDate, repeatType, repeatOn } = req.body;

    if (!todoId) {
        if (wantsJson(req)) {
            return jsonError(res, 'Invalid todo id', 400);
        }
        return res.redirect('/todos');
    }
    if (!title || !title.trim()) {
        if (wantsJson(req)) {
            return jsonError(res, 'title is required', 400);
        }
        return res.redirect('/todos');
    }

    const existing = await prisma.todo.findFirst({
        where: { id: todoId, userId: req.auth.userId }
    });
    if (!existing) {
        if (wantsJson(req)) {
            return jsonError(res, 'Todo not found', 404);
        }
        return res.redirect('/todos');
    }

    const selectedRepeatType = repeatType === 'weekly' && repeatOn ? 'weekly' : 'none';
    const dueDateValue = dueDate
        ? new Date(dueDate)
        : (selectedRepeatType === 'weekly' ? getNextWeeklyDate(repeatOn) : null);

    const todo = await prisma.todo.update({
        where: { id: todoId },
        data: {
            title: title.trim(),
            dueDate: dueDateValue,
            repeatType: selectedRepeatType,
            repeatOn: selectedRepeatType === 'weekly' ? repeatOn : null
        }
    });

    if (wantsJson(req)) {
        return jsonOk(res, { message: 'Todo updated', todo });
    }
    return res.redirect('/todos');
}

// GET todos page
router.get('/', requireAuth, async function (req, res) {
    let todos = await prisma.todo.findMany({
        where: { userId: req.auth.userId }
    });

    todos = todos.map((todo) => {
        const upcomingDates = getUpcomingDates(todo, 4);
        return {
            ...todo,
            upcomingDates,
            dueLabel: upcomingDates.length
                ? upcomingDates[0].toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
                : null,
            upcomingLabels: upcomingDates.slice(1).map((d) => d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })),
            repeatLabel: buildRepeatLabel(todo)
        };
    });

    // Search
    if (req.query && typeof req.query.q === 'string' && req.query.q.trim()) {
        const search = req.query.q.trim().toLowerCase();
        todos = todos.filter(t => t.title.toLowerCase().includes(search));
    }

    // Filter
    if (req.query.filter === 'active') {
        todos = todos.filter(t => !t.done);
    } else if (req.query.filter === 'completed') {
        todos = todos.filter(t => t.done);
    }

    // Sort
    if (req.query.sort === 'oldest') {
        todos.sort((a, b) => a.id - b.id);
    } else if (req.query.sort === 'az') {
        todos.sort((a, b) => a.title.localeCompare(b.title));
    } else {
        todos.sort((a, b) => b.id - a.id); // newest default
    }

    if (wantsJson(req)) {
        return jsonOk(res, {
            email: req.auth.email,
            todos: todos.map((t) => ({
                id: t.id,
                title: t.title,
                done: t.done,
                dueDate: t.dueDate,
                repeatType: t.repeatType,
                repeatOn: t.repeatOn,
                dueLabel: t.dueLabel,
                repeatLabel: t.repeatLabel
            })),
            filter: req.query.filter || 'all',
            sort: req.query.sort || 'newest',
            query: req.query.q || ''
        });
    }

    res.render('todos', {
        title: 'Todo List',
        todos,
        filter: req.query.filter || 'all',
        sort: req.query.sort || 'newest',
        query: req.query.q || '',
        editing: req.query.edit || null,
        email: req.auth.email
    });
});

// create a new todo
router.post('/', requireAuth, async function (req, res) {
    const { title, dueDate, repeatType, repeatOn } = req.body;
    if (!title || !title.trim()) {
        if (wantsJson(req)) {
            return jsonError(res, 'title is required', 400);
        }
        return res.redirect('/todos');
    }

    const selectedRepeatType = repeatType === 'weekly' && repeatOn ? 'weekly' : 'none';
    const dueDateValue = dueDate
        ? new Date(dueDate)
        : (selectedRepeatType === 'weekly' ? getNextWeeklyDate(repeatOn) : undefined);

    const todo = await prisma.todo.create({
        data: {
            title: title.trim(),
            dueDate: dueDateValue,
            repeatType: selectedRepeatType,
            repeatOn: selectedRepeatType === 'weekly' ? repeatOn : null,
            userId: req.auth.userId
        }
    });

    if (wantsJson(req)) {
        return jsonOk(res, { message: 'Todo created', todo }, 201);
    }
    res.redirect('/todos');
});

// edit a todo (HTML form — id in body)
router.post('/edit', requireAuth, async function (req, res) {
    return updateTodoHandler(req, res, parseTodoId(req.body.id));
});

// edit a todo (API — id in URL: PUT/PATCH /todos/edit/:id)
async function editTodoByParam(req, res) {
    return updateTodoHandler(req, res, parseTodoId(req.params.id));
}

router.put('/edit/:id', requireAuth, editTodoByParam);
router.patch('/edit/:id', requireAuth, editTodoByParam);

// delete a todo
router.post('/delete', requireAuth, async function (req, res) {
    const { id } = req.body;
    await prisma.todo.delete({ where: { id: parseInt(id) } });
    res.redirect('/todos');
});

// toggle a todo's completion status
router.post('/toggle', requireAuth, async function (req, res) {
    const { id } = req.body;
    const todo = await prisma.todo.findUnique({ where: { id: parseInt(id) } });
    if (todo) {
        if (!todo.done) {
            // If marking as done, delete it
            await prisma.todo.delete({ where: { id: parseInt(id) } });
        } else {
        // If unmarking as done, just set done to false
            await prisma.todo.update({
                where: { id: parseInt(id) },
                data: { done: false }
            });
        }
    }
    res.redirect('/todos');
});

// clear completed todos
router.post('/clear', requireAuth, async function (req, res) {
    await prisma.todo.deleteMany({
        where: {
            done: true,
            userId: req.auth.userId
        }
    });
    res.redirect('/todos');
});

module.exports = router;