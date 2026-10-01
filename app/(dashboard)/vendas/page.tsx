import Link from "next/link";
import {
  Target,
  Clock,
  CheckCircle2,
  Plus,
  ArrowRight,
  UserPlus,
  TrendingUp,
  Calendar,
  Flame,
  DollarSign,
  Phone,
} from "lucide-react";

export const dynamic = "force-dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { AlertsCard } from "@/components/shared/followups/alerts-card";
import { RegisterFollowupDialog } from "@/components/shared/followups/register-followup-dialog";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPhone,
} from "@/lib/utils";
import {
  getStaleLeads,
  getUpcomingFollowups,
  getTodayFollowupMetrics,
} from "@/lib/actions/followups";
import { getGoalProgress } from "@/lib/actions/goals";

const FUNIL_STAGES = [
  { status: "NOVO", label: "Novos", cor: "bg-slate-400" },
  { status: "QUALIFICADO", label: "Qualificados", cor: "bg-sky-500" },
  { status: "PROPOSTA_ENVIADA", label: "Proposta enviada", cor: "bg-amber-500" },
  { status: "EM_NEGOCIACAO", label: "Em negociação", cor: "bg-orange-500" },
  { status: "AGUARDANDO_ANALISE", label: "Em análise", cor: "bg-indigo-500" },
  { status: "APROVADA", label: "Convertidos (mês)", cor: "bg-emerald-500" },
] as const;

const STATUS_PRIORITY: Record<string, number> = {
  AGUARDANDO_ANALISE: 1,
  DEVOLVIDA_AJUSTE: 2,
  EM_NEGOCIACAO: 3,
  PROPOSTA_ENVIADA: 4,
  QUARTO_CONTATO: 5,
  QUALIFICADO: 6,
  NOVO: 7,
};

