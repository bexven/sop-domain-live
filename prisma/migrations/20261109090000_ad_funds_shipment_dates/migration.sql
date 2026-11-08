-- AlterTable
ALTER TABLE "AdPayment" ADD COLUMN     "feeBdt" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" DATE,
ADD COLUMN     "usdRate" DECIMAL(12,4);

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "arrivedOn" DATE,
ADD COLUMN     "shippingPaidOn" DATE;


-- Shipments already marked arrived get their arrival day.
UPDATE "Shipment" SET "arrivedOn" = ("arrivedAt" AT TIME ZONE 'Asia/Dhaka')::date WHERE "arrived" AND "arrivedOn" IS NULL AND "arrivedAt" IS NOT NULL;
