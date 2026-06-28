-- Replace the OrderStatus workflow (PENDING/IN_PROGRESS/COMPLETED/CANCELLED)
-- with production stages. Existing rows are mapped to the closest new stage.

-- 1. Park the old enum.
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";

-- 2. Create the new enum.
CREATE TYPE "OrderStatus" AS ENUM (
  'FABRIC_SELECTION', 'CUTTING', 'PRODUCTION', 'QUALITY_CHECK', 'IRON_PACKING', 'DELIVERY'
);

-- 3. Drop the column default before changing the type.
ALTER TABLE "Receipt" ALTER COLUMN "orderStatus" DROP DEFAULT;

-- 4. Convert Receipt.orderStatus, mapping old values → new stages.
ALTER TABLE "Receipt"
  ALTER COLUMN "orderStatus" TYPE "OrderStatus"
  USING (
    CASE "orderStatus"::text
      WHEN 'PENDING'     THEN 'FABRIC_SELECTION'
      WHEN 'IN_PROGRESS' THEN 'PRODUCTION'
      WHEN 'COMPLETED'   THEN 'DELIVERY'
      WHEN 'CANCELLED'   THEN 'DELIVERY'
      ELSE 'FABRIC_SELECTION'
    END
  )::"OrderStatus";

-- 5. Convert the history table (toStatus NOT NULL, fromStatus nullable).
ALTER TABLE "OrderStatusHistory"
  ALTER COLUMN "toStatus" TYPE "OrderStatus"
  USING (
    CASE "toStatus"::text
      WHEN 'PENDING'     THEN 'FABRIC_SELECTION'
      WHEN 'IN_PROGRESS' THEN 'PRODUCTION'
      WHEN 'COMPLETED'   THEN 'DELIVERY'
      WHEN 'CANCELLED'   THEN 'DELIVERY'
      ELSE 'FABRIC_SELECTION'
    END
  )::"OrderStatus";

ALTER TABLE "OrderStatusHistory"
  ALTER COLUMN "fromStatus" TYPE "OrderStatus"
  USING (
    CASE "fromStatus"::text
      WHEN 'PENDING'     THEN 'FABRIC_SELECTION'
      WHEN 'IN_PROGRESS' THEN 'PRODUCTION'
      WHEN 'COMPLETED'   THEN 'DELIVERY'
      WHEN 'CANCELLED'   THEN 'DELIVERY'
      ELSE NULL
    END
  )::"OrderStatus";

-- 6. Restore the default with the new starting stage.
ALTER TABLE "Receipt" ALTER COLUMN "orderStatus" SET DEFAULT 'FABRIC_SELECTION';

-- 7. Drop the old enum.
DROP TYPE "OrderStatus_old";
