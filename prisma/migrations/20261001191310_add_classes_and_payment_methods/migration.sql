-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'BOLETO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO', 'TRANSFERENCIA', 'PARCELADO_PROPRIO', 'OUTRO');

-- CreateEnum
CREATE TYPE "ClassStudentStatus" AS ENUM ('ATIVA', 'TRANCADA', 'CONCLUIDA', 'CANCELADA');

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "code" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "professorId" TEXT,
ADD COLUMN     "schedule" JSONB;

-- CreateTable
CREATE TABLE "course_payment_methods" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "details" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_students" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "ClassStudentStatus" NOT NULL DEFAULT 'ATIVA',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "class_students_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_payment_methods_courseId_method_key" ON "course_payment_methods"("courseId", "method");

-- CreateIndex
CREATE INDEX "class_students_classId_idx" ON "class_students"("classId");

-- CreateIndex
CREATE INDEX "class_students_leadId_idx" ON "class_students"("leadId");

-- CreateIndex
CREATE INDEX "class_students_status_idx" ON "class_students"("status");

-- CreateIndex
CREATE UNIQUE INDEX "class_students_classId_leadId_key" ON "class_students"("classId", "leadId");

-- CreateIndex
CREATE INDEX "classes_courseId_idx" ON "classes"("courseId");

-- CreateIndex
CREATE INDEX "classes_professorId_idx" ON "classes"("professorId");

-- CreateIndex
CREATE INDEX "classes_status_idx" ON "classes"("status");

-- AddForeignKey
ALTER TABLE "course_payment_methods" ADD CONSTRAINT "course_payment_methods_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_students" ADD CONSTRAINT "class_students_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_students" ADD CONSTRAINT "class_students_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
