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
  UserPlus as IndicacaoIcon,
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
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import type { CampaignChannel } from "@prisma/client";

const CANAL_ICONS: Record<string, any> = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  GOOGLE_ADS: Globe,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  INDICACAO: IndicacaoIcon,
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

import { Mail } from "lucide-react";

export default async function CaptacaoDashboardPage() {
  const now = new Date();
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [leadsMes, campanhasAtivas, campanhas, leadsPorSemanaRaw] =
    await Promise.all([
      prisma.lead.count({ where: { createdAt: { gte: startThisMonth } } }),
      prisma.campaign.count({ where: { status: "ATIVA" } }),
      prisma.campaign.findMany({
        where: { createdBy: { role: "CAPTACAO" } },
        include: { _count: { select: { leads: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.lead.findMany({
        where: { createdAt: { gte: new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000) } },
        select: { createdAt: true },
      }),
    ]);

  // === Investimento total do mês ===
  const campanhasMes = await prisma.campaign.findMany({
    where: { status: { in: ["ATIVA", "PAUSADA", "ENCERRADA"] } },
    select: { budget: true, createdAt: true },
  });
  const investimentoMes = campanhasMes.reduce((acc, c) => {
    if (c.createdAt < startThisMonth) return acc;
    return acc + Number(c.budget ?? 0);
  }, 0);

  // === Conversão para venda: leads atribuídos / leads totais (histórico) ===
  const [totalLeads, leadsAtribuidos] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { assignedToId: { not: null } } }),
  ]);
  const conversao =
    totalLeads > 0
      ? Number(((leadsAtribuidos / totalLeads) * 100).toFixed(1))
      : 0;

  // === Leads por semana (últimas 8 semanas) ===
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Leads gerados (mês)"
            value={leadsMes}
            icon={UserPlus}
            variant="info"
            description="Criados neste mês"
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
                            <span className="font-medium text-slate-800">
                              {c.name}
                            </span>
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
