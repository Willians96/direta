-- CreateEnum
CREATE TYPE "FollowupType" AS ENUM ('LIGACAO', 'WHATSAPP', 'EMAIL', 'REUNIAO', 'VISITA', 'OUTRO');

-- CreateEnum
CREATE TYPE "FollowupOutcome" AS ENUM ('ATENDEU', 'NAO_ATENDEU', 'RECADO', 'DESISTIU', 'REAGENDOU', 'SEM_RESPOSTA');

-- CreateTable
CREATE TABLE "followups" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "FollowupType" NOT NULL,
    "outcome" "FollowupOutcome" NOT NULL,
    "notes" TEXT,
    "nextAction" TIMESTAMP(3),
    "nextActionDone" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "followups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "followups_leadId_idx" ON "followups"("leadId");

-- CreateIndex
CREATE INDEX "followups_userId_idx" ON "followups"("userId");

-- CreateIndex
CREATE INDEX "followups_occurredAt_idx" ON "followups"("occurredAt");

-- CreateIndex
CREATE INDEX "followups_nextAction_idx" ON "followups"("nextAction");

-- CreateIndex
CREATE INDEX "followups_nextActionDone_idx" ON "followups"("nextActionDone");

-- AddForeignKey
ALTER TABLE "followups" ADD CONSTRAINT "followups_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followups" ADD CONSTRAINT "followups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