export default async function VendasDashboardPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string;
  const userName = (session?.user?.name as string) ?? "";

  const now = new Date();
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const start30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // === KPIs base ===
  const [
    leadsAtivos,
    leadsConvertidosMes,
    leadsConvertidosMesAnterior,
    meusLeads,
    goalProgress,
  ] = await Promise.all([
    prisma.lead.count({
      where: {
        assignedToId: userId,
        status: { notIn: ["APROVADA", "PERDIDA"] },
      },
    }),
    prisma.lead.count({
      where: {
        assignedToId: userId,
        status: "APROVADA",
        updatedAt: { gte: startThisMonth },
      },
    }),
    prisma.lead.count({
      where: {
        assignedToId: userId,
        status: "APROVADA",
        updatedAt: {
          gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          lt: startThisMonth,
        },
      },
    }),
    prisma.lead.findMany({
      where: { assignedToId: userId },
      include: {
        course: { select: { name: true } },
        followups: {
          orderBy: { occurredAt: "desc" },
          take: 1,
          select: { occurredAt: true, nextAction: true, nextActionDone: true },
        },
      },
    }),
    getGoalProgress(userId, now.getMonth() + 1, now.getFullYear()),
  ]);

  const totalMeusLeads = meusLeads.length;
  const conversao =
    totalMeusLeads > 0
      ? Number(((leadsConvertidosMes / totalMeusLeads) * 100).toFixed(1))
      : 0;

  const trend =
    leadsConvertidosMesAnterior > 0
      ? Number(
          (
            ((leadsConvertidosMes - leadsConvertidosMesAnterior) /
              leadsConvertidosMesAnterior) *
            100
          ).toFixed(1)
        )
      : 0;

  const aprovadosRecentes = await prisma.lead.findMany({
    where: {
      assignedToId: userId,
      status: "APROVADA",
      updatedAt: { gte: start30Ago },
    },
    select: { createdAt: true, updatedAt: true },
  });
  let tempoMedio = "—";
  if (aprovadosRecentes.length > 0) {
    const totalDias = aprovadosRecentes.reduce((acc, l) => {
      const diff = (l.updatedAt.getTime() - l.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return acc + diff;
    }, 0);
    tempoMedio = `${(totalDias / aprovadosRecentes.length).toFixed(1)} dias`;
  }

  const funilGroups = await prisma.lead.groupBy({
    by: ["status"],
    where: { assignedToId: userId },
    _count: { _all: true },
  });
  const funilData = FUNIL_STAGES.map((s) => ({
    ...s,
    quantidade: funilGroups.find((g) => g.status === s.status)?._count._all ?? 0,
  }));

  const [staleMine, upcomingMine, todayMetrics] = await Promise.all([
    getStaleLeads(3, "mine"),
    getUpcomingFollowups(7, "mine"),
    getTodayFollowupMetrics("mine"),
  ]);

  // === Calcular dias parado por lead (pra tabela) ===
  const meusLeadsComDias = meusLeads.map((l) => {
    const last = l.followups[0]?.occurredAt ?? l.updatedAt;
    const days = Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000);
    return {
      ...l,
      lastContactAt: last,
      nextAction: l.followups[0]?.nextAction ?? null,
      nextActionDone: l.followups[0]?.nextActionDone ?? true,
      daysSinceLastContact: days,
    };
  });

  const meusLeadsOrdenados = [...meusLeadsComDias]
    .filter((l) => !["APROVADA", "PERDIDA"].includes(l.status))
    .sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 99;
      const pb = STATUS_PRIORITY[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      // Desempate: prioridade ALTA primeiro, depois mais parado
      const prioW = { ALTA: 0, MEDIA: 1, BAIXA: 2 } as Record<string, number>;
      const pDiff = (prioW[a.priority] ?? 1) - (prioW[b.priority] ?? 1);
      if (pDiff !== 0) return pDiff;
      return b.daysSinceLastContact - a.daysSinceLastContact;
    })
    .slice(0, 8);

  // Helper: % da meta
  const pct = (realizado: number, meta: number) =>
    meta > 0 ? Math.min(100, Math.round((realizado / meta) * 100)) : 0;

  const goal = goalProgress.goal;
  const realized = goalProgress.realized;
  const metaMat = goal?.metaMatricula ?? 0;
  const metaFat = goal ? Number(goal.metaFaturamento) : 0;
  const metaFol = goal?.metaFollowup ?? 0;
  const metaInd = goal?.metaIndicacao ?? 0;

  const pctMatricula = pct(realized.matriculas, metaMat);
  const pctFaturamento = pct(realized.faturamento, metaFat);
  const pctFollowup = pct(realized.followup, metaFol);

  const hasAnyGoal = metaMat > 0 || metaFat > 0 || metaFol > 0 || metaInd > 0;

  return (
    <div>
      <PageHeader
        title={`Olá${userName ? `, ${userName.split(" ")[0]}` : ""}`}
        description="Seu funil, metas e próximos contatos"
        icon={Target}
        action={
          <Button asChild>
            <Link href="/vendas/leads">
              <Plus className="mr-2 h-4 w-4" />
              Ver todos os leads
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* KPIs principais */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Leads ativos"
            value={leadsAtivos}
            icon={UserPlus}
            variant="info"
            description="No meu funil"
          />
          <StatCard
            title="Conversão (30d)"
            value={`${conversao}%`}
            icon={Target}
            variant="success"
            description="Lead → matrícula"
            trend={
              leadsConvertidosMesAnterior > 0
                ? { value: trend, label: "vs. mês anterior" }
                : undefined
            }
          />
          <StatCard
            title="Tempo médio"
            value={tempoMedio}
            icon={Clock}
            variant="warning"
            description="Lead → matrícula"
          />
          <StatCard
            title="Matrículas (mês)"
            value={leadsConvertidosMes}
            icon={CheckCircle2}
            variant="success"
            description="Aprovadas pela Recepção"
          />
          <StatCard
            title="Acionamentos hoje"
            value={todayMetrics.total}
            icon={Phone}
            variant="info"
            description="Follow-ups registrados"
          />
        </div>

        {/* Alertas — leads parados */}
        {(staleMine.length > 0 || upcomingMine.length > 0) && (
          <AlertsCard
            staleLeads={staleMine}
            upcomingCount={upcomingMine.length}
            linkHref="/vendas/leads"
          />
        )}

        {/* Metas pessoais + Próximos contatos */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* MINHA META DO MÊS */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-direta-orange" />
                    Minha Meta ·{" "}
                    {new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString(
                      "pt-BR",
                      { month: "long", year: "numeric" },
                    )}
                  </CardTitle>
                  <CardDescription>
                    {hasAnyGoal
                      ? "Acompanhe seu progresso no mês"
                      : "Você ainda não tem meta definida — peça ao administrador"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!hasAnyGoal ? (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">
                  Nenhuma meta cadastrada para você neste mês.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  {/* Matrículas */}
                  <div className="rounded-md border bg-white p-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Matrículas</span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-bold">{realized.matriculas}</span>
                      <span className="text-sm text-slate-400">
                        / {metaMat}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${
                          pctMatricula >= 100
                            ? "bg-emerald-500"
                            : pctMatricula >= 70
                              ? "bg-amber-500"
                              : "bg-slate-400"
                        }`}
                        style={{ width: `${pctMatricula}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {pctMatricula}% da meta
                    </div>
                  </div>

                  {/* Faturamento */}
                  <div className="rounded-md border bg-white p-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Faturamento</span>
                      <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-lg font-bold">
                        {formatCurrency(realized.faturamento)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      meta: {formatCurrency(metaFat)}
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${
                          pctFaturamento >= 100
                            ? "bg-emerald-500"
                            : pctFaturamento >= 70
                              ? "bg-amber-500"
                              : "bg-slate-400"
                        }`}
                        style={{ width: `${pctFaturamento}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {pctFaturamento}% da meta
                    </div>
                  </div>

                  {/* Follow-ups */}
                  <div className="rounded-md border bg-white p-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Acionamentos</span>
                      <Phone className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-bold">{realized.followup}</span>
                      <span className="text-sm text-slate-400">
                        / {metaFol}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${
                          pctFollowup >= 100
                            ? "bg-emerald-500"
                            : pctFollowup >= 70
                              ? "bg-amber-500"
                              : "bg-slate-400"
                        }`}
                        style={{ width: `${pctFollowup}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {pctFollowup}% da meta
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PRÓXIMOS CONTATOS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-blue-600" />
                Próximos Contatos
              </CardTitle>
              <CardDescription>Agendados nos próximos 7 dias</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingMine.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500">
                  Nenhum contato agendado
                </div>
              ) : (
                upcomingMine.slice(0, 5).map((f) => {
                  const isOverdue = new Date(f.nextAction!) < new Date();
                  return (
                    <Link
                      key={f.id}
                      href={`/vendas/leads/${f.lead.id}`}
                      className="flex items-center justify-between rounded-md border bg-white p-2 text-sm transition-colors hover:border-direta-orange hover:bg-orange-50/30"
                    >
                      <div className="flex-1 truncate">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-slate-900">
                            {f.lead.fullName}
                          </span>
                          {isOverdue && <Badge variant="destructive">ATRASADO</Badge>}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatDateTime(f.nextAction)}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300" />
                    </Link>
                  );
                })
              )}
              {upcomingMine.length > 5 && (
                <div className="text-center text-xs text-slate-500">
                  +{upcomingMine.length - 5} agendamentos
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Funil pessoal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meu Funil de Vendas</CardTitle>
            <CardDescription>
              Distribuição dos meus leads por etapa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {funilData.every((e) => e.quantidade === 0) ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">
                Nenhum lead atribuído a você ainda.
              </div>
            ) : (
              funilData.map((etapa) => {
                const max = Math.max(...funilData.map((e) => e.quantidade), 1);
                const pctEtapa = (etapa.quantidade / max) * 100;
                return (
                  <div key={etapa.status} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{etapa.label}</span>
                      <span className="text-slate-500">{etapa.quantidade}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${etapa.cor}`}
                        style={{ width: `${pctEtapa}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Meus leads (top 8 com dias parado + prioridade + próximo contato) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="h-4 w-4 text-red-500" />
                Meus Leads prioritários
              </CardTitle>
              <CardDescription>
                Ordenados por urgência · prioridade · dias parado
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/vendas/leads">
                Ver todos
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {meusLeadsOrdenados.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">
                Você ainda não tem leads atribuídos.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="pb-2 pr-3">Nome</th>
                      <th className="pb-2 pr-3">Prioridade</th>
                      <th className="pb-2 pr-3">Curso</th>
                      <th className="pb-2 pr-3">Status</th>
                      <th className="pb-2 pr-3">Parado há</th>
                      <th className="pb-2 pr-3">Próx. contato</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {meusLeadsOrdenados.map((lead) => {
                      const isCritical = lead.daysSinceLastContact >= 7;
                      const isStale = lead.daysSinceLastContact >= 3;
                      const nextOverdue =
                        lead.nextAction &&
                        !lead.nextActionDone &&
                        new Date(lead.nextAction) < new Date();

                      return (
                        <tr
                          key={lead.id}
                          className={`group hover:bg-slate-50 ${
                            isCritical ? "bg-red-50/30" : isStale ? "bg-amber-50/20" : ""
                          }`}
                        >
                          <td className="py-3 pr-3">
                            <div className="font-medium text-slate-800">
                              {lead.fullName}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {lead.phone ? formatPhone(lead.phone) : ""}
                            </div>
                          </td>
                          <td className="py-3 pr-3">
                            <PriorityBadge priority={lead.priority} />
                          </td>
                          <td className="py-3 pr-3 text-slate-600">
                            {lead.course?.name ?? "—"}
                          </td>
                          <td className="py-3 pr-3">
                            <StatusBadge status={lead.status} />
                          </td>
                          <td className="py-3 pr-3">
                            <Badge
                              variant={isCritical ? "destructive" : isStale ? "warning" : "neutral"}
                            >
                              {lead.daysSinceLastContact}d
                            </Badge>
                          </td>
                          <td className="py-3 pr-3 text-xs">
                            {lead.nextAction && !lead.nextActionDone ? (
                              <span
                                className={
                                  nextOverdue
                                    ? "font-semibold text-red-600"
                                    : "text-blue-600"
                                }
                              >
                                {formatDate(lead.nextAction)}
                                {nextOverdue && " ⚠️"}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <RegisterFollowupDialog
                                leadId={lead.id}
                                leadName={lead.fullName}
                                triggerLabel=""
                                triggerVariant="ghost"
                              />
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/vendas/leads/${lead.id}`}>
                                  Abrir
                                  <ArrowRight className="ml-1 h-3 w-3" />
                                </Link>
                              </Button>
                            </div>
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
      </div>
    </div>
  );
}
