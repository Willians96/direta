-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'LIGACAO', 'EMAIL', 'REUNIAO', 'PRESENCIAL', 'OUTRO');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('OUTBOUND', 'INBOUND', 'INTERNAL');

-- CreateTable
CREATE TABLE "lead_messages" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "content" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_messages_leadId_occurredAt_idx" ON "lead_messages"("leadId", "occurredAt");

-- CreateIndex
CREATE INDEX "lead_messages_userId_idx" ON "lead_messages"("userId");

-- AddForeignKey
ALTER TABLE "lead_messages" ADD CONSTRAINT "lead_messages_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_messages" ADD CONSTRAINT "lead_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
