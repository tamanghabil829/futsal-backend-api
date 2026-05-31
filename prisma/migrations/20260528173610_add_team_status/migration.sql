-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Team_status_idx" ON "Team"("status");
