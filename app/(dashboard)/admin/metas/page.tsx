import { redirect } from "next/navigation";
import { Target, TrendingUp, Users, DollarSign } from "lucide-react";
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
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getGoalProgress } from "@/lib/actions/goals";
import { GoalFormDialog } from "./goal-form-dialog";

export const dynamic = "force-dynamic";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default async function AdminMetasPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string };
}) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") redirect("/");

  const now = new Date();
  const month = Number(searchParams.mes) || now.getMonth() + 1;
  const year = Number(searchParams.ano) || now.getFullYear();

  // Buscar todos os vendedores (VENDAS, CAPTACAO, ADMIN)
  const sellers = await prisma.user.findMany({
    where: {
      role: { in: ["VENDAS", "CAPTACAO", "ADMIN"] },
      status: "ATIVO",
    },
    orderBy: { name: "asc" },
  });

  // Buscar metas do mês e calcular realizado
  const goals = await prisma.goal.findMany({
    where: { month, year },
  });

  const goalByUser = new Map(goals.map((g) => [g.userId, g]));

  // Calcular realizado para cada vendedor (incluindo quem não tem meta)
  const rows = await Promise.all(
    sellers.map(async (seller) => {
      const progress = await getGoalProgress(seller.id, month, year);
      return {
        seller,
        goal: progress.goal,
        realized: progress.realized,
      };
    })
  );

  // KPIs agregados
  const totalMatriculasMeta = rows.reduce(
    (acc, r) => acc + (r.goal?.metaMatricula ?? 0),
    0
  );
  const totalFaturamentoMeta = rows.reduce(
    (acc, r) => acc + Number(r.goal?.metaFaturamento ?? 0),
    0
  );
  const totalAcionamentosMeta = rows.reduce(
    (acc, r) => acc + (r.goal?.metaFollowup ?? 0),
    0
  );
  const totalMatriculasReal = rows.reduce(
    (acc, r) => acc + r.realized.matriculas,
    0
  );
  const totalFaturamentoReal = rows.reduce(
    (acc, r) => acc + r.realized.faturamento,
    0
  );
  const totalAcionamentosReal = rows.reduce(
    (acc, r) => acc + r.realized.followup,
    0
  );

  return (
    <div>
      <PageHeader
        title="Metas Mensais"
        description={`Definir e acompanhar metas de cada vendedor — ${MONTHS[month - 1]}/${year}`}
        icon={Target}
        action={
          <GoalFormDialog
            sellers={sellers.map((s) => ({ ...s, role: s.role }))}
            defaultMonth={month}
            defaultYear={year}
          />
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* Seletor de mês/ano */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-sm font-medium text-slate-600">Período:</span>
            <form className="flex items-center gap-2">
              <select
                name="mes"
                defaultValue={String(month)}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                name="ano"
                type="number"
                defaultValue={year}
                min="2020"
                max="2100"
                className="h-9 w-24 rounded-md border border-slate-200 bg-white px-2 text-sm"
              />
              <button
                type="submit"
                className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm hover:bg-slate-100"
              >
                Ver
              </button>
            </form>
            <div className="ml-auto text-xs text-slate-500">
              Atualizado: {formatDate(new Date())}
            </div>
          </CardContent>
        </Card>

        {/* KPIs agregados */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Matrículas (time)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {totalMatriculasReal}
                <span className="text-base text-slate-400">
                  {" "}/ {totalMatriculasMeta}
                </span>
              </p>
              <ProgressBar
                value={totalMatriculasReal}
                target={totalMatriculasMeta}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                Faturamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency(totalFaturamentoReal)}
                <span className="text-sm text-slate-400">
                  {" "}/ {formatCurrency(totalFaturamentoMeta)}
                </span>
              </p>
              <ProgressBar
                value={totalFaturamentoReal}
                target={totalFaturamentoMeta}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" />
                Acionamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {totalAcionamentosReal}
                <span className="text-base text-slate-400">
                  {" "}/ {totalAcionamentosMeta}
                </span>
              </p>
              <ProgressBar
                value={totalAcionamentosReal}
                target={totalAcionamentosMeta}
              />
            </CardContent>
          </Card>
        </div>

        {/* Tabela por vendedor */}
        <Card>
          <CardHeader>
            <CardTitle>Metas por vendedor</CardTitle>
            <CardDescription>
              Comparativo meta vs realizado em {MONTHS[month - 1]}/{year}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Matrículas</TableHead>
                  <TableHead>Faturamento</TableHead>
                  <TableHead>Acionamentos</TableHead>
                  <TableHead>Indicações</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500">
                      Nenhum vendedor ativo.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(({ seller, goal, realized }) => {
                    const metaMat = goal?.metaMatricula ?? 0;
                    const metaFat = Number(goal?.metaFaturamento ?? 0);
                    const metaFol = goal?.metaFollowup ?? 0;
                    const metaInd = goal?.metaIndicacao ?? 0;

                    return (
                      <TableRow key={seller.id}>
                        <TableCell>
                          <div className="font-medium">{seller.name}</div>
                          <div className="text-xs text-slate-500">
                            {seller.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="neutral">{seller.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {goal ? (
                            <GoalCell
                              real={realized.matriculas}
                              target={metaMat}
                            />
                          ) : (
                            <span className="text-xs text-slate-400">
                              Sem meta
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {goal ? (
                            <GoalCell
                              real={realized.faturamento}
                              target={metaFat}
                              format="currency"
                            />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {goal ? (
                            <GoalCell
                              real={realized.followup}
                              target={metaFol}
                            />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {goal ? (
                            <GoalCell
                              real={realized.indicacao}
                              target={metaInd}
                            />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <GoalFormDialog
                            sellers={sellers.map((s) => ({ ...s, role: s.role }))}
                            defaultMonth={month}
                            defaultYear={year}
                            initial={
                              goal
                                ? {
                                    userId: seller.id,
                                    month: goal.month,
                                    year: goal.year,
                                    metaMatricula: goal.metaMatricula,
                                    metaFaturamento: Number(goal.metaFaturamento),
                                    metaFollowup: goal.metaFollowup,
                                    metaIndicacao: goal.metaIndicacao,
                                    notes: goal.notes,
                                  }
                                : {
                                    userId: seller.id,
                                    month,
                                    year,
                                    metaMatricula: 0,
                                    metaFaturamento: 0,
                                    metaFollowup: 0,
                                    metaIndicacao: 0,
                                    notes: null,
                                  }
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProgressBar({ value, target }: { value: number; target: number }) {
  if (target === 0) {
    return (
      <p className="mt-2 text-xs text-slate-500">Sem meta definida</p>
    );
  }
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div className="mt-2 space-y-1">
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full ${
            pct >= 100
              ? "bg-emerald-500"
              : pct >= 70
              ? "bg-amber-500"
              : "bg-red-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">{pct}% da meta</p>
    </div>
  );
}

function GoalCell({
  real,
  target,
  format = "number",
}: {
  real: number;
  target: number;
  format?: "number" | "currency";
}) {
  const pct = target === 0 ? 0 : Math.min(100, Math.round((real / target) * 100));
  const color =
    pct >= 100
      ? "text-emerald-600"
      : pct >= 70
      ? "text-amber-600"
      : "text-red-600";

  return (
    <div className="space-y-1">
      <div className="text-sm">
        <span className={`font-medium ${color}`}>
          {format === "currency" ? formatCurrency(real) : real}
        </span>
        <span className="text-xs text-slate-400"> / {format === "currency" ? formatCurrency(target) : target}</span>
      </div>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full ${
            pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
