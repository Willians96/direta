import Link from "next/link";
import {
  Megaphone,
  UserPlus,
  TrendingUp,
  DollarSign,
  Plus,
  Instagram,
  Facebook,
  Globe,
  MessageCircle,
  Mail,
  Trophy,
  Flame,
  TrendingDown,
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
import { formatCurrency, formatDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { LeadStatus, LeadPriority } from "@prisma/client";

const CANAL_ICONS: Record<string, any> = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  GOOGLE_ADS: Globe,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  INDICACAO: UserPlus,
  OUTRO: Globe,
};

const CANAL_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  GOOGLE_ADS: "Google Ads",
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  INDICACAO: "Indicação",
  OUTRO: "Outro",
};

// Status do funil — agrupado em 3 zonas
const FUNIL_STATUSES: { status: LeadStatus; label: string; cor: string; zona: "topo" | "meio" | "fim" }[] = [
  { status: "NOVO", label: "Novos", cor: "bg-slate-400", zona: "topo" },
  { status: "QUALIFICADO", label: "Qualificados", cor: "bg-sky-500", zona: "topo" },
  { status: "QUARTO_CONTATO", label: "4º contato", cor: "bg-amber-500", zona: "topo" },
  { status: "PROPOSTA_ENVIADA", label: "Proposta enviada", cor: "bg-amber-500", zona: "meio" },
  { status: "EM_NEGOCIACAO", label: "Em negociação", cor: "bg-orange-500", zona: "meio" },
  { status: "AGUARDANDO_ANALISE", label: "Em análise", cor: "bg-indigo-500", zona: "meio" },
  { status: "DEVOLVIDA_AJUSTE", label: "Devolvida", cor: "bg-red-500", zona: "meio" },
  { status: "APROVADA", label: "Aprovadas", cor: "bg-emerald-500", zona: "fim" },
  { status: "PERDIDA", label: "Perdidas", cor: "bg-slate-600", zona: "fim" },
  { status: "BLOQUEIOU", label: "Bloqueou", cor: "bg-red-700", zona: "fim" },
  { status: "CONCORRENTE", label: "Concorrente", cor: "bg-purple-500", zona: "fim" },
  { status: "FIN_SEM_RENDA", label: "S/ renda", cor: "bg-pink-500", zona: "fim" },
  { status: "INATIVO", label: "Inativo", cor: "bg-slate-500", zona: "fim" },
];

