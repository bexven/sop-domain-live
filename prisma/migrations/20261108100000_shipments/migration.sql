-- CreateTable
CREATE TABLE "ShippingVendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "vendorId" TEXT,
    "productOrderId" TEXT,
    "reorderOfId" TEXT,
    "orderedBy" TEXT NOT NULL,
    "orderedOn" DATE NOT NULL,
    "totalWeightKg" DECIMAL(12,3),
    "quantity" INTEGER NOT NULL,
    "shippingCostBdt" DECIMAL(12,2),
    "estimatedDeliveryOn" DATE,
    "shippingPaid" BOOLEAN NOT NULL DEFAULT false,
    "arrived" BOOLEAN NOT NULL DEFAULT false,
    "arrivedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShippingVendor_name_key" ON "ShippingVendor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_number_key" ON "Shipment"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_productOrderId_key" ON "Shipment"("productOrderId");

-- CreateIndex
CREATE INDEX "Shipment_productId_orderedOn_idx" ON "Shipment"("productId", "orderedOn");

-- CreateIndex
CREATE INDEX "Shipment_arrived_estimatedDeliveryOn_idx" ON "Shipment"("arrived", "estimatedDeliveryOn");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "ShippingVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_reorderOfId_fkey" FOREIGN KEY ("reorderOfId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Default vendor.
INSERT INTO "ShippingVendor" ("id", "name", "isDefault") VALUES ('vendor-al-baraka', 'Al Baraka', true) ON CONFLICT ("name") DO NOTHING;
