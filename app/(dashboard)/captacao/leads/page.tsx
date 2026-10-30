import Link from "next/link";
import { UserPlus, Filter, Plus, X } from "lucide-react";

export const dynamic = "force-dynamic";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import {
  SalesStatusBadge,
  SALES_STATUS_OPTIONS,
} from "@/components/shared/sales-status-badge";
import { formatPhone, formatDate, formatDateTime } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { LeadStatus, LeadPriority, SalesStatus } from "@prisma/client";

/**
 * Sprint 21 — Tela de Captação de Leads conforme pedido da cliente.
 *
 * Faixa de indicadores (resumo do mês atual):
 *   TOTAL | SEM CTT | NEGO | MATR | FECHA | INATIVO | MÉDIA | VISITA
 *
 * Tabela (na sequência pedida):
 *   DT CAD | NOME | TELEFONE | CURSO | STATUS | VENDE | ATUALIZADO
 */

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "NOVO", label: "Novo" },
  { value: "QUALIFICADO", label: "Qualificado" },
  { value: "QUARTO_CONTATO", label: "4º contato" },
  { value: "PROPOSTA_ENVIADA", label: "Proposta enviada" },
  { value: "EM_NEGOCIACAO", label: "Em negociação" },
  { value: "AGUARDANDO_ANALISE", label: "Em análise" },
  { value: "DEVOLVIDA_AJUSTE", label: "Devolvida" },
  { value: "APROVADA", label: "Aprovada" },
  { value: "PERDIDA", label: "Perdida" },
  { value: "BLOQUEIOU", label: "Bloqueou" },
  { value: "CONCORRENTE", label: "Concorrente" },
  { value: "FIN_SEM_RENDA", label: "S/ renda" },
  { value: "INATIVO", label: "Inativo" },
];

const PRIORITY_OPTIONS: { value: LeadPriority; label: string }[] = [
  { value: "ALTA", label: "Alta" },
  { value: "MEDIA", label: "Média" },
  { value: "BAIXA", label: "Baixa" },
];

const LIMITE_LISTA = 100;

type KpiCardProps = {
  label: string;
  value: string | number;
  href?: string;
  color?: string;
  /** Tooltip com a explicação pedida pela cliente. */
  ajuda?: string;
};

