import { Clock, CheckCircle2 } from "lucide-react";
import { FollowupType, FollowupOutcome, SalesStatus } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSalesStatusLabel } from "@/components/shared/sales-status-badge";

/**
 * Histórico de Follow-ups no formato pedido pela cliente:
 *
 *   DT CTT   | HORÁRIO | HISTÓRICO | STATUS
 *   29/10/26 | 12:00   | XXXXX     | RETORNAR
 *
 * Uma linha embaixo da outra.
 */

const TYPE_LABELS: Record<FollowupType, string> = {
  LIGACAO: "Ligação",
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  REUNIAO: "Reunião",
  VISITA: "Visita",
  OUTRO: "Outro",
};

const OUTCOME_LABELS: Record<FollowupOutcome, { label: string; color: string }> = {
  ATENDEU: { label: "Atendeu", color: "bg-emerald-100 text-emerald-700" },
  REAGENDOU: { label: "Reagendou", color: "bg-blue-100 text-blue-700" },
  RECADO: { label: "Recado", color: "bg-amber-100 text-amber-700" },
  NAO_ATENDEU: { label: "Não atendeu", color: "bg-slate-100 text-slate-600" },
  SEM_RESPOSTA: { label: "Sem resposta", color: "bg-slate-100 text-slate-600" },
  DESISTIU: { label: "Desistiu", color: "bg-red-100 text-red-700" },
};

export type FollowupRow = {
  id: string;
  type: FollowupType;
  outcome: FollowupOutcome;
  salesStatus: SalesStatus | null;
  notes: string | null;
  nextAction: Date | null;
  nextActionDone: boolean;
  occurredAt: Date;
  user: { id: string; name: string };
};

function formatDateBR(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(d));
}

function formatTimeBR(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export function FollowupHistoryTable({ items }: { items: FollowupRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico de Follow-ups</CardTitle>
        <CardDescription>
          Data do contato · horário · conversa com o cliente · status de venda
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">
            Nenhum follow-up registrado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 whitespace-nowrap">DT CTT</th>
                  <th className="px-4 py-3 whitespace-nowrap">Horário</th>
                  <th className="px-4 py-3">Histórico</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((f) => {
                  const outcome = OUTCOME_LABELS[f.outcome];
                  const isOverdue =
                    f.nextAction && !f.nextActionDone && new Date(f.nextAction) < new Date();

                  return (
                    <tr key={f.id} className="align-top hover:bg-slate-50">
                      {/* DT CTT */}
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-700">
                        {formatDateBR(f.occurredAt)}
                      </td>

                      {/* HORÁRIO */}
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                        {formatTimeBR(f.occurredAt)}
                      </td>

                      {/* HISTÓRICO */}
                      <td className="px-4 py-3">
                        <div className="whitespace-pre-wrap text-slate-800">
                          {f.notes || <span className="text-slate-400">—</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                            {TYPE_LABELS[f.type]}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] ${outcome.color}`}>
                            {outcome.label}
                          </span>
                          <span className="text-[10px] text-slate-400">por {f.user.name}</span>
                          {f.nextAction && !f.nextActionDone && (
                            <span
                              className={`flex items-center gap-1 text-[10px] ${
                                isOverdue ? "font-semibold text-red-600" : "text-blue-600"
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              próx: {formatDateBR(f.nextAction)} {formatTimeBR(f.nextAction)}
                            </span>
                          )}
                          {f.nextAction && f.nextActionDone && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" />
                              próx. feito
                            </span>
                          )}
                        </div>
                      </td>

                      {/* STATUS */}
                      <td className="whitespace-nowrap px-4 py-3">
                        {f.salesStatus ? (
                          <Badge
                            variant={
                              f.salesStatus === "MATRICULADO"
                                ? "success"
                                : f.salesStatus === "NEGOCIANDO"
                                  ? "warning"
                                  : f.salesStatus === "RETORNAR"
                                    ? "info"
                                    : f.salesStatus === "OPORTUNIDADE_VENDAS"
                                      ? "default"
                                      : "neutral"
                            }
                          >
                            {getSalesStatusLabel(f.salesStatus)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
