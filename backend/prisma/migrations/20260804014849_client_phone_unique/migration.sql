-- DropIndex
DROP INDEX "Client_phone_idx";

-- AlterTable
ALTER TABLE "Client" ADD CONSTRAINT "Client_phone_key" UNIQUE ("phone");
