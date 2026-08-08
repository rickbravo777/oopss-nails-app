-- DropForeignKey
ALTER TABLE "PhotoUpload" DROP CONSTRAINT "PhotoUpload_clientId_fkey";

-- AlterTable
ALTER TABLE "PhotoUpload" ALTER COLUMN "clientId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PhotoUpload" ADD CONSTRAINT "PhotoUpload_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
