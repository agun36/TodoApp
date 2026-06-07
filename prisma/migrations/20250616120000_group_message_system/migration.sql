-- AlterTable
ALTER TABLE "GroupMessage" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "GroupMessage" ADD COLUMN "systemEvent" JSONB;
