# TodoApp Frontend

React + Vite + TypeScript frontend with project management.

- **Phase 1** — Projects, tasks, Kanban, priorities, statuses
- **Phase 2** — Dashboard overview, users list, project edit/delete

## Features

- Auth (login, signup, bearer tokens)
- **Projects** — sidebar, create projects, Inbox default
- **Tasks** — CRUD with priority, status, description, due dates, repeat
- **Status workflow** — To do → In progress → Done (no delete on complete)
- **Views** — List and Kanban board (drag & drop between columns)
- **Dashboard stats** — total, active, in progress, done, overdue
- Search, filter, sort (including by priority)

## API endpoints

| Feature | Endpoint |
|---------|----------|
| Projects | `GET/POST /projects`, `PATCH/DELETE /projects/:id` |
| Tasks | `GET/POST /todos`, `PATCH /todos/edit/:id`, `PATCH /todos/:id/status` |
| Dashboard | `GET /dashboard` |
| Users | `GET /users` |
| Auth | `POST /login`, `POST /signup` |

## Getting started

### 1. Start the backend

From the repo root (`TodoApp/`):

```bash
npm install
npm start
```

The API runs at `http://localhost:3000`.

For production or direct API calls, set `CORS_ORIGIN=http://localhost:5173` in the backend `.env`.

### 2. Start the frontend

```bash
cd Frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Routes: `/` (tasks), `/dashboard`, `/users`.

Dev requests are proxied from `/api` → `http://localhost:3000`.

## Features

| Feature | API |
|---------|-----|
| Sign up / log in / log out | `POST /signup`, `POST /login`, `GET /login/logout` |
| List todos (search, filter, sort) | `GET /todos?q=&filter=&sort=` |
| Create todo | `POST /todos` |
| Update todo | `PATCH /todos/edit/:id` |
| Delete / complete todo | `DELETE /todos/delete/:id` |

Todos support optional due dates and weekly repeat schedules.

## Project structure

```
src/
├── api/           # HTTP client, auth & todo API modules
├── components/    # UI components (auth, todos, routing)
├── context/       # Auth provider
├── hooks/         # TanStack Query hooks
├── pages/         # Route pages
└── types/         # Shared TypeScript types
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 5173 |
| `npm run build` | Type-check and production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Environment

Copy `.env.example` to `.env` for production builds:

```
VITE_API_URL=http://localhost:3000
```

In development, the Vite proxy handles `/api` automatically.
