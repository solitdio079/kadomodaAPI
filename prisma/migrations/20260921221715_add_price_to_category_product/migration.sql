/*
  Warnings:

  - Added the required column `price` to the `CartProduct` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Cart" ALTER COLUMN "subtotal" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "CartProduct" ADD COLUMN     "price" DECIMAL(10,2) NOT NULL;
