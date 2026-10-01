-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('ALTA', 'MEDIA', 'BAIXA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadStatus" ADD VALUE 'QUARTO_CONTATO';
ALTER TYPE "LeadStatus" ADD VALUE 'BLOQUEIOU';
ALTER TYPE "LeadStatus" ADD VALUE 'CONCORRENTE';
ALTER TYPE "LeadStatus" ADD VALUE 'FIN_SEM_RENDA';
ALTER TYPE "LeadStatus" ADD VALUE 'INATIVO';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIA';
