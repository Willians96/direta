import { GraduationCap } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export const dynamic = "force-dynamic";

export default function AdminCursosPage() {
  return (
    <ComingSoon
      title="Cursos"
      description="Catálogo de cursos, grades curriculares e turmas"
      icon={GraduationCap}
      sprint="Sprint 2 · S2"
      features={[
        "CRUD completo de cursos (nome, carga horária, preço, ementa)",
        "Vincular turmas com data de início, vagas e professor",
        "Status do curso (ATIVO, EM_BREVE, INATIVO)",
        "Upload de grade curricular em PDF",
        "Controle de vagas (lotada, aberta, encerrada)",
      ]}
    />
  );
}
