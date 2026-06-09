-- Active workspace selection for multi-workspace users
ALTER TABLE "User" ADD COLUMN "activeWorkspaceId" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_activeWorkspaceId_fkey"
  FOREIGN KEY ("activeWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
