-- Where transactional notifications for this business are sent.
-- Nullable: null simply means notifications are off for that business,
-- so this is safe to add to every existing row with no backfill.
ALTER TABLE "Business" ADD COLUMN "notificationEmail" TEXT;
