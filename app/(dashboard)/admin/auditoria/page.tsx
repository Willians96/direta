import { FileText } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export const dynamic = "force-dynamic";

export default function AdminAuditoriaPage() {
  return (
    <ComingSoon
      title="Auditoria"
      description="Log completo de todas as ações no sistema"
      icon={FileText}
      sprint="Sprint 6 · S6"
      features={[
        "Timeline cronológica de todas as ações (criação, edição, exclusão)",
        "Filtros por usuário, tipo de ação, período e entidade",
        "Detalhes do antes/depois de cada alteração",
        "Exportação de logs em CSV/Excel para auditoria externa",
        "Detecção automática de ações suspeitas",
      ]}
    />
  );
}
