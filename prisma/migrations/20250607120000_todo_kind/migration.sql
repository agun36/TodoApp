-- Personal todos vs project-management tasks
ALTER TABLE "Todo" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'personal';

-- Existing PM work becomes tasks (inbox-only items without assignee stay personal)
UPDATE "Todo"
SET "kind" = 'task'
WHERE "assigneeId" IS NOT NULL
   OR "projectId" IN (SELECT "id" FROM "Project" WHERE "isInbox" = false)
   OR "description" IS NOT NULL
   OR "status" = 'in_progress'
   OR "priority" IN ('low', 'high');
