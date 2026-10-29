-- CreateEnum
CREATE TYPE "SalesStatus" AS ENUM ('NEGOCIANDO', 'MATRICULADO', 'RETORNAR', 'BLOQUEIOU', 'FECHOU_CONCORRENTE', 'FIN_SEM_RENDA', 'CIDADE_110KM', 'OUTRA_UNIDADE', 'ADM_RESOLVER', 'DUPLICADO', 'OPORTUNIDADE_VENDAS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'COMPRO_ENDERECO';
ALTER TYPE "DocumentType" ADD VALUE 'COMPRO_PAGAMENTO';
ALTER TYPE "DocumentType" ADD VALUE 'FOTO_ALUNO';

-- AlterTable
ALTER TABLE "followups" ADD COLUMN     "salesStatus" "SalesStatus";

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "phone2" TEXT,
ADD COLUMN     "phone3" TEXT,
ADD COLUMN     "salesStatus" "SalesStatus" NOT NULL DEFAULT 'NEGOCIANDO',
ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "classId" TEXT,
    "fullName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "cpf" TEXT,
    "rg" TEXT,
    "phone" TEXT NOT NULL,
    "phone2" TEXT,
    "email" TEXT,
    "addressStreet" TEXT,
    "addressNumber" TEXT,
    "addressComplement" TEXT,
    "addressCity" TEXT,
    "addressState" TEXT,
    "addressZip" TEXT,
    "paymentMethod" "PaymentMethod",
    "paymentDetails" TEXT,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "enrolledById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_leadId_key" ON "enrollments"("leadId");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_enrolledById_fkey" FOREIGN KEY ("enrolledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
