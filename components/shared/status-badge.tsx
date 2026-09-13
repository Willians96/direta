import { Badge } from "@/components/ui/badge";
import type { LeadStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "secondary" | "neutral" }
> = {
  NOVO: { label: "Novo", variant: "info" },
  QUALIFICADO: { label: "Qualificado", variant: "neutral" },
  PROPOSTA_ENVIADA: { label: "Proposta enviada", variant: "warning" },
  EM_NEGOCIACAO: { label: "Em negociação", variant: "warning" },
  AGUARDANDO_ANALISE: { label: "Em análise", variant: "info" },
  DEVOLVIDA_AJUSTE: { label: "Devolvida", variant: "danger" },
  APROVADA: { label: "Aprovada", variant: "success" },
  PERDIDA: { label: "Perdida", variant: "neutral" },
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
