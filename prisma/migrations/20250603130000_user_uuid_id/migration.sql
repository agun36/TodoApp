-- Replace integer User.id with UUID strings and update Todo.userId FK
ALTER TABLE "User" ADD COLUMN "id_uuid" TEXT;
UPDATE "User" SET "id_uuid" = gen_random_uuid()::text WHERE "id_uuid" IS NULL;
ALTER TABLE "User" ALTER COLUMN "id_uuid" SET NOT NULL;

ALTER TABLE "Todo" ADD COLUMN "userId_uuid" TEXT;
UPDATE "Todo" t
SET "userId_uuid" = u."id_uuid"
FROM "User" u
WHERE t."userId" = u."id";

ALTER TABLE "Todo" DROP CONSTRAINT IF EXISTS "Todo_userId_fkey";

ALTER TABLE "User" DROP CONSTRAINT "User_pkey";
ALTER TABLE "User" DROP COLUMN "id";
ALTER TABLE "User" RENAME COLUMN "id_uuid" TO "id";
ALTER TABLE "User" ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

ALTER TABLE "Todo" DROP COLUMN "userId";
ALTER TABLE "Todo" RENAME COLUMN "userId_uuid" TO "userId";
ALTER TABLE "Todo" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "Todo" ADD CONSTRAINT "Todo_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
