-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#4f46e5',
    "status" TEXT NOT NULL DEFAULT 'active',
    "isInbox" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Todo" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "Todo" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'todo';
ALTER TABLE "Todo" ADD COLUMN "description" TEXT;
ALTER TABLE "Todo" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Todo" ADD COLUMN "projectId" TEXT;

-- Sync status from legacy done flag
UPDATE "Todo" SET "status" = 'done' WHERE "done" = true;
UPDATE "Todo" SET "status" = 'todo' WHERE "done" = false;

-- CreateIndex
CREATE UNIQUE INDEX "Project_userId_name_key" ON "Project"("userId", "name");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