function KpiCard({ label, value, href, color = "text-slate-700", ajuda }: KpiCardProps) {
  const corpo = (
    <>
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 break-words text-2xl font-bold ${color}`}>{value}</div>
    </>
  );

  const classe = "rounded-md border bg-white p-3 text-center transition-colors";

  if (!href) {
    return (
      <div className={classe} title={ajuda}>
        {corpo}
      </div>
    );
  }

  return (
    <Link href={href} className={`${classe} hover:border-direta-orange`} title={ajuda}>
      {corpo}
    </Link>
  );
}

function formatarDecimal(valor: number, casas = 1) {
  return valor.toFixed(casas).replace(".", ",");
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    salesStatus?: string;
    priority?: string;
    courseId?: string;
    semFollowup?: string;
  }>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  // Só o ADMIN entra em /vendas — a Captação não tem acesso à ficha do lead.
  const podeAbrirFicha = role === "ADMIN";

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const statusFilter = params.status as LeadStatus | undefined;
  const salesStatusFilter = params.salesStatus as SalesStatus | undefined;
  const priorityFilter = params.priority as LeadPriority | undefined;
  const courseFilter = params.courseId ?? "";
  const semFollowup = params.semFollowup === "1";

  // Busca por nome/telefone/e-mail (aplicada na faixa e na tabela)
  const busca: any = q
    ? {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q.replace(/\D/g, "") } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  // ---------- Faixa de indicadores: resumo do mês atual ----------
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);

  const baseMes: any = {
    createdAt: { gte: inicioMes, lte: fimMes },
    ...busca,
    ...(priorityFilter ? { priority: priorityFilter } : {}),
    ...(courseFilter ? { courseId: courseFilter } : {}),
  };

  const [totalMes, semCtt, nego, matr, inativo, visita, followupsDoMes] =
    await Promise.all([
      prisma.lead.count({ where: baseMes }),
      prisma.lead.count({ where: { ...baseMes, followups: { none: {} } } }),
      prisma.lead.count({ where: { ...baseMes, salesStatus: "NEGOCIANDO" } }),
      prisma.lead.count({ where: { ...baseMes, salesStatus: "MATRICULADO" } }),
      prisma.lead.count({ where: { ...baseMes, status: "INATIVO" } }),
      prisma.lead.count({ where: { ...baseMes, salesStatus: "VISITA" } }),
      prisma.followup.count({ where: { lead: { is: baseMes } } }),
    ]);

  const fecha = totalMes > 0 ? (matr / totalMes) * 100 : 0;
  const mediaFollowup = totalMes > 0 ? followupsDoMes / totalMes : 0;

  // ---------- Tabela: todos os leads cadastrados ----------
  const where: any = { ...busca };
  if (statusFilter) where.status = statusFilter;
  if (salesStatusFilter) where.salesStatus = salesStatusFilter;
  if (priorityFilter) where.priority = priorityFilter;
  if (courseFilter) where.courseId = courseFilter;
  if (semFollowup) where.followups = { none: {} };

  const [leads, courses] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        course: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        campaign: { select: { name: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: LIMITE_LISTA,
    }),
    prisma.course.findMany({
      where: { status: "ATIVO" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalTabela = await prisma.lead.count({ where });

  // Monta o link dos indicadores preservando os filtros de busca/prioridade/curso
  const montarHref = (overrides: Record<string, string | null>) => {
    const atual: Record<string, string> = {};
    if (q) atual.q = q;
    if (priorityFilter) atual.priority = priorityFilter;
    if (courseFilter) atual.courseId = courseFilter;

    const merged = { ...atual, ...overrides };
    const sp = new URLSearchParams();
    Object.entries(merged).forEach(([chave, valor]) => {
      if (valor) sp.set(chave, valor);
    });
    const query = sp.toString();
    return query ? `/captacao/leads?${query}` : "/captacao/leads";
  };

  const limparStatus = { status: null, salesStatus: null, semFollowup: null };

  const hasFilters = !!(
    q ||
    statusFilter ||
    salesStatusFilter ||
    priorityFilter ||
    courseFilter ||
    semFollowup
  );

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Todos os leads captados — atribua a um vendedor"
        icon={UserPlus}
        action={
          <Button asChild>
            <Link href="/captacao/leads/novo">
              <Plus className="mr-2 h-4 w-4" />
              Novo lead
            </Link>
          </Button>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        {/* Faixa de indicadores — resumo do mês atual */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Resumo do mês atual
            </h2>
            <span className="text-[11px] text-slate-400">
              {formatarDecimal(agora.getMonth() + 1, 0)}/{agora.getFullYear()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
            <KpiCard
              label="Total"
              value={totalMes}
              href={montarHref(limparStatus)}
              ajuda="Clientes cadastrados no mês"
            />
            <KpiCard
              label="Sem CTT"
              value={semCtt}
              color="text-amber-600"
              href={montarHref({ ...limparStatus, semFollowup: "1" })}
              ajuda="Ainda não lançou follow-up"
            />
            <KpiCard
              label="Nego"
              value={nego}
              color="text-orange-600"
              href={montarHref({ ...limparStatus, salesStatus: "NEGOCIANDO" })}
              ajuda="Status de negociado"
            />
            <KpiCard
              label="Matr"
              value={matr}
              color="text-emerald-600"
              href={montarHref({ ...limparStatus, salesStatus: "MATRICULADO" })}
              ajuda="Status de matriculado"
            />
            <KpiCard
              label="Fecha"
              value={`${formatarDecimal(fecha)}%`}
              color="text-indigo-600"
              href={montarHref({ ...limparStatus, salesStatus: "MATRICULADO" })}
              ajuda="% de conversão: matrículas ÷ total do mês"
            />
            <KpiCard
              label="Inativo"
              value={inativo}
              color="text-slate-600"
              href={montarHref({ ...limparStatus, status: "INATIVO" })}
              ajuda="Status inativo que o vendedor coloca"
            />
            <KpiCard
              label="Média"
              value={formatarDecimal(mediaFollowup)}
              color="text-sky-600"
              ajuda="Média de follow-ups por cliente do mês"
            />
            <KpiCard
              label="Visita"
              value={visita}
              color="text-cyan-600"
              href={montarHref({ ...limparStatus, salesStatus: "VISITA" })}
              ajuda="Status de visita na escola"
            />
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Input
                name="q"
                defaultValue={q}
                placeholder="Buscar por nome, telefone, e-mail..."
                className="w-full sm:max-w-sm"
              />
              <select
                name="status"
                defaultValue={statusFilter ?? ""}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm sm:w-auto"
                aria-label="Status do funil"
              >
                <option value="">Status do funil: todos</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                name="salesStatus"
                defaultValue={salesStatusFilter ?? ""}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm sm:w-auto"
                aria-label="Status do cliente"
              >
                <option value="">Status do cliente: todos</option>
                {SALES_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                name="semFollowup"
                defaultValue={semFollowup ? "1" : ""}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm sm:w-auto"
                aria-label="Contato"
              >
                <option value="">Todos os contatos</option>
                <option value="1">Sem contato ainda (sem CTT)</option>
              </select>
              <select
                name="priority"
                defaultValue={priorityFilter ?? ""}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm sm:w-auto"
              >
                <option value="">Todas as prioridades</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select
                name="courseId"
                defaultValue={courseFilter}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm sm:w-auto"
              >
                <option value="">Todos os cursos</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filtrar
              </Button>
              {hasFilters && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/captacao/leads">
                    <X className="mr-1 h-4 w-4" />
                    Limpar
                  </Link>
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Tabela — sequência pedida pela cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {totalTabela} lead{totalTabela === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription>
              {hasFilters
                ? "Resultado filtrado — ordenados por atualização"
                : "Ordenados por atualização (último contato por cima)"}
              {totalTabela > LIMITE_LISTA
                ? ` — mostrando os ${LIMITE_LISTA} mais recentes`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {leads.length === 0 ? (
              <div className="rounded-md border border-dashed p-12 text-center text-sm text-slate-500">
                {hasFilters
                  ? "Nenhum lead corresponde aos filtros aplicados"
                  : "Nenhum lead cadastrado ainda"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3 md:px-4">DT CAD</th>
                      <th className="px-3 py-3 md:px-4">Nome</th>
                      <th className="px-3 py-3 md:px-4">Telefone</th>
                      <th className="px-3 py-3 md:px-4">Curso</th>
                      <th className="px-3 py-3 md:px-4">Status</th>
                      <th className="px-3 py-3 md:px-4">Vende</th>
                      <th className="px-3 py-3 md:px-4">Atualizado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50">
                        {/* DT CAD */}
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500 md:px-4">
                          {formatDate(lead.createdAt)}
                        </td>

                        {/* NOME */}
                        <td className="px-3 py-3 md:px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-xs font-semibold text-white">
                              {lead.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                            </div>
                            <div className="min-w-0">
                              {podeAbrirFicha ? (
                                <Link
                                  href={`/vendas/leads/${lead.id}`}
                                  className="block truncate font-medium text-slate-900 hover:text-direta-orange hover:underline"
                                >
                                  {lead.fullName}
                                </Link>
                              ) : (
                                <div className="truncate font-medium text-slate-900">
                                  {lead.fullName}
                                </div>
                              )}
                              {lead.campaign && (
                                <div className="truncate text-[10px] text-slate-400">
                                  {lead.campaign.name}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* TELEFONE */}
                        <td className="whitespace-nowrap px-3 py-3 md:px-4">
                          <a
                            href={`tel:${lead.phone}`}
                            className="text-slate-700 hover:text-direta-orange hover:underline"
                          >
                            {formatPhone(lead.phone)}
                          </a>
                          {lead.phone2 && (
                            <div className="text-[10px] text-slate-400">
                              {formatPhone(lead.phone2)}
                            </div>
                          )}
                        </td>

                        {/* CURSO */}
                        <td className="px-3 py-3 text-slate-600 md:px-4">
                          {lead.course?.name ?? "—"}
                        </td>

                        {/* STATUS */}
                        <td className="px-3 py-3 md:px-4">
                          <SalesStatusBadge status={lead.salesStatus} />
                        </td>

                        {/* VENDE */}
                        <td className="px-3 py-3 text-xs text-slate-500 md:px-4">
                          {lead.assignedTo?.name ?? (
                            <span className="text-amber-600">Não atribuído</span>
                          )}
                        </td>

                        {/* ATUALIZADO */}
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500 md:px-4">
                          {formatDateTime(lead.updatedAt)}
                        </td>
                      </tr>
                    ))}
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
