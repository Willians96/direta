import Link from "next/link";
import {
  Target,
  Clock,
  CheckCircle2,
  Plus,
  ArrowRight,
  UserPlus,
} from "lucide-react";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatDate, formatPhone } from "@/lib/utils";

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
  EM_NEGOCIACAO: 2,
  DEVOLVIDA_AJUSTE: 3,
  PROPOSTA_ENVIADA: 4,
  QUALIFICADO: 5,
  NOVO: 6,
};

export default async function VendasDashboardPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string;

  const now = new Date();
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const start30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // === KPIs ===
  const [
    leadsAtivos,
    leadsConvertidosMes,
    leadsConvertidosMesAnterior,
    meusLeads,
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
      include: { course: { select: { name: true } } },
    }),
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

  // Tempo médio: lead.createdAt → updatedAt dos aprovados (proxy da decisão)
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

  // === Funil pessoal ===
  const funilGroups = await prisma.lead.groupBy({
    by: ["status"],
    where: { assignedToId: userId },
    _count: { _all: true },
  });
  const funilData = FUNIL_STAGES.map((s) => ({
    ...s,
    quantidade: funilGroups.find((g) => g.status === s.status)?._count._all ?? 0,
  }));

  // === Meus leads (top 5 mais urgentes/recentes) ===
  const meusLeadsOrdenados = [...meusLeads]
    .filter((l) => !["APROVADA", "PERDIDA"].includes(l.status))
    .sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 99;
      const pb = STATUS_PRIORITY[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    })
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Meu Funil"
        description="Acompanhe seus leads e avance para a matrícula"
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                const pct = (etapa.quantidade / max) * 100;
                return (
                  <div key={etapa.status} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        {etapa.label}
                      </span>
                      <span className="text-slate-500">{etapa.quantidade}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${etapa.cor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Meus leads (top 5) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Leads atribuídos a mim</CardTitle>
              <CardDescription>
                Ordenados por urgência — clique para abrir
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
                      <th className="pb-2 pr-4">Nome</th>
                      <th className="pb-2 pr-4">Curso</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Último contato</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {meusLeadsOrdenados.map((lead) => {
                      const urgente =
                        lead.status === "DEVOLVIDA_AJUSTE" ||
                        lead.status === "AGUARDANDO_ANALISE";
                      return (
                        <tr key={lead.id} className="group hover:bg-slate-50">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              {urgente && (
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              )}
                              <span className="font-medium text-slate-800">
                                {lead.fullName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-slate-600">
                            {lead.course?.name ?? "—"}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge status={lead.status} />
                          </td>
                          <td className="py-3 pr-4 text-slate-500">
                            {formatDate(lead.updatedAt)}
                          </td>
                          <td className="py-3 text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/vendas/leads/${lead.id}`}>
                                Abrir
                                <ArrowRight className="ml-1 h-3 w-3" />
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
      </div>
    </div>
  );
}
