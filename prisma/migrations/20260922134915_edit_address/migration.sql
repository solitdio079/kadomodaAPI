/*
  Warnings:

  - You are about to drop the column `orderId` on the `Address` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Address_orderId_key";

-- AlterTable
ALTER TABLE "Address" DROP COLUMN "orderId";
