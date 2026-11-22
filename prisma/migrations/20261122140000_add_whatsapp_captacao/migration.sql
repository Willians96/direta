-- Sprint 22 — Captação via WhatsApp.
-- 1) Guarda cada mensagem recebida no WhatsApp (dedupe por wamid + auditoria).
-- 2) Campos de análise automática no Lead (resumo, tags, score, curso/status sugeridos).

CREATE TYPE "WhatsappInboundStatus" AS ENUM ('RECEBIDA', 'ANALISADA', 'IGNORADA', 'ERRO');

CREATE TABLE "whatsapp_inbounds" (
    "id" TEXT NOT NULL,
    "wamid" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "pushname" TEXT,
    "type" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "WhatsappInboundStatus" NOT NULL DEFAULT 'RECEBIDA',
    "analysis" TEXT,
    "error" TEXT,
    "leadId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_inbounds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_inbounds_wamid_key" ON "whatsapp_inbounds"("wamid");
CREATE INDEX "whatsapp_inbounds_status_idx" ON "whatsapp_inbounds"("status");
CREATE INDEX "whatsapp_inbounds_receivedAt_idx" ON "whatsapp_inbounds"("receivedAt");
CREATE INDEX "whatsapp_inbounds_leadId_idx" ON "whatsapp_inbounds"("leadId");

ALTER TABLE "leads" ADD COLUMN "whatsappId" TEXT;
ALTER TABLE "leads" ADD COLUMN "aiSummary" TEXT;
ALTER TABLE "leads" ADD COLUMN "aiTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "leads" ADD COLUMN "aiScore" INTEGER;
ALTER TABLE "leads" ADD COLUMN "aiIntent" TEXT;
ALTER TABLE "leads" ADD COLUMN "aiStatus" "SalesStatus";
ALTER TABLE "leads" ADD COLUMN "aiCourseId" TEXT;
ALTER TABLE "leads" ADD COLUMN "aiModel" TEXT;
ALTER TABLE "leads" ADD COLUMN "aiRaw" TEXT;
ALTER TABLE "leads" ADD COLUMN "aiAnalyzedAt" TIMESTAMP(3);

CREATE INDEX "leads_whatsappId_idx" ON "leads"("whatsappId");

ALTER TABLE "whatsapp_inbounds" ADD CONSTRAINT "whatsapp_inbounds_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_aiCourseId_fkey" FOREIGN KEY ("aiCourseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
