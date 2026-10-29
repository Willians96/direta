import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

import { UserPlus, Filter, Plus, ArrowUpDown, X, Phone, Mail } from "lucide-react";
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
import { SalesStatusBadge } from "@/components/shared/sales-status-badge";
import { PriorityBadge } from "@/components/shared/status-badge";
import { formatPhone, formatDate } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SalesStatus, LeadPriority } from "@prisma/client";

const SALES_STATUS_OPTIONS = [
  "NEGOCIANDO",
  "MATRICULADO",
  "RETORNAR",
  "BLOQUEIOU",
  "FECHOU_CONCORRENTE",
  "FIN_SEM_RENDA",
  "CIDADE_110KM",
  "OUTRA_UNIDADE",
  "ADM_RESOLVER",
  "DUPLICADO",
  "OPORTUNIDADE_VENDAS",
] as SalesStatus[];

export default async function VendasLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; salesStatus?: string; priority?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;
  const role = (session.user as any).role as string;

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const salesStatusFilter = params.salesStatus as SalesStatus | undefined;
  const priorityFilter = params.priority as LeadPriority | undefined;

  const where: any = {
    // Admin vê todos; vendedor vê apenas os seus
    ...(role === "VENDAS" ? { assignedToId: userId } : {}),
  };
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q.replace(/\D/g, "") } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (salesStatusFilter) where.salesStatus = salesStatusFilter;
  if (priorityFilter) where.priority = priorityFilter;

  const [leads, totalPorStatus] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        course: { select: { id: true, name: true } },
        followups: {
          orderBy: { occurredAt: "desc" },
          take: 1,
          select: { occurredAt: true },
        },
      },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      take: 200,
    }),
    prisma.lead.groupBy({
      by: ["salesStatus"],
      where: role === "VENDAS" ? { assignedToId: userId } : {},
      _count: { _all: true },
    }),
  ]);

  const statusCount = (s: SalesStatus) =>
    totalPorStatus.find((g) => g.salesStatus === s)?._count._all ?? 0;

  const hasFilters = !!(q || salesStatusFilter || priorityFilter);

  return (
    <div>
      <PageHeader
        title="Leads Atribuídos"
        description="Todos os leads do seu funil"
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
        {/* Mini KPIs por status de venda */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          <Link
            href="/vendas/leads"
            className="rounded-md border bg-white p-3 text-center transition-colors hover:border-direta-orange"
          >
            <div className="text-xs uppercase text-slate-500">Todos</div>
            <div className="text-xl font-bold text-slate-700">
              {totalPorStatus.reduce((acc, g) => acc + g._count._all, 0)}
            </div>
          </Link>
          <Link
            href="/vendas/leads?salesStatus=NEGOCIANDO"
            className="rounded-md border bg-white p-3 text-center transition-colors hover:border-direta-orange"
          >
            <div className="text-xs uppercase text-slate-500">Negociando</div>
            <div className="text-xl font-bold text-amber-600">{statusCount("NEGOCIANDO")}</div>
          </Link>
          <Link
            href="/vendas/leads?salesStatus=RETORNAR"
            className="rounded-md border bg-white p-3 text-center transition-colors hover:border-direta-orange"
          >
            <div className="text-xs uppercase text-slate-500">Retornar</div>
            <div className="text-xl font-bold text-sky-600">{statusCount("RETORNAR")}</div>
          </Link>
          <Link
            href="/vendas/leads?salesStatus=OPORTUNIDADE_VENDAS"
            className="rounded-md border bg-white p-3 text-center transition-colors hover:border-direta-orange"
          >
            <div className="text-xs uppercase text-slate-500">Oportunidade</div>
            <div className="text-xl font-bold text-direta-orange">
              {statusCount("OPORTUNIDADE_VENDAS")}
            </div>
          </Link>
          <Link
            href="/vendas/leads?salesStatus=MATRICULADO"
            className="rounded-md border bg-white p-3 text-center transition-colors hover:border-emerald-400"
          >
            <div className="text-xs uppercase text-slate-500">Matriculado</div>
            <div className="text-xl font-bold text-emerald-600">{statusCount("MATRICULADO")}</div>
          </Link>
          <Link
            href="/vendas/leads?priority=ALTA"
            className="rounded-md border bg-white p-3 text-center transition-colors hover:border-red-400"
          >
            <div className="text-xs uppercase text-slate-500">🔥 Alta</div>
            <div className="text-xl font-bold text-red-600">
              {totalPorStatus.reduce((acc, g) => acc + g._count._all, 0)}
            </div>
          </Link>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <form className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Input
                name="q"
                defaultValue={q}
                placeholder="Buscar por nome, telefone, e-mail..."
                className="w-full sm:max-w-sm"
              />
              <select
                name="salesStatus"
                defaultValue={salesStatusFilter ?? ""}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm sm:w-auto"
              >
                <option value="">Todos os status de venda</option>
                {SALES_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <select
                name="priority"
                defaultValue={priorityFilter ?? ""}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm sm:w-auto"
              >
                <option value="">Todas as prioridades</option>
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Média</option>
                <option value="BAIXA">Baixa</option>
              </select>
              <Button type="submit" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filtrar
              </Button>
              {hasFilters && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/vendas/leads">
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
              Status de venda é a classificação feita por você
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {leads.length === 0 ? (
              <div className="rounded-md border border-dashed p-12 text-center text-sm text-slate-500">
                {hasFilters
                  ? "Nenhum lead corresponde aos filtros aplicados"
                  : "Nenhum lead atribuído a você ainda"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="px-6 py-3">Nome</th>
                      <th className="px-6 py-3">Status de venda</th>
                      <th className="px-6 py-3">Prioridade</th>
                      <th className="px-6 py-3">Telefones</th>
                      <th className="px-6 py-3">Curso</th>
                      <th className="px-6 py-3">Último contato</th>
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
                              {lead.source && (
                                <div className="text-[10px] text-slate-400">
                                  Fonte: {lead.source}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <SalesStatusBadge status={lead.salesStatus} />
                        </td>
                        <td className="px-6 py-3">
                          <PriorityBadge priority={lead.priority} />
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            <Phone className="h-3 w-3" />
                            {formatPhone(lead.phone)}
                          </div>
                          {lead.phone2 && (
                            <div className="mt-0.5 text-[10px] text-slate-400">
                              {formatPhone(lead.phone2)}
                            </div>
                          )}
                          {lead.phone3 && (
                            <div className="mt-0.5 text-[10px] text-slate-400">
                              {formatPhone(lead.phone3)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-3 text-slate-600">{lead.course?.name ?? "—"}</td>
                        <td className="px-6 py-3 text-slate-500">
                          {lead.followups[0]
                            ? formatDate(lead.followups[0].occurredAt)
                            : "—"}
                        </td>
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
