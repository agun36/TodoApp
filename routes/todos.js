var express = require('express');
var router = express.Router();
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// GET todos page
router.get('/', async function (req, res) {
    let todos = await prisma.todo.findMany();

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

    res.render('todos', {
        title: 'Todo List',
        todos,
        filter: req.query.filter || 'all',
        sort: req.query.sort || 'newest',
        query: req.query.q || '',
        editing: req.query.edit || null
    });
});

// create a new todo
router.post('/', async function (req, res) {
    const { title, dueDate } = req.body;
    if (title && title.trim()) {
        await prisma.todo.create({
            data: {
                title: title.trim(),
                dueDate: dueDate ? new Date(dueDate) : undefined
            }
        });
    }
    res.redirect('/todos');
});

// edit a todo
router.post('/edit', async function (req, res) {
    const { id, title, dueDate } = req.body;
    if (title && title.trim()) {
        await prisma.todo.update({
            where: { id: parseInt(id) },
            data: {
                title: title.trim(),
                dueDate: dueDate ? new Date(dueDate) : null
            }
        });
    }
    res.redirect('/todos');
});

// delete a todo
router.post('/delete', async function (req, res) {
    const { id } = req.body;
    await prisma.todo.delete({ where: { id: parseInt(id) } });
    res.redirect('/todos');
});

// toggle a todo's completion status
router.post('/toggle', async function (req, res) {
    const { id } = req.body;
    const todo = await prisma.todo.findUnique({ where: { id: parseInt(id) } });
    if (todo) {
        await prisma.todo.update({
            where: { id: parseInt(id) },
            data: { done: !todo.done }
        });
    }
    res.redirect('/todos');
});

// clear completed todos
router.post('/clear', async function (req, res) {
    await prisma.todo.deleteMany({ where: { done: true } });
    res.redirect('/todos');
});

module.exports = router;