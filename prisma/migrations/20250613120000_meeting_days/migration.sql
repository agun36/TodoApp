-- Replace single meetingDay with meetingDays array (supports multiple days per week)
ALTER TABLE "TeamMeeting" ADD COLUMN "meetingDays" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "TeamMeeting" SET "meetingDays" = ARRAY["meetingDay"] WHERE "meetingDay" IS NOT NULL AND "meetingDay" <> '';

ALTER TABLE "TeamMeeting" DROP COLUMN "meetingDay";
