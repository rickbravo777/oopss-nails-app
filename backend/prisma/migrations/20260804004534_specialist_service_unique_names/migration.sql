-- AlterTable
ALTER TABLE "Specialist" ADD CONSTRAINT "Specialist_name_key" UNIQUE ("name");

-- AlterTable
ALTER TABLE "Service" ADD CONSTRAINT "Service_name_key" UNIQUE ("name");
