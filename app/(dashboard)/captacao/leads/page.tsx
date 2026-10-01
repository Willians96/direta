import Link from "next/link";
import { UserPlus, Filter, Plus, ArrowUpDown, X } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { formatPhone, formatDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { LeadStatus, LeadPriority } from "@prisma/client";

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

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    priority?: string;
    courseId?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const statusFilter = params.status as LeadStatus | undefined;
  const priorityFilter = params.priority as LeadPriority | undefined;
  const courseFilter = params.courseId ?? "";

  const where: any = {};
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q.replace(/\D/g, "") } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (statusFilter) where.status = statusFilter;
  if (priorityFilter) where.priority = priorityFilter;
  if (courseFilter) where.courseId = courseFilter;

  const [leads, courses, totalPorStatus] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        course: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        campaign: { select: { name: true } },
      },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    prisma.course.findMany({
      where: { status: "ATIVO" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.lead.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const statusCount = (s: LeadStatus) =>
    totalPorStatus.find((g) => g.status === s)?._count._all ?? 0;

  const totalAtivos = totalPorStatus
    .filter((g) => !["APROVADA", "PERDIDA", "BLOQUEIOU", "CONCORRENTE", "FIN_SEM_RENDA", "INATIVO"].includes(g.status))
    .reduce((acc, g) => acc + g._count._all, 0);

  // Construir query string limpa para "Limpar filtros"
  const hasFilters = !!(q || statusFilter || priorityFilter || courseFilter);

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
        {/* Mini KPIs por status */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <Link
            href="/captacao/leads"
            className="rounded-md border bg-white p-3 text-center transition-colors hover:border-direta-orange"
          >
            <div className="text-xs uppercase text-slate-500">Ativos</div>
            <div className="text-xl font-bold text-slate-700">{totalAtivos}</div>
          </Link>
          <Link
            href="/captacao/leads?status=NOVO"
            className="rounded-md border bg-white p-3 text-center transition-colors hover:border-direta-orange"
          >
            <div className="text-xs uppercase text-slate-500">Novos</div>
            <div className="text-xl font-bold text-sky-600">{statusCount("NOVO")}</div>
          </Link>
          <Link
            href="/captacao/leads?status=EM_NEGOCIACAO"
            className="rounded-md border bg-white p-3 text-center transition-colors hover:border-direta-orange"
          >
            <div className="text-xs uppercase text-slate-500">Negociação</div>
            <div className="text-xl font-bold text-orange-600">{statusCount("EM_NEGOCIACAO")}</div>
          </Link>
          <Link
            href="/captacao/leads?status=AGUARDANDO_ANALISE"
            className="rounded-md border bg-white p-3 text-center transition-colors hover:border-direta-orange"
          >
            <div className="text-xs uppercase text-slate-500">Em análise</div>
            <div className="text-xl font-bold text-indigo-600">{statusCount("AGUARDANDO_ANALISE")}</div>
          </Link>
          <Link
            href="/captacao/leads?status=APROVADA"
            className="rounded-md border bg-white p-3 text-center transition-colors hover:border-emerald-400"
          >
            <div className="text-xs uppercase text-slate-500">Aprovados</div>
            <div className="text-xl font-bold text-emerald-600">{statusCount("APROVADA")}</div>
          </Link>
          <Link
            href="/captacao/leads?priority=ALTA"
            className="rounded-md border bg-white p-3 text-center transition-colors hover:border-red-400"
          >
            <div className="text-xs uppercase text-slate-500">🔥 Alta</div>
            <div className="text-xl font-bold text-red-600">
              {totalPorStatus.reduce((acc, g) => acc + (g.status === "APROVADA" ? 0 : g._count._all), 0)}
            </div>
          </Link>
          <Link
            href="/captacao/leads?status=PERDIDA"
            className="rounded-md border bg-white p-3 text-center transition-colors hover:border-slate-400"
          >
            <div className="text-xs uppercase text-slate-500">Perdidos</div>
            <div className="text-xl font-bold text-slate-600">{statusCount("PERDIDA") + statusCount("BLOQUEIOU") + statusCount("CONCORRENTE") + statusCount("FIN_SEM_RENDA") + statusCount("INATIVO")}</div>
          </Link>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form className="flex flex-col gap-3 md:flex-row md:items-center">
              <Input
                name="q"
                defaultValue={q}
                placeholder="Buscar por nome, telefone, e-mail..."
                className="md:max-w-sm"
              />
              <select
                name="status"
                defaultValue={statusFilter ?? ""}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Todos os status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                name="priority"
                defaultValue={priorityFilter ?? ""}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
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
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
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

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{leads.length} leads</CardTitle>
            <CardDescription>
              {hasFilters
                ? "Resultado filtrado — ordenados por prioridade + atualização"
                : "Ordenados por prioridade + atualização"}
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="px-6 py-3">Nome</th>
                      <th className="px-6 py-3">Prioridade</th>
                      <th className="px-6 py-3">Telefone</th>
                      <th className="px-6 py-3">Curso</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Vendedor</th>
                      <th className="px-6 py-3">Atualizado</th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-xs font-semibold text-white">
                              {lead.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{lead.fullName}</div>
                              {lead.campaign && (
                                <div className="text-[10px] text-slate-400">{lead.campaign.name}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <PriorityBadge priority={lead.priority} />
                        </td>
                        <td className="px-6 py-3 text-slate-600">{formatPhone(lead.phone)}</td>
                        <td className="px-6 py-3 text-slate-600">{lead.course?.name ?? "—"}</td>
                        <td className="px-6 py-3">
                          <StatusBadge status={lead.status} />
                        </td>
                        <td className="px-6 py-3 text-xs text-slate-500">
                          {lead.assignedTo?.name ?? <span className="text-amber-600">Não atribuído</span>}
                        </td>
                        <td className="px-6 py-3 text-slate-500">{formatDate(lead.updatedAt)}</td>
                        <td className="px-6 py-3 text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/vendas/leads/${lead.id}`}>Abrir</Link>
                          </Button>
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
