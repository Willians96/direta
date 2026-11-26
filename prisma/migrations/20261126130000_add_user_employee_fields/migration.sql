-- Cadastro de colaboradores: campos do sistema antigo pedido pela cliente
-- (Código, Admissão, CPF, RG, Nascimento, Endereço, Celular, Cargo,
--  Observações e "Aparecer para efetuar matrícula").
ALTER TABLE "users" ADD COLUMN "code" TEXT;
ALTER TABLE "users" ADD COLUMN "admissionDate" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "cpf" TEXT;
ALTER TABLE "users" ADD COLUMN "rg" TEXT;
ALTER TABLE "users" ADD COLUMN "birthDate" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "mobile" TEXT;
ALTER TABLE "users" ADD COLUMN "jobTitle" TEXT;
ALTER TABLE "users" ADD COLUMN "addressStreet" TEXT;
ALTER TABLE "users" ADD COLUMN "addressNumber" TEXT;
ALTER TABLE "users" ADD COLUMN "addressDistrict" TEXT;
ALTER TABLE "users" ADD COLUMN "addressCity" TEXT;
ALTER TABLE "users" ADD COLUMN "addressState" TEXT;
ALTER TABLE "users" ADD COLUMN "addressZip" TEXT;
ALTER TABLE "users" ADD COLUMN "notes" TEXT;
ALTER TABLE "users" ADD COLUMN "showEnrollment" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "users_code_key" ON "users"("code");