export default async function CaptacaoDashboardPage() {
  const now = new Date();
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    leadsMes,
    leadsMesAnterior,
    campanhasAtivas,
    campanhas,
    leadsPorSemanaRaw,
    statusGroups,
    leadsPorPrioridade,
    leadsQuentes,
    rankingCaptadores,
    motivosPerda,
  ] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: startThisMonth } } }),
    prisma.lead.count({
      where: {
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          lt: startThisMonth,
        },
      },
    }),
    prisma.campaign.count({ where: { status: "ATIVA" } }),
    prisma.campaign.findMany({
      where: { createdBy: { role: "CAPTACAO" } },
      include: { _count: { select: { leads: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.lead.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000) } },
      select: { createdAt: true },
    }),
    prisma.lead.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["priority"],
      _count: { _all: true },
      where: { status: { notIn: ["APROVADA", "PERDIDA", "BLOQUEIOU", "CONCORRENTE", "FIN_SEM_RENDA", "INATIVO"] } },
    }),
    prisma.lead.findMany({
      where: {
        priority: "ALTA",
        status: { notIn: ["APROVADA", "PERDIDA", "BLOQUEIOU", "CONCORRENTE", "FIN_SEM_RENDA", "INATIVO"] },
      },
      include: {
        course: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.lead.groupBy({
      by: ["createdById"],
      _count: { _all: true },
      where: { createdAt: { gte: startThisMonth } },
      orderBy: { _count: { createdById: "desc" } },
      take: 5,
    }),
    prisma.lead.groupBy({
      by: ["status"],
      where: { status: { in: ["PERDIDA", "BLOQUEIOU", "CONCORRENTE", "FIN_SEM_RENDA", "INATIVO"] } },
      _count: { _all: true },
    }),
  ]);

  // === Investimento do mês ===
  const campanhasMes = await prisma.campaign.findMany({
    where: { status: { in: ["ATIVA", "PAUSADA", "ENCERRADA"] } },
    select: { budget: true, createdAt: true },
  });
  const investimentoMes = campanhasMes.reduce((acc, c) => {
    if (c.createdAt < startThisMonth) return acc;
    return acc + Number(c.budget ?? 0);
  }, 0);

  // === Conversão ===
  const [totalLeads, leadsAtribuidos] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { assignedToId: { not: null } } }),
  ]);
  const conversao =
    totalLeads > 0
      ? Number(((leadsAtribuidos / totalLeads) * 100).toFixed(1))
      : 0;

  // === Tendência ===
  const trendLeads = leadsMesAnterior > 0
    ? Number((((leadsMes - leadsMesAnterior) / leadsMesAnterior) * 100).toFixed(1))
    : 0;

  // === Leads por semana (8 semanas) ===
  const semanas: { label: string; valor: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const inicio = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const fim = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    semanas.push({
      label: `S${8 - i}`,
      valor: leadsPorSemanaRaw.filter(
        (l) => l.createdAt >= inicio && l.createdAt < fim
      ).length,
    });
  }

  // === Funil agrupado por zona ===
  const funilPorZona = FUNIL_STATUSES.reduce<Record<string, typeof FUNIL_STATUSES[number][]>>((acc, s) => {
    if (!acc[s.zona]) acc[s.zona] = [];
    acc[s.zona].push(s);
    return acc;
  }, {});

  const statusCount = (status: LeadStatus) =>
    statusGroups.find((g) => g.status === status)?._count._all ?? 0;

  const totalAtivos = statusGroups
    .filter((g) => !["APROVADA", "PERDIDA", "BLOQUEIOU", "CONCORRENTE", "FIN_SEM_RENDA", "INATIVO"].includes(g.status))
    .reduce((acc, g) => acc + g._count._all, 0);

  // === Captadores: pegar nomes dos users ===
  const captadorIds = rankingCaptadores.map((r) => r.createdById);
  const captadores = await prisma.user.findMany({
    where: { id: { in: captadorIds } },
    select: { id: true, name: true, role: true },
  });
  const captadorById = new Map(captadores.map((c) => [c.id, c.name]));

  // === Prioridade: distribuição ===
  const prioCount = (p: LeadPriority) =>
    leadsPorPrioridade.find((g) => g.priority === p)?._count._all ?? 0;

  return (
    <div>
      <PageHeader
        title="Captação"
        description="Geração de demanda · leads no topo do funil"
        icon={Megaphone}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/captacao/campanhas">
                <Plus className="mr-2 h-4 w-4" />
                Campanhas
              </Link>
            </Button>
            <Button asChild>
              <Link href="/captacao/leads">
                <Plus className="mr-2 h-4 w-4" />
                Novo lead
              </Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* KPIs principais */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Leads gerados (mês)"
            value={leadsMes}
            icon={UserPlus}
            variant="info"
            description="Criados neste mês"
            trend={leadsMesAnterior > 0 ? { value: trendLeads, label: "vs. mês anterior" } : undefined}
          />
          <StatCard
            title="Campanhas ativas"
            value={campanhasAtivas}
            icon={Megaphone}
            variant="default"
          />
          <StatCard
            title="Investimento (mês)"
            value={formatCurrency(investimentoMes)}
            icon={DollarSign}
            variant="warning"
            description="Soma das budgets criadas no mês"
          />
          <StatCard
            title="Conversão para venda"
            value={`${conversao}%`}
            icon={TrendingUp}
            variant="success"
            description="Leads atribuídos / total"
          />
        </div>

        {/* Leads por semana */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads por semana</CardTitle>
            <CardDescription>
              Volume de leads captados nas últimas 8 semanas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-end gap-2">
              {semanas.map((s, i) => {
                const max = Math.max(...semanas.map((x) => x.valor), 1);
                const h = (s.valor / max) * 100;
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="text-[10px] font-medium text-slate-500">
                      {s.valor}
                    </div>
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-blue-500 to-blue-400 transition-all hover:from-blue-600 hover:to-blue-500"
                      style={{ height: `${h}%` }}
                    />
                    <div className="text-[10px] text-slate-400">{s.label}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Funil expandido */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Funil completo de status</CardTitle>
              <CardDescription>
                {totalAtivos} leads ativos no momento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(["topo", "meio", "fim"] as const).map((zona) => (
                <div key={zona}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {zona === "topo" && "🟢 Topo do funil"}
                    {zona === "meio" && "🟡 Meio do funil"}
                    {zona === "fim" && "🔴 Fim do funil"}
                  </div>
                  <div className="space-y-2">
                    {funilPorZona[zona].map((s) => {
                      const count = statusCount(s.status);
                      const max = Math.max(
                        ...FUNIL_STATUSES.map((x) => statusCount(x.status)),
                        1
                      );
                      const pct = (count / max) * 100;
                      return (
                        <div key={s.status} className="flex items-center gap-3">
                          <div className="w-32 truncate text-xs text-slate-600">
                            {s.label}
                          </div>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full ${s.cor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="w-8 text-right text-sm font-medium">
                            {count}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Ranking de captadores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-amber-500" />
                Ranking de Captadores
              </CardTitle>
              <CardDescription>Top 5 do mês</CardDescription>
            </CardHeader>
            <CardContent>
              {rankingCaptadores.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500">
                  Sem leads cadastrados no mês
                </div>
              ) : (
                <div className="space-y-2">
                  {rankingCaptadores.map((r, i) => {
                    const medals = ["🥇", "🥈", "🥉"];
                    const medal = medals[i] ?? `#${i + 1}`;
                    return (
                      <div
                        key={r.createdById}
                        className="flex items-center justify-between rounded-md border bg-white p-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{medal}</span>
                          <span className="text-sm font-medium">
                            {captadorById.get(r.createdById) ?? "Usuário removido"}
                          </span>
                        </div>
                        <Badge variant={i === 0 ? "warning" : "secondary"}>
                          {r._count._all} leads
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Leads quentes (alta prioridade) */}
          <Card className={leadsQuentes.length > 0 ? "border-red-300" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="h-4 w-4 text-red-500" />
                Leads Quentes ({prioCount("ALTA")})
              </CardTitle>
              <CardDescription>
                Prioridade ALTA — foco da equipe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {leadsQuentes.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500">
                  Nenhum lead com prioridade alta no momento
                </div>
              ) : (
                leadsQuentes.map((l) => (
                  <Link
                    key={l.id}
                    href={`/vendas/leads/${l.id}`}
                    className="flex items-center justify-between rounded-md border bg-white p-3 transition-colors hover:border-direta-orange hover:bg-orange-50/30"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{l.fullName}</div>
                      <div className="text-xs text-slate-500">
                        {l.course?.name ?? "Sem curso"} · {l.assignedTo?.name ?? "Sem vendedor"}
                      </div>
                    </div>
                    <Badge variant="destructive">ALTA</Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* Motivos de perda (status negativos) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingDown className="h-4 w-4 text-slate-500" />
                Motivos de perda
              </CardTitle>
              <CardDescription>
                Onde os leads estão caindo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {motivosPerda.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500">
                  Nenhuma perda registrada ainda
                </div>
              ) : (
                motivosPerda.map((m) => {
                  const config = FUNIL_STATUSES.find((s) => s.status === m.status);
                  const total = motivosPerda.reduce((acc, x) => acc + x._count._all, 0);
                  const pct = total > 0 ? ((m._count._all / total) * 100).toFixed(0) : 0;
                  return (
                    <div key={m.status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{config?.label ?? m.status}</span>
                        <span className="text-slate-500">
                          {m._count._all} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full ${config?.cor ?? "bg-slate-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Campanhas (tabela resumida) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Performance das campanhas</CardTitle>
              <CardDescription>
                Leads gerados, custo e ROI estimado
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/captacao/campanhas">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {campanhas.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">
                Nenhuma campanha cadastrada ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="pb-2 pr-4">Campanha</th>
                      <th className="pb-2 pr-4">Canal</th>
                      <th className="pb-2 pr-4">Leads</th>
                      <th className="pb-2 pr-4">Investimento</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Período</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {campanhas.map((c) => {
                      const Icon = CANAL_ICONS[c.channel] ?? Globe;
                      return (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="py-3 pr-4">
                            <span className="font-medium text-slate-800">{c.name}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2 text-slate-600">
                              <Icon className="h-4 w-4" />
                              {CANAL_LABELS[c.channel]}
                            </div>
                          </td>
                          <td className="py-3 pr-4 font-semibold text-slate-800">
                            {c._count.leads}
                          </td>
                          <td className="py-3 pr-4 text-slate-600">
                            {formatCurrency(Number(c.budget ?? 0))}
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                c.status === "ATIVA"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : c.status === "PAUSADA"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-xs text-slate-500">
                            {formatDate(c.startDate)}
                            {c.endDate ? ` → ${formatDate(c.endDate)}` : ""}
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
