-- Replace integer Todo.id with UUID strings (existing rows get new ids)
ALTER TABLE "Todo" ADD COLUMN "id_uuid" TEXT;

UPDATE "Todo" SET "id_uuid" = gen_random_uuid()::text WHERE "id_uuid" IS NULL;

ALTER TABLE "Todo" ALTER COLUMN "id_uuid" SET NOT NULL;

ALTER TABLE "Todo" DROP CONSTRAINT "Todo_pkey";
ALTER TABLE "Todo" DROP COLUMN "id";
ALTER TABLE "Todo" RENAME COLUMN "id_uuid" TO "id";
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_pkey" PRIMARY KEY ("id");
