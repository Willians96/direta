import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

import {
  AlertTriangle,
  Clock,
  Calendar,
  ChevronRight,
  Phone,
  ArrowLeft,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { auth } from "@/lib/auth";
import {
  getStaleLeads,
  getUpcomingFollowups,
  getTodayFollowupMetrics,
} from "@/lib/actions/followups";
import { formatDateTime, formatDate } from "@/lib/utils";

export default async function AlertasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "CAPTACAO") {
    redirect("/admin");
  }

  const [stale, upcoming, todayMetrics] = await Promise.all([
    getStaleLeads(3, "all"),
    getUpcomingFollowups(7, "all"),
    getTodayFollowupMetrics("all"),
  ]);

  // Agrupar parados por vendedor
  const staleByUser = new Map<string, { name: string; leads: typeof stale }>();
  for (const l of stale) {
    const key = l.assignedTo?.id ?? "__none__";
    const name = l.assignedTo?.name ?? "Sem vendedor";
    if (!staleByUser.has(key)) staleByUser.set(key, { name, leads: [] });
    staleByUser.get(key)!.leads.push(l);
  }
  const staleByUserArr = Array.from(staleByUser.entries())
    .map(([id, v]) => ({ id, ...v, count: v.leads.length }))
    .sort((a, b) => b.count - a.count);

  const critical = stale.filter((l) => l.daysSinceLastContact >= 7);
  const total = stale.length;

  return (
    <div>
      <PageHeader
        title="Central de Alertas"
        description="Leads parados e próximos contatos da equipe"
        icon={AlertTriangle}
        action={
          <Button variant="outline" asChild>
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* KPIs resumo */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-slate-500">Parados (3+ dias)</div>
                  <div className="text-3xl font-bold text-amber-600">{total}</div>
                </div>
                <Clock className="h-10 w-10 text-amber-300" />
              </div>
            </CardContent>
          </Card>
          <Card className={critical.length > 0 ? "border-red-300" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-slate-500">Críticos (7+ dias)</div>
                  <div className="text-3xl font-bold text-red-600">{critical.length}</div>
                </div>
                <AlertTriangle className="h-10 w-10 text-red-300" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-slate-500">Próx. contatos (7d)</div>
                  <div className="text-3xl font-bold text-blue-600">{upcoming.length}</div>
                </div>
                <Calendar className="h-10 w-10 text-blue-300" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-slate-500">Acionados hoje</div>
                  <div className="text-3xl font-bold text-direta-orange">{todayMetrics.total}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {todayMetrics.byType.map((b) => `${b.type.slice(0, 3)}: ${b.count}`).join(" · ")}
                  </div>
                </div>
                <Phone className="h-10 w-10 text-orange-300" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resumo por vendedor */}
        {staleByUserArr.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ranking de vendedores com leads parados</CardTitle>
              <CardDescription>
                Top vendedores com mais leads sem contato (3+ dias)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {staleByUserArr.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-md border bg-white p-3"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{u.name}</div>
                      <div className="text-xs text-slate-500">
                        {u.leads.slice(0, 3).map((l) => l.fullName).join(", ")}
                        {u.leads.length > 3 && ` +${u.leads.length - 3}`}
                      </div>
                    </div>
                    <Badge variant={u.count >= 5 ? "destructive" : u.count >= 3 ? "default" : "secondary"}>
                      {u.count} parado{u.count > 1 ? "s" : ""}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Lista de leads parados */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leads parados</CardTitle>
              <CardDescription>
                Sem contato há 3+ dias — clique para abrir
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {stale.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">
                  ✅ Nenhum lead parado no momento
                </div>
              ) : (
                stale.map((l) => {
                  const isCritical = l.daysSinceLastContact >= 7;
                  return (
                    <Link
                      key={l.id}
                      href={`/vendas/leads/${l.id}`}
                      className="flex items-center justify-between rounded-md border bg-white p-3 transition-colors hover:border-direta-orange hover:bg-orange-50/30"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{l.fullName}</span>
                          {isCritical && <Badge variant="destructive">CRÍTICO</Badge>}
                        </div>
                        <div className="text-xs text-slate-500">
                          {l.assignedTo?.name ?? "Sem vendedor"} ·{" "}
                          {l.courseName ?? "Sem curso"} ·{" "}
                          último contato {formatDate(l.lastContactAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={isCritical ? "destructive" : "outline"}>
                          {l.daysSinceLastContact}d
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Próximos contatos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Próximos contatos (7 dias)</CardTitle>
              <CardDescription>
                Follow-ups com data agendada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcoming.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">
                  Nenhum contato agendado
                </div>
              ) : (
                upcoming.map((f) => {
                  const isOverdue = new Date(f.nextAction!) < new Date();
                  return (
                    <Link
                      key={f.id}
                      href={`/vendas/leads/${f.lead.id}`}
                      className="flex items-center justify-between rounded-md border bg-white p-3 transition-colors hover:border-direta-orange hover:bg-orange-50/30"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {f.lead.fullName}
                          </span>
                          {isOverdue && <Badge variant="destructive">ATRASADO</Badge>}
                        </div>
                        <div className="text-xs text-slate-500">
                          Agendado para {formatDateTime(f.nextAction)} · {f.user.name}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
