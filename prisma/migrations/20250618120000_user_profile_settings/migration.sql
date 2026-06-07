-- Cliq-style profile settings on User
ALTER TABLE "User" ADD COLUMN "statusMessage" TEXT;
ALTER TABLE "User" ADD COLUMN "availability" TEXT NOT NULL DEFAULT 'available';
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "extension" TEXT;
ALTER TABLE "User" ADD COLUMN "department" TEXT;
ALTER TABLE "User" ADD COLUMN "designation" TEXT;
ALTER TABLE "User" ADD COLUMN "location" TEXT;
ALTER TABLE "User" ADD COLUMN "timezone" TEXT;
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "User" ADD COLUMN "language" TEXT DEFAULT 'en';
