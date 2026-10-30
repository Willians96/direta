import { Badge } from "@/components/ui/badge";
import type { SalesStatus } from "@prisma/client";

/**
 * status do cliente — classificação que o VENDEDOR faz do cliente.
 * Substitui visualmente o "DEVOLVIDA" nas listagens.
 */
const SALES_STATUS_CONFIG: Record<
  SalesStatus,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "secondary" | "neutral" }
> = {
  NEGOCIANDO: { label: "Negociando", variant: "warning" },
  MATRICULADO: { label: "Matriculado", variant: "success" },
  RETORNAR: { label: "Retornar", variant: "info" },
  BLOQUEIOU: { label: "Bloqueou", variant: "danger" },
  FECHOU_CONCORRENTE: { label: "Fechou c/ conco", variant: "danger" },
  FIN_SEM_RENDA: { label: "Financeiro s/ renda", variant: "neutral" },
  CIDADE_110KM: { label: "Cidade 110 km", variant: "neutral" },
  OUTRA_UNIDADE: { label: "Outra unidade", variant: "neutral" },
  ADM_RESOLVER: { label: "ADM resolver", variant: "secondary" },
  DUPLICADO: { label: "Duplicado", variant: "neutral" },
  OPORTUNIDADE_VENDAS: { label: "Oportunidade vendas", variant: "default" },
  VISITA: { label: "Visita na escola", variant: "info" },
};

export const SALES_STATUS_OPTIONS = (
  Object.keys(SALES_STATUS_CONFIG) as SalesStatus[]
).map((value) => ({ value, label: SALES_STATUS_CONFIG[value].label }));

export function getSalesStatusLabel(status: SalesStatus) {
  return SALES_STATUS_CONFIG[status]?.label ?? status;
}

export function SalesStatusBadge({ status }: { status: SalesStatus }) {
  const config = SALES_STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
