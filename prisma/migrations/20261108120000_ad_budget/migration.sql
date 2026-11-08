-- CreateTable
CREATE TABLE "AdProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "providerId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPayment" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "providerId" TEXT NOT NULL,
    "paidOn" DATE NOT NULL,
    "amountBdt" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCredit" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "rateToBdt" DECIMAL(12,4) NOT NULL DEFAULT 1,

    CONSTRAINT "AdCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSpend" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "spentOn" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdSpend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdProvider_name_key" ON "AdProvider"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AdAccount_name_key" ON "AdAccount"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AdPayment_number_key" ON "AdPayment"("number");

-- CreateIndex
CREATE INDEX "AdPayment_paidOn_idx" ON "AdPayment"("paidOn");

-- CreateIndex
CREATE INDEX "AdCredit_accountId_idx" ON "AdCredit"("accountId");

-- CreateIndex
CREATE INDEX "AdSpend_accountId_spentOn_idx" ON "AdSpend"("accountId", "spentOn");

-- CreateIndex
CREATE INDEX "AdSpend_spentOn_idx" ON "AdSpend"("spentOn");

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AdProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPayment" ADD CONSTRAINT "AdPayment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AdProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCredit" ADD CONSTRAINT "AdCredit_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "AdPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCredit" ADD CONSTRAINT "AdCredit_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSpend" ADD CONSTRAINT "AdSpend_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

