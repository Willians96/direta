import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  FileText,
  TrendingUp,
  ArrowRight,
  AlertCircle,
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
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

const DOC_LABELS: Record<string, string> = {
  CPF: "CPF",
  RG: "RG",
  COMPROVANTE_RESIDENCIA: "Comp.",
  HISTORICO_ESCOLAR: "Hist.",
};

export default async function RecepcaoPage() {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // === KPIs ===
  const [pendentes, aprovadosHoje, devolvidasMes, aprovadosRecentes30d] =
    await Promise.all([
      prisma.lead.count({
        where: { status: "AGUARDANDO_ANALISE" },
      }),
      prisma.lead.count({
        where: { status: "APROVADA", updatedAt: { gte: startToday } },
      }),
      prisma.lead.count({
        where: { status: "DEVOLVIDA_AJUSTE", updatedAt: { gte: startThisMonth } },
      }),
      prisma.lead.findMany({
        where: {
          status: "APROVADA",
          updatedAt: {
            gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: { createdAt: true, updatedAt: true },
      }),
    ]);

  let tempoMedio = "—";
  if (aprovadosRecentes30d.length > 0) {
    const totalDias = aprovadosRecentes30d.reduce((acc, l) => {
      const diff =
        (l.updatedAt.getTime() - l.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return acc + diff;
    }, 0);
    tempoMedio = `${(totalDias / aprovadosRecentes30d.length).toFixed(1)} dias`;
  }

  // === Fila prioritária (até 8 leads aguardando análise) ===
  const fila = await prisma.lead.findMany({
    where: { status: "AGUARDANDO_ANALISE" },
    include: {
      course: { select: { name: true } },
      assignedTo: { select: { name: true } },
      documents: { select: { type: true } },
    },
    orderBy: { updatedAt: "asc" },
    take: 8,
  });

  // === Motivos de devolução (histórico) ===
  // Pegar últimos EnrollmentAudit com action PRE_ENROLLMENT_RETURNED
  const devolucoesAudit = await prisma.enrollmentAudit.findMany({
    where: { action: "PRE_ENROLLMENT_RETURNED" },
    select: { details: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const motivosCount: Record<string, number> = {};
  devolucoesAudit.forEach((a) => {
    const motivo = a.details || "Outros";
    motivosCount[motivo] = (motivosCount[motivo] ?? 0) + 1;
  });
  const motivosDevolucao = Object.entries(motivosCount)
    .map(([motivo, qtd]) => ({ motivo, qtd }))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Recepção · Análise Documental"
        description="Validar matrículas e efetivar no sistema"
        icon={CheckCircle2}
        action={
          <Button asChild>
            <Link href="/recepcao/fila">
              Ver fila completa
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Pendentes"
            value={pendentes}
            icon={Clock}
            variant="warning"
            description="Aguardando análise"
          />
          <StatCard
            title="Aprovadas hoje"
            value={aprovadosHoje}
            icon={CheckCircle2}
            variant="success"
            description="Decididas hoje"
          />
          <StatCard
            title="Tempo médio"
            value={tempoMedio}
            icon={TrendingUp}
            variant="info"
            description="Recebimento → aprovação (30d)"
          />
          <StatCard
            title="Devolvidas (mês)"
            value={devolvidasMes}
            icon={AlertCircle}
            variant="danger"
            description="Voltaram para Vendas"
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Fila prioritária</CardTitle>
              <CardDescription>
                Pré-matrículas aguardando sua análise
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/recepcao/fila">
                Ver fila completa
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {fila.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">
                🎉 Nenhuma pré-matrícula aguardando análise.
              </div>
            ) : (
              <div className="space-y-2">
                {fila.map((item) => {
                  const docsSet = new Set(item.documents.map((d) => d.type));
                  const obrigatorios = ["CPF", "RG", "COMPROVANTE_RESIDENCIA"];
                  const docsCompletos = obrigatorios.every((d) => docsSet.has(d as any));
                  const horasAguardo =
                    (now.getTime() - item.updatedAt.getTime()) / (1000 * 60 * 60);
                  const urgente = horasAguardo > 24;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-4 rounded-md border p-4 transition-colors hover:bg-slate-50 ${
                        urgente ? "border-l-4 border-l-amber-500" : ""
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {item.fullName}
                          </span>
                          {urgente && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                              Urgente
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-sm text-slate-500">
                          {item.course?.name ?? "—"} · vendedor:{" "}
                          {item.assignedTo?.name ?? "Não atribuído"}
                        </div>
                      </div>

                      <div className="hidden gap-1 md:flex">
                        {obrigatorios.map((docKey) => {
                          const ok = docsSet.has(docKey as any);
                          return (
                            <div
                              key={docKey}
                              className={`flex h-7 items-center gap-1 rounded px-2 text-[11px] font-medium ${
                                ok
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-100 text-slate-400"
                              }`}
                            >
                              <span>{ok ? "✓" : "○"}</span>
                              {DOC_LABELS[docKey]}
                            </div>
                          );
                        })}
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-slate-500">Recebido</div>
                        <div className="text-sm font-medium">
                          {formatDateTime(item.updatedAt)}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant={docsCompletos ? "default" : "outline"}
                          disabled={!docsCompletos}
                          asChild
                        >
                          <Link href={`/vendas/leads/${item.id}`}>
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Analisar
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Motivos de devolução (histórico)</CardTitle>
            <CardDescription>
              Análise para ações de prevenção com a equipe de vendas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {motivosDevolucao.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500">
                Nenhuma devolução registrada ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {motivosDevolucao.map((m) => {
                  const max = Math.max(...motivosDevolucao.map((x) => x.qtd), 1);
                  const pct = (m.qtd / max) * 100;
                  return (
                    <div key={m.motivo}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-slate-700">{m.motivo}</span>
                        <span className="font-semibold text-slate-900">
                          {m.qtd}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
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
