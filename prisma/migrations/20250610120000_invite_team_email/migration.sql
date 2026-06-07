-- AlterTable
ALTER TABLE "Invite" ADD COLUMN "teamEmail" TEXT;

-- AlterTable
ALTER TABLE "WorkspaceMember" ADD COLUMN "teamEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_teamEmail_key" ON "WorkspaceMember"("workspaceId", "teamEmail");
