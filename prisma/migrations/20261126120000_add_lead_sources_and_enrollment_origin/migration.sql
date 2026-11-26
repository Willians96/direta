-- CreateTable
CREATE TABLE "lead_sources" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "noCommission" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_sources_description_key" ON "lead_sources"("description");

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "sourceId" TEXT;

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN "socialNetwork" TEXT;

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN "company" TEXT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Formas de conhecimento — cadastro inicial.
-- A cliente ajusta livremente em Captação > Fontes (Descrição / Não gerar comissão / Situação).
INSERT INTO "lead_sources" ("id", "description", "noCommission", "active", "createdAt", "updatedAt") VALUES
('fonte_whatsapp', 'WhatsApp', false, true, NOW(), NOW()),
('fonte_instagram', 'Instagram', false, true, NOW(), NOW()),
('fonte_facebook', 'Facebook', false, true, NOW(), NOW()),
('fonte_google', 'Google', false, true, NOW(), NOW()),
('fonte_site', 'Site', false, true, NOW(), NOW()),
('fonte_indicacao', 'Indicação', false, true, NOW(), NOW()),
('fonte_portao', 'Portão (indicação)', false, true, NOW(), NOW()),
('fonte_escola_aluno', 'Escola / aluno', false, true, NOW(), NOW()),
('fonte_evento', 'Evento', false, true, NOW(), NOW()),
('fonte_outdoor', 'Outdoor', false, true, NOW(), NOW()),
('fonte_messenger', 'Messenger / Facebook', false, true, NOW(), NOW()),
('fonte_direct', 'Direct / Instagram', false, true, NOW(), NOW()),
('fonte_cidade_longe', 'Cidade longe', false, true, NOW(), NOW()),
('fonte_outro', 'Outro', false, true, NOW(), NOW())
ON CONFLICT ("description") DO NOTHING;

-- Liga os leads já cadastrados ao cadastro de Formas de Conhecimento
UPDATE "leads" l
SET "source" = s."description", "sourceId" = s."id"
FROM "lead_sources" s
WHERE l."source" IS NOT NULL
  AND btrim(l."source") <> ''
  AND lower(btrim(s."description")) = lower(btrim(l."source"));
