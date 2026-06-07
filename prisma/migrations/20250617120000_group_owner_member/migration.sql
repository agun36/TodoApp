-- Backfill workspace owners into every existing group channel
INSERT INTO "GroupMember" ("id", "groupId", "userId")
SELECT gen_random_uuid(), g."id", w."ownerId"
FROM "WorkspaceGroup" g
JOIN "Workspace" w ON w."id" = g."workspaceId"
WHERE NOT EXISTS (
  SELECT 1
  FROM "GroupMember" gm
  WHERE gm."groupId" = g."id" AND gm."userId" = w."ownerId"
);
