-- Safe for DBs created before repeat columns existed
ALTER TABLE "Todo" ADD COLUMN IF NOT EXISTS "repeatType" TEXT DEFAULT 'none';
ALTER TABLE "Todo" ADD COLUMN IF NOT EXISTS "repeatOn" TEXT;
