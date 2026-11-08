-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "oldImageAssets" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "oldVideoAssets" TEXT[] DEFAULT ARRAY[]::TEXT[];

