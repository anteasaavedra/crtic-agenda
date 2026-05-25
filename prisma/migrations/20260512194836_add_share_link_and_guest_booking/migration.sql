-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_participantId_fkey";

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "cancelTokenHash" TEXT,
ADD COLUMN     "guestEmail" TEXT,
ADD COLUMN     "guestName" TEXT,
ADD COLUMN     "shareLinkId" TEXT,
ALTER COLUMN "participantId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMPTZ(6),
    "maxPerWeekEmail" INTEGER NOT NULL DEFAULT 3,
    "cancelCutoffHrs" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");

-- CreateIndex
CREATE INDEX "ShareLink_toolId_idx" ON "ShareLink"("toolId");

-- CreateIndex
CREATE INDEX "ShareLink_token_idx" ON "ShareLink"("token");

-- CreateIndex
CREATE INDEX "Reservation_shareLinkId_startsAt_idx" ON "Reservation"("shareLinkId", "startsAt");

-- CreateIndex
CREATE INDEX "Reservation_guestEmail_startsAt_idx" ON "Reservation"("guestEmail", "startsAt");

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "ShareLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
