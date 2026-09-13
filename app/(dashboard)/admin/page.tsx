import {
  Users,
  GraduationCap,
  Target,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";

// Força renderização em runtime (sem isso, Vercel tenta SSG no build e falha sem DATABASE_URL)
export const dynamic = "force-dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

// Mapeamento LeadStatus → etapa do funil exibida
const FUNIL_STAGES = [
  { status: "NOVO", label: "Novos", cor: "bg-slate-400" },
  { status: "QUALIFICADO", label: "Qualificados", cor: "bg-sky-500" },
  { status: "PROPOSTA_ENVIADA", label: "Proposta", cor: "bg-amber-500" },
  { status: "EM_NEGOCIACAO", label: "Em negociação", cor: "bg-orange-500" },
  { status: "AGUARDANDO_ANALISE", label: "Em análise", cor: "bg-indigo-500" },
  { status: "APROVADA", label: "Aprovados", cor: "bg-emerald-500" },
] as const;

// Tradução AuditAction → label amigável
const AUDIT_LABELS: Record<string, string> = {
  LEAD_CREATED: "criou lead",
  LEAD_ASSIGNED: "atribuiu lead",
  LEAD_STATUS_CHANGED: "mudou status",
  PRE_ENROLLMENT_SUBMITTED: "enviou pré-matrícula",
  PRE_ENROLLMENT_APPROVED: "aprovou matrícula",
  PRE_ENROLLMENT_RETURNED: "devolveu para ajuste",
  USER_CREATED: "cadastrou usuário",
  USER_DEACTIVATED: "desativou usuário",
  DOCUMENT_UPLOADED: "enviou documento",
};

export default async function AdminDashboardPage() {
  // Período: mês atual vs mês anterior
  const now = new Date();
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const start9MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 8, 1);

  // === KPIs principais ===
  const [
    leadsNoFunil,
    matriculasMes,
    matriculasMesAnterior,
    cursosAtivos,
    totalLeadsHistorico,
    totalAprovadosHistorico,
  ] = await Promise.all([
    prisma.lead.count({
      where: { status: { notIn: ["APROVADA", "PERDIDA"] } },
    }),
    prisma.lead.count({
      where: { status: "APROVADA", updatedAt: { gte: startThisMonth } },
    }),
    prisma.lead.count({
      where: {
        status: "APROVADA",
        updatedAt: { gte: startPrevMonth, lt: startThisMonth },
      },
    }),
    prisma.course.count({ where: { status: "ATIVO" } }),
    prisma.lead.count(),
    prisma.lead.count({ where: { status: "APROVADA" } }),
  ]);

  const conversao =
    totalLeadsHistorico > 0
      ? Number(((totalAprovadosHistorico / totalLeadsHistorico) * 100).toFixed(1))
      : 0;

  const leadsTrend =
    matriculasMesAnterior > 0
      ? Number(
          (
            ((matriculasMes - matriculasMesAnterior) / matriculasMesAnterior) *
            100
          ).toFixed(1)
        )
      : 0;

  // === Funil de vendas ===
  const funilGroups = await prisma.lead.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const funilData = FUNIL_STAGES.map((s) => ({
    ...s,
    quantidade: funilGroups.find((g) => g.status === s.status)?._count._all ?? 0,
  }));

  // === Evolução mensal (últimos 9 meses) ===
  const leadsRecentes = await prisma.lead.findMany({
    where: { createdAt: { gte: start9MonthsAgo } },
    select: { createdAt: true, status: true, updatedAt: true },
  });

  const meses: { key: string; label: string; leads: number; matriculas: number }[] = [];
  for (let i = 8; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prox = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    meses.push({
      key: `${ref.getFullYear()}-${ref.getMonth()}`,
      label: ref.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      leads: leadsRecentes.filter((l) => l.createdAt >= ref && l.createdAt < prox).length,
      matriculas: leadsRecentes.filter(
        (l) =>
          l.status === "APROVADA" &&
          l.updatedAt >= ref &&
          l.updatedAt < prox
      ).length,
    });
  }

  // === Atividade recente (últimos 5 audits) ===
  const auditsRecentes = await prisma.enrollmentAudit.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true, role: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Visão Geral"
        description="Consolidação geral do módulo comercial — todos os perfis"
        icon={Target}
        action={
          <Button variant="outline">
            Exportar relatório
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </Button>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* KPIs principais */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Leads no funil"
            value={leadsNoFunil}
            icon={Users}
            variant="info"
            description="Pipeline ativo (exclui perdidos)"
          />
          <StatCard
            title="Matrículas no mês"
            value={matriculasMes}
            icon={CheckCircle2}
            variant="success"
            trend={{
              value: leadsTrend,
              label: "vs. mês anterior",
            }}
          />
          <StatCard
            title="Taxa de conversão"
            value={`${conversao}%`}
            icon={Target}
            variant="default"
            description="Lead → matrícula (histórico)"
          />
          <StatCard
            title="Cursos ativos"
            value={cursosAtivos}
            icon={GraduationCap}
            variant="warning"
            description="Disponíveis para matrícula"
          />
        </div>

        {/* Funil + Evolução */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funil de Vendas</CardTitle>
              <CardDescription>
                Distribuição de leads por etapa do processo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {funilData.map((etapa) => {
                const max = Math.max(...funilData.map((e) => e.quantidade), 1);
                const pct = (etapa.quantidade / max) * 100;
                return (
                  <div key={etapa.status} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{etapa.label}</span>
                      <span className="text-slate-500">{etapa.quantidade}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${etapa.cor} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução mensal</CardTitle>
              <CardDescription>
                Leads captados vs. matrículas efetivadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-56 items-end gap-2">
                {meses.map((d) => {
                  const maxLead = Math.max(...meses.map((x) => x.leads), 1);
                  const maxMat = Math.max(...meses.map((x) => x.matriculas), 1);
                  const leadH = (d.leads / maxLead) * 100;
                  const matH = (d.matriculas / maxMat) * 100;
                  return (
                    <div
                      key={d.key}
                      className="group flex flex-1 flex-col items-center gap-1"
                    >
                      <div className="flex h-full w-full items-end justify-center gap-1">
                        <div
                          className="w-3 rounded-t bg-sky-400 transition-all group-hover:bg-sky-500"
                          style={{ height: `${leadH}%` }}
                          title={`${d.leads} leads`}
                        />
                        <div
                          className="w-3 rounded-t bg-emerald-500 transition-all group-hover:bg-emerald-600"
                          style={{ height: `${matH}%` }}
                          title={`${d.matriculas} matrículas`}
                        />
                      </div>
                      <div className="text-[10px] font-medium text-slate-500">
                        {d.label}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                  <span className="text-slate-600">Leads</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-slate-600">Matrículas</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Atividade recente */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Atividade recente</CardTitle>
              <CardDescription>
                Últimas movimentações no sistema
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm">
              Ver tudo
            </Button>
          </CardHeader>
          <CardContent>
            {auditsRecentes.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">
                Nenhuma atividade registrada ainda.
                <br />
                <span className="text-xs">
                  Ações de aprovação, devolução e mudanças de status aparecem aqui.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {auditsRecentes.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1 text-sm">
                      <span className="font-medium">{item.actor.name}</span>{" "}
                      <span className="text-slate-500">
                        {AUDIT_LABELS[item.action] ?? item.action.toLowerCase()}
                      </span>
                      {item.details && (
                        <>
                          {" "}
                          <span className="font-medium">{item.details}</span>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatDateTime(item.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
