-- AlterTable
ALTER TABLE "ShareLink" ADD COLUMN     "licenseAccountId" TEXT;

-- CreateIndex
CREATE INDEX "ShareLink_licenseAccountId_idx" ON "ShareLink"("licenseAccountId");

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_licenseAccountId_fkey" FOREIGN KEY ("licenseAccountId") REFERENCES "LicenseAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
