/*
  Warnings:

  - You are about to drop the column `products` on the `Cart` table. All the data in the column will be lost.
  - You are about to drop the column `quantities` on the `Cart` table. All the data in the column will be lost.
  - You are about to drop the column `sizes` on the `Cart` table. All the data in the column will be lost.
  - You are about to drop the column `products` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `quantities` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `sizes` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Cart" DROP COLUMN "products",
DROP COLUMN "quantities",
DROP COLUMN "sizes";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "products",
DROP COLUMN "quantities",
DROP COLUMN "sizes";

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "campaignId" SET DEFAULT 0,
ALTER COLUMN "categoryId" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "OrderProduct" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,

    CONSTRAINT "OrderProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartProduct" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "cartId" INTEGER NOT NULL,

    CONSTRAINT "CartProduct_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OrderProduct" ADD CONSTRAINT "OrderProduct_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartProduct" ADD CONSTRAINT "CartProduct_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
