-- AlterTable
ALTER TABLE "Todo" ADD COLUMN "repeatType" TEXT DEFAULT 'none';
ALTER TABLE "Todo" ADD COLUMN "repeatOn" TEXT;
