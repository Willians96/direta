import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

import {
  AlertTriangle,
  Clock,
  Calendar,
  Phone,
  ChevronRight,
  ArrowLeft,
  Timer,
  Hourglass,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUpcomingFollowups, getStaleLeads } from "@/lib/actions/followups";
import { formatDate, formatDateTime } from "@/lib/utils";

/**
 * Página pessoal de Alertas do Vendedor.
 * Foco: TEMPO de cada cadastro (desde criação + desde último contato).
 */

const ACTIVE_STATUSES = [
  "NOVO",
  "QUALIFICADO",
  "PROPOSTA_ENVIADA",
  "EM_NEGOCIACAO",
  "AGUARDANDO_ANALISE",
  "DEVOLVIDA_AJUSTE",
  "QUARTO_CONTATO",
] as const;

export default async function VendasAlertasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;

  // 1. Todos os leads atribuídos ao vendedor (incluindo inativos)
  const meusLeads = await prisma.lead.findMany({
    where: { assignedToId: userId },
    include: {
      course: { select: { name: true } },
      followups: {
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: { occurredAt: true, nextAction: true, nextActionDone: true },
      },
    },
    orderBy: { updatedAt: "asc" },
  });

  // 2. Próximos contatos e parados
  const [stale, upcoming] = await Promise.all([
    getStaleLeads(3, "mine"),
    getUpcomingFollowups(7, "mine"),
  ]);

  // 3. Enriquecer todos os leads com tempo
  type LeadCard = {
    id: string;
    fullName: string;
    status: string;
    priority: "ALTA" | "MEDIA" | "BAIXA";
    courseName: string | null;
    createdAt: Date;
    lastContactAt: Date;
    nextAction: Date | null;
    nextActionDone: boolean;
    daysSinceCreated: number;
    daysSinceContact: number;
  };

  const enriched: LeadCard[] = meusLeads.map((l) => {
    const last = l.followups[0]?.occurredAt ?? l.updatedAt;
    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(l.createdAt).getTime()) / 86_400_000,
    );
    const daysSinceContact = Math.floor(
      (Date.now() - new Date(last).getTime()) / 86_400_000,
    );
    return {
      id: l.id,
      fullName: l.fullName,
      status: l.status,
      priority: l.priority,
      courseName: l.course?.name ?? null,
      createdAt: l.createdAt,
      lastContactAt: last,
      nextAction: l.followups[0]?.nextAction ?? null,
      nextActionDone: l.followups[0]?.nextActionDone ?? true,
      daysSinceCreated,
      daysSinceContact,
    };
  });

  // 4. Faixas de tempo
  const fresh = enriched.filter((l) => l.daysSinceContact < 3);
  const warm = enriched.filter((l) => l.daysSinceContact >= 3 && l.daysSinceContact < 7);
  const critical = enriched.filter((l) => l.daysSinceContact >= 7);

  const leadsByCreated = [...enriched].sort((a, b) => b.daysSinceCreated - a.daysSinceCreated);

  return (
    <div>
      <PageHeader
        title="Meus Alertas"
        description="Tempo de cadastro e contato dos seus leads"
        icon={AlertTriangle}
        action={
          <Button variant="outline" asChild>
            <Link href="/vendas">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* KPIs de tempo */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-slate-500">Recentes (até 3 dias)</div>
                  <div className="text-3xl font-bold text-emerald-600">{fresh.length}</div>
                  <div className="text-xs text-slate-500">Lead novo ou contato recente</div>
                </div>
                <Timer className="h-10 w-10 text-emerald-300" />
              </div>
            </CardContent>
          </Card>
          <Card className={warm.length > 0 ? "border-amber-300" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-slate-500">Atenção (3-7 dias)</div>
                  <div className="text-3xl font-bold text-amber-600">{warm.length}</div>
                  <div className="text-xs text-slate-500">Sem contato há 3+ dias</div>
                </div>
                <Hourglass className="h-10 w-10 text-amber-300" />
              </div>
            </CardContent>
          </Card>
          <Card className={critical.length > 0 ? "border-red-300" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-slate-500">Críticos (7+ dias)</div>
                  <div className="text-3xl font-bold text-red-600">{critical.length}</div>
                  <div className="text-xs text-slate-500">Sem contato há 7+ dias</div>
                </div>
                <AlertTriangle className="h-10 w-10 text-red-300" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela principal: TEMPO de cada cadastro */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-direta-orange" />
              Tempo de Cadastro — todos os meus leads
            </CardTitle>
            <CardDescription>
              {enriched.length} leads · ordenado por mais antigos primeiro
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {enriched.length === 0 ? (
              <div className="rounded-md border border-dashed p-12 text-center text-sm text-slate-500">
                Você não tem leads atribuídos ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Lead</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Prioridade</th>
                      <th className="px-4 py-3">Cadastrado</th>
                      <th className="px-4 py-3">Sem contato</th>
                      <th className="px-4 py-3">Próx. ação</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leadsByCreated.map((l) => {
                      const isCritical = l.daysSinceContact >= 7;
                      const isWarm = l.daysSinceContact >= 3 && l.daysSinceContact < 7;
                      const nextOverdue =
                        l.nextAction && !l.nextActionDone && new Date(l.nextAction) < new Date();

                      return (
                        <tr
                          key={l.id}
                          className={`hover:bg-slate-50 ${
                            isCritical
                              ? "bg-red-50/40"
                              : isWarm
                                ? "bg-amber-50/30"
                                : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{l.fullName}</div>
                            <div className="text-[10px] text-slate-400">{l.courseName ?? "Sem curso"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={l.status as any} />
                          </td>
                          <td className="px-4 py-3">
                            <PriorityBadge priority={l.priority} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-slate-500">{formatDate(l.createdAt)}</div>
                            <div className="text-[10px] text-slate-400">há {l.daysSinceCreated}d</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                isCritical ? "destructive" : isWarm ? "warning" : "neutral"
                              }
                            >
                              {l.daysSinceContact}d parado
                            </Badge>
                            <div className="mt-1 text-[10px] text-slate-400">
                              último: {formatDate(l.lastContactAt)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {l.nextAction && !l.nextActionDone ? (
                              <span
                                className={
                                  nextOverdue
                                    ? "font-semibold text-red-600"
                                    : "text-blue-600"
                                }
                              >
                                {formatDate(l.nextAction)}
                                {nextOverdue && " ⚠️"}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/vendas/leads/${l.id}`}>
                                Abrir
                                <ChevronRight className="ml-1 h-3 w-3" />
                              </Link>
                            </Button>
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

        {/* Próximos Contatos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-blue-600" />
              Próximos Contatos (7 dias)
            </CardTitle>
            <CardDescription>
              Follow-ups agendados — clique para abrir
            </CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">
                Nenhum contato agendado. Registre um follow-up para criar.
              </div>
            ) : (
              <div className="space-y-2">
                {upcoming.map((f) => {
                  const isOverdue = new Date(f.nextAction!) < new Date();
                  return (
                    <Link
                      key={f.id}
                      href={`/vendas/leads/${f.lead.id}`}
                      className={`flex items-center justify-between rounded-md border bg-white p-3 transition-colors hover:border-direta-orange ${
                        isOverdue ? "border-red-300 bg-red-50/30" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                          <Phone className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{f.lead.fullName}</span>
                            <StatusBadge status={f.lead.status} />
                            {isOverdue && <Badge variant="destructive">ATRASADO</Badge>}
                          </div>
                          <div className="text-xs text-slate-500">
                            Agendado para {formatDateTime(f.nextAction)}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
