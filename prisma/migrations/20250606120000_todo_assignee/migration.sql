-- Add optional assignee for team task assignment
ALTER TABLE "Todo" ADD COLUMN "assigneeId" TEXT;

ALTER TABLE "Todo" ADD CONSTRAINT "Todo_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Todo_assigneeId_idx" ON "Todo"("assigneeId");
