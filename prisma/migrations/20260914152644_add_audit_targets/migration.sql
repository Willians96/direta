-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'USER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'COURSE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'COURSE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'COURSE_STATUS_CHANGED';

-- AlterTable
ALTER TABLE "enrollment_audits" ADD COLUMN     "targetId" TEXT,
ADD COLUMN     "targetType" TEXT;

-- CreateIndex
CREATE INDEX "enrollment_audits_targetType_targetId_idx" ON "enrollment_audits"("targetType", "targetId");
