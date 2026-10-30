import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Users,
  GraduationCap,
  DollarSign,
  Percent,
  TrendingUp,
  Clock,
  Megaphone,
  Download,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { auth } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import {
  getReportData,
  getReportOptions,
  PERIODOS,
  monthLabel,
  type ReportFilters,
} from "@/lib/reports";

export const dynamic = "force-dynamic";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default async function AdminRelatoriosPage({
  searchParams,
}: {
  searchParams: {
    periodo?: string;
    mes?: string;
    ano?: string;
    vendedorId?: string;
    courseId?: string;
    campaignId?: string;
  };
}) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") redirect("/");

  const filters: ReportFilters = {
    periodo: searchParams.periodo,
    mes: searchParams.mes,
    ano: searchParams.ano,
    vendedorId: searchParams.vendedorId,
    courseId: searchParams.courseId,
    campaignId: searchParams.campaignId,
  };

  const [data, options] = await Promise.all([getReportData(filters), getReportOptions()]);

  const now = new Date();
  const mesSel = Number(searchParams.mes) || now.getMonth() + 1;
  const anoSel = Number(searchParams.ano) || now.getFullYear();

  // querystring corrente para manter os filtros no link de exportação
  const qs = new URLSearchParams();
  if (searchParams.periodo) qs.set("periodo", searchParams.periodo);
  if (searchParams.mes) qs.set("mes", searchParams.mes);
  if (searchParams.ano) qs.set("ano", searchParams.ano);
  if (searchParams.vendedorId) qs.set("vendedorId", searchParams.vendedorId);
  if (searchParams.courseId) qs.set("courseId", searchParams.courseId);
  if (searchParams.campaignId) qs.set("campaignId", searchParams.campaignId);
  const exportHref = `/api/reports/export?${qs.toString()}`;

  const { kpis } = data;

  return (
    <div>
      <PageHeader
        title="Relatórios da Direção"
        description={`Resultado consolidado — ${data.period.label}`}
        icon={BarChart3}
        action={
          <Button variant="outline" asChild>
            <a href={exportHref}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </a>
          </Button>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <form className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Período</label>
                <select
                  name="periodo"
                  defaultValue={searchParams.periodo || "mes"}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  {PERIODOS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Mês</label>
                <select
                  name="mes"
                  defaultValue={String(mesSel)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  {MESES.map((m, i) => (
                    <option key={i} value={String(i + 1)}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Ano</label>
                <input
                  name="ano"
                  type="number"
                  defaultValue={anoSel}
                  min="2020"
                  max="2100"
                  className="h-9 w-24 rounded-md border border-slate-200 bg-white px-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Vendedor</label>
                <select
                  name="vendedorId"
                  defaultValue={searchParams.vendedorId || ""}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="">Todos</option>
                  {options.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Curso</label>
                <select
                  name="courseId"
                  defaultValue={searchParams.courseId || ""}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="">Todos</option>
                  {options.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Campanha</label>
                <select
                  name="campaignId"
                  defaultValue={searchParams.campaignId || ""}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="">Todas</option>
                  {options.campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="h-9 rounded-md border border-slate-200 bg-slate-50 px-4 text-sm hover:bg-slate-100"
              >
                Aplicar
              </button>

              {qs.toString() && (
                <Link
                  href="/admin/relatorios"
                  className="h-9 px-2 text-sm leading-9 text-direta-orange hover:underline"
                >
                  Limpar filtros
                </Link>
              )}
            </form>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            icon={Users}
            titulo="Leads no período"
            valor={kpis.leads}
            auxiliar="Novos leads cadastrados"
          />
          <StatCard
            icon={GraduationCap}
            titulo="Matrículas"
            valor={kpis.matriculas}
            auxiliar={`${kpis.conversao.toFixed(1)}% de conversão`}
          />
          <StatCard
            icon={DollarSign}
            titulo="Receita"
            valor={formatCurrency(kpis.receita)}
            auxiliar={`Ticket médio ${formatCurrency(kpis.ticketMedio)}`}
          />
          <StatCard
            icon={TrendingUp}
            titulo="Acionamentos"
            valor={kpis.followups}
            auxiliar="Follow-ups registrados"
          />
          <StatCard
            icon={Percent}
            titulo="Conversão"
            valor={`${kpis.conversao.toFixed(1)}%`}
            auxiliar="Matrícula ÷ leads"
          />
          <StatCard
            icon={Clock}
            titulo="Tempo de fechamento"
            valor={kpis.tempoMedioFechamento !== null ? `${kpis.tempoMedioFechamento} dias` : "—"}
            auxiliar="Do cadastro à matrícula"
          />
        </div>

        {/* Meta x realizado por vendedor */}
        <Card>
          <CardHeader>
            <CardTitle>Meta x realizado por vendedor</CardTitle>
            <CardDescription>
              Comparativo das metas cadastradas com o resultado do período
              {data.period.months.length > 1
                ? ` (${data.period.months.length} meses somados)`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Matrículas</TableHead>
                    <TableHead>Faturamento</TableHead>
                    <TableHead>Acionamentos</TableHead>
                    <TableHead className="text-right">Atingimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.porVendedor.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500">
                        Sem dados no período selecionado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.porVendedor.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <div className="font-medium">{v.nome}</div>
                          <Badge variant="neutral" className="mt-0.5">
                            {v.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{v.leads}</TableCell>
                        <TableCell>
                          <MetaCell real={v.matriculas} meta={v.metaMatricula} />
                        </TableCell>
                        <TableCell>
                          <MetaCell
                            real={v.receita}
                            meta={v.metaFaturamento}
                            format="currency"
                          />
                        </TableCell>
                        <TableCell>
                          <MetaCell real={v.followups} meta={v.metaFollowup} />
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-semibold ${
                              v.atingimentoMatricula >= 100
                                ? "text-emerald-600"
                                : v.atingimentoMatricula >= 70
                                ? "text-amber-600"
                                : "text-red-600"
                            }`}
                          >
                            {v.atingimentoMatricula.toFixed(0)}%
                          </span>
                          <div className="text-xs text-slate-400">das matrículas</div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Investimento x resultado por campanha */}
        <Card>
          <CardHeader>
            <CardTitle>Campanhas — investimento x resultado</CardTitle>
            <CardDescription>
              Quanto foi investido em cada campanha e o que ela devolveu
              {kpis.orcamentoCampanhas > 0
                ? ` — investimento total no período: ${formatCurrency(kpis.orcamentoCampanhas)}`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Orçamento</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Matrículas</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Custo/matrícula</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.porCampanha.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-slate-500">
                        Nenhuma campanha com leads no período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.porCampanha.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="font-medium">{c.nome}</div>
                          <div className="text-xs text-slate-500">{c.status}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{c.canal}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {c.orcamento ? formatCurrency(c.orcamento) : "—"}
                        </TableCell>
                        <TableCell className="text-right">{c.leads}</TableCell>
                        <TableCell className="text-right">{c.matriculas}</TableCell>
                        <TableCell className="text-right">
                          {c.conversao.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(c.receita)}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.custoPorMatricula !== null ? (
                            <span
                              className={
                                c.custoPorMatricula <= c.receita / Math.max(1, c.matriculas)
                                  ? "text-emerald-600"
                                  : "text-red-600"
                              }
                            >
                              {formatCurrency(c.custoPorMatricula)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Resultado por curso */}
        <Card>
          <CardHeader>
            <CardTitle>Resultado por curso</CardTitle>
            <CardDescription>Volume, conversão e receita de cada curso</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Curso</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Matrículas</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Ticket médio</TableHead>
                    <TableHead className="w-40">Participação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.porCurso.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-slate-500">
                        Sem dados no período selecionado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.porCurso.map((c) => {
                      const max = Math.max(
                        ...data.porCurso.map((x) => x.matriculas),
                        1
                      );
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell className="text-right">{c.leads}</TableCell>
                          <TableCell className="text-right">{c.matriculas}</TableCell>
                          <TableCell className="text-right">
                            {c.conversao.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(c.receita)}
                          </TableCell>
                          <TableCell className="text-right">
                            {c.ticket ? formatCurrency(c.ticket) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full bg-direta-orange"
                                style={{ width: `${(c.matriculas / max) * 100}%` }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Origem dos leads + evolução mensal */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Origem dos leads</CardTitle>
              <CardDescription>De onde vieram os clientes e quanto converteram</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Origem</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Matrículas</TableHead>
                      <TableHead className="text-right">Conversão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.porOrigem.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-slate-500">
                          Sem leads no período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.porOrigem.map((o) => (
                        <TableRow key={o.fonte}>
                          <TableCell className="font-medium">{o.fonte}</TableCell>
                          <TableCell className="text-right">{o.leads}</TableCell>
                          <TableCell className="text-right">{o.matriculas}</TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                o.conversao >= 30
                                  ? "text-emerald-600"
                                  : o.conversao >= 10
                                  ? "text-amber-600"
                                  : "text-slate-600"
                              }
                            >
                              {o.conversao.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evolução no período</CardTitle>
              <CardDescription>Leads e matrículas por mês</CardDescription>
            </CardHeader>
            <CardContent>
              {data.serie.length === 0 ? (
                <p className="text-sm text-slate-500">Sem dados no período.</p>
              ) : (
                <div className="space-y-3">
                  {data.serie.map((m) => {
                    const max = Math.max(...data.serie.map((x) => x.leads), 1);
                    return (
                      <div key={`${m.year}-${m.month}`}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">
                            {m.label}/{m.year}
                          </span>
                          <span className="text-slate-500">
                            {m.leads} leads · {m.matriculas} matrículas ·{" "}
                            {formatCurrency(m.receita)}
                          </span>
                        </div>
                        <div className="mt-1 space-y-1">
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full bg-slate-300"
                              style={{ width: `${(m.leads / max) * 100}%` }}
                            />
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full bg-direta-orange"
                              style={{
                                width: `${(m.matriculas / Math.max(max, 1)) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <p className="pt-1 text-xs text-slate-500">
                    <span className="mr-3 inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
                      leads
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-direta-orange" />
                      matrículas
                    </span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-slate-500">
          Período analisado: {data.period.from.toLocaleDateString("pt-BR")} até{" "}
          {data.period.to.toLocaleDateString("pt-BR")} ·{" "}
          {monthLabel(data.period.months[0].month, data.period.months[0].year)}
          {data.period.months.length > 1 &&
            ` a ${monthLabel(
              data.period.months[data.period.months.length - 1].month,
              data.period.months[data.period.months.length - 1].year
            )}`}
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  titulo,
  valor,
  auxiliar,
}: {
  icon: any;
  titulo: string;
  valor: string | number;
  auxiliar: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
          <Icon className="h-4 w-4" />
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{valor}</p>
        <p className="text-xs text-slate-500">{auxiliar}</p>
      </CardContent>
    </Card>
  );
}

function MetaCell({
  real,
  meta,
  format = "number",
}: {
  real: number;
  meta: number;
  format?: "number" | "currency";
}) {
  if (!meta) {
    return (
      <div className="text-sm">
        <span className="font-medium">{format === "currency" ? formatCurrency(real) : real}</span>
        <span className="text-xs text-slate-400"> / sem meta</span>
      </div>
    );
  }
  const pct = Math.min(100, Math.round((real / meta) * 100));
  const color =
    pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="text-sm">
        <span className="font-medium">
          {format === "currency" ? formatCurrency(real) : real}
        </span>
        <span className="text-xs text-slate-400">
          {" "}
          / {format === "currency" ? formatCurrency(meta) : meta}
        </span>
      </div>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
