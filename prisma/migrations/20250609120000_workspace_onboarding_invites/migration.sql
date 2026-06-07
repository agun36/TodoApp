-- User profile
ALTER TABLE "User" ADD COLUMN "name" TEXT;

-- Workspace
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teamType" TEXT,
    "teamSize" TEXT,
    "primaryUse" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workspace_ownerId_key" ON "Workspace"("ownerId");

ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Workspace members
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invite: token, expiry, workspace scope
ALTER TABLE "Invite" ADD COLUMN "token" TEXT;
ALTER TABLE "Invite" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Invite" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Legacy invites cannot be migrated without a workspace; clear them for MVP token flow.
DELETE FROM "Invite";

ALTER TABLE "Invite" ALTER COLUMN "token" SET NOT NULL;
ALTER TABLE "Invite" ALTER COLUMN "expiresAt" SET NOT NULL;
ALTER TABLE "Invite" ALTER COLUMN "workspaceId" SET NOT NULL;

CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

DROP INDEX IF EXISTS "Invite_email_key";
CREATE UNIQUE INDEX "Invite_workspaceId_email_key" ON "Invite"("workspaceId", "email");

ALTER TABLE "Invite" ADD CONSTRAINT "Invite_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
