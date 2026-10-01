import { Phone, MessageSquare, Mail, Calendar, MapPin, MoreHorizontal, Clock, CheckCircle2 } from "lucide-react";
import { FollowupType, FollowupOutcome } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

const TYPE_ICONS: Record<FollowupType, React.ComponentType<{ className?: string }>> = {
  LIGACAO: Phone,
  WHATSAPP: MessageSquare,
  EMAIL: Mail,
  REUNIAO: Calendar,
  VISITA: MapPin,
  OUTRO: MoreHorizontal,
};

const OUTCOME_LABELS: Record<FollowupOutcome, { label: string; color: string }> = {
  ATENDEU: { label: "Atendeu", color: "bg-emerald-100 text-emerald-700" },
  REAGENDOU: { label: "Reagendou", color: "bg-blue-100 text-blue-700" },
  RECADO: { label: "Recado", color: "bg-amber-100 text-amber-700" },
  NAO_ATENDEU: { label: "Não atendeu", color: "bg-slate-100 text-slate-600" },
  SEM_RESPOSTA: { label: "Sem resposta", color: "bg-slate-100 text-slate-600" },
  DESISTIU: { label: "Desistiu", color: "bg-red-100 text-red-700" },
};

export type FollowupItem = {
  id: string;
  type: FollowupType;
  outcome: FollowupOutcome;
  notes: string | null;
  nextAction: Date | null;
  nextActionDone: boolean;
  occurredAt: Date;
  user: { id: string; name: string };
};

export function FollowupTimeline({ items }: { items: FollowupItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Follow-ups</CardTitle>
          <CardDescription>
            Sem follow-ups registrados ainda
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico de Follow-ups ({items.length})</CardTitle>
        <CardDescription>
          Acionamentos e próximos contatos agendados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4 border-l-2 border-slate-200 pl-6">
          {items.map((it) => {
            const Icon = TYPE_ICONS[it.type] ?? Phone;
            const outcome = OUTCOME_LABELS[it.outcome];
            const isOverdue =
              it.nextAction &&
              !it.nextActionDone &&
              new Date(it.nextAction) < new Date();

            return (
              <div key={it.id} className="relative">
                <div className="absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full bg-white ring-2 ring-direta-orange">
                  <Icon className="h-3 w-3 text-direta-orange" />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-900">
                    {it.type.replace("_", " ").toLowerCase()}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${outcome.color}`}>
                      {outcome.label}
                    </span>
                    <span className="text-xs text-slate-500">{formatDateTime(it.occurredAt)}</span>
                  </div>
                </div>

                {it.notes && (
                  <div className="mt-1 text-sm text-slate-600">{it.notes}</div>
                )}

                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <span>por {it.user.name}</span>
                  {it.nextAction && (
                    <span className={`flex items-center gap-1 ${isOverdue ? "font-semibold text-red-600" : "text-amber-600"}`}>
                      {it.nextActionDone ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      próximo: {formatDateTime(it.nextAction)}
                      {it.nextActionDone ? " (feito)" : isOverdue ? " (atrasado)" : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
