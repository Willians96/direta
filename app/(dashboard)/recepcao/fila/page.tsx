import { ClipboardList } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export const dynamic = "force-dynamic";

export default function RecepcaoFilaPage() {
  return (
    <ComingSoon
      title="Fila de Análise"
      description="Pré-matrículas aguardando validação documental"
      icon={ClipboardList}
      sprint="Sprint 5 · S5"
      features={[
        "Fila ordenada por tempo de espera (mais antigo primeiro)",
        "Badge de urgência para leads parados há mais de 24h",
        "Botões rápidos: APROVAR ou DEVOLVER (com motivo)",
        "Histórico de interações do lead antes da matrícula",
        "Visualização inline dos documentos enviados",
      ]}
    />
  );
}
