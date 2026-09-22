/*
  Warnings:

  - Added the required column `addressId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productId` to the `OrderProduct` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `quantity` on the `OrderProduct` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "Address" DROP CONSTRAINT "Address_orderId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "addressId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "OrderProduct" ADD COLUMN     "productId" INTEGER NOT NULL,
DROP COLUMN "quantity",
ADD COLUMN     "quantity" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "method" SET DEFAULT 'Nakit';

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
