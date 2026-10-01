import { Badge } from "@/components/ui/badge";
import type { LeadStatus, LeadPriority } from "@prisma/client";

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
  // Sprint 11 — status expandidos
  QUARTO_CONTATO: { label: "4º contato", variant: "warning" },
  BLOQUEIOU: { label: "Bloqueou", variant: "danger" },
  CONCORRENTE: { label: "Concorrente", variant: "danger" },
  FIN_SEM_RENDA: { label: "S/ renda", variant: "neutral" },
  INATIVO: { label: "Inativo", variant: "neutral" },
};

const PRIORITY_CONFIG: Record<
  LeadPriority,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "secondary" | "neutral" }
> = {
  ALTA: { label: "Alta", variant: "danger" },
  MEDIA: { label: "Média", variant: "warning" },
  BAIXA: { label: "Baixa", variant: "neutral" },
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: LeadPriority }) {
  const config = PRIORITY_CONFIG[priority];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
