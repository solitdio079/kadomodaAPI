-- Preserve existing rows and relationships; eliminate implicit ID 0 on new rows.
ALTER TABLE "Product" ALTER COLUMN "categoryId" DROP DEFAULT;
ALTER TABLE "Product" ALTER COLUMN "campaignId" DROP DEFAULT;
ALTER TABLE "Product" ALTER COLUMN "campaignId" DROP NOT NULL;
ALTER TABLE "Product" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "seedKey" TEXT;
CREATE UNIQUE INDEX "Product_seedKey_key" ON "Product"("seedKey");
