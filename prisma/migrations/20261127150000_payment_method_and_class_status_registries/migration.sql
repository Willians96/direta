-- Cadastro de formas de pagamento e cadastro de situações de turma.
-- A cliente pediu para poder cadastrar "mais formas de pagamento" (a lista era
-- fixa no código) e para "alterar ou criar os status" da turma (idem).
-- Os enums fixos viram texto; o cadastro passa a ser a fonte da verdade.

-- ============================================
-- 1) FORMAS DE PAGAMENTO
-- ============================================

CREATE TABLE "payment_method_types" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_method_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_method_types_description_key" ON "payment_method_types"("description");

-- Formas que existiam no enum antigo (mantêm o mesmo texto para não quebrar nada)
INSERT INTO "payment_method_types" ("id", "description", "active", "createdAt", "updatedAt") VALUES
('pmt_pix', 'PIX', true, NOW(), NOW()),
('pmt_boleto', 'BOLETO', true, NOW(), NOW()),
('pmt_cartao_credito', 'CARTAO_CREDITO', true, NOW(), NOW()),
('pmt_cartao_debito', 'CARTAO_DEBITO', true, NOW(), NOW()),
('pmt_dinheiro', 'DINHEIRO', true, NOW(), NOW()),
('pmt_transferencia', 'TRANSFERENCIA', true, NOW(), NOW()),
('pmt_parcelado_proprio', 'PARCELADO_PROPRIO', true, NOW(), NOW()),
('pmt_outro', 'OUTRO', true, NOW(), NOW());

ALTER TABLE "course_payment_methods" ALTER COLUMN "method" TYPE TEXT USING "method"::text;
ALTER TABLE "enrollments" ALTER COLUMN "paymentMethod" TYPE TEXT USING "paymentMethod"::text;
DROP TYPE "PaymentMethod";

-- ============================================
-- 2) SITUAÇÕES DE TURMA
-- ============================================

CREATE TABLE "class_status_types" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "class_status_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "class_status_types_description_key" ON "class_status_types"("description");

-- Situações que existiam no enum antigo
INSERT INTO "class_status_types" ("id", "description", "active", "createdAt", "updatedAt") VALUES
('cst_aberta', 'ABERTA', true, NOW(), NOW()),
('cst_em_andamento', 'EM_ANDAMENTO', true, NOW(), NOW()),
('cst_encerrada', 'ENCERRADA', true, NOW(), NOW()),
('cst_cancelada', 'CANCELADA', true, NOW(), NOW());

ALTER TABLE "classes" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "classes" ALTER COLUMN "status" TYPE TEXT USING "status"::text;
ALTER TABLE "classes" ALTER COLUMN "status" SET DEFAULT 'ABERTA';
DROP TYPE "ClassStatus";
