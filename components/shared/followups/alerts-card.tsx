import Link from "next/link";
import { AlertTriangle, Clock, Calendar, Phone, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { StaleLead } from "@/lib/actions/followups";

export function AlertsCard({
  staleLeads,
  upcomingCount,
  linkHref = "/admin/alertas",
}: {
  staleLeads: StaleLead[];
  upcomingCount: number;
  linkHref?: string;
}) {
  const totalStale = staleLeads.length;
  const critical = staleLeads.filter((l) => l.daysSinceLastContact >= 7).length;

  return (
    <Card className={critical > 0 ? "border-red-300 bg-red-50/30" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle
                className={`h-5 w-5 ${critical > 0 ? "text-red-600" : "text-amber-600"}`}
              />
              Alertas de Follow-up
            </CardTitle>
            <CardDescription>
              Leads sem contato há muito tempo e próximos agendamentos
            </CardDescription>
          </div>
          {totalStale > 0 && (
            <Badge variant={critical > 0 ? "destructive" : "secondary"}>
              {totalStale} parado{totalStale > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Resumo */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border bg-white p-3">
            <div className="text-xs text-slate-500">Leads parados (3+ dias)</div>
            <div className="text-2xl font-bold text-amber-600">{totalStale}</div>
          </div>
          <div className="rounded-md border bg-white p-3">
            <div className="text-xs text-slate-500">Críticos (7+ dias)</div>
            <div className="text-2xl font-bold text-red-600">{critical}</div>
          </div>
          <div className="col-span-2 rounded-md border bg-white p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Próximos contatos (7 dias)</div>
                <div className="text-2xl font-bold text-blue-600">{upcomingCount}</div>
              </div>
              <Calendar className="h-8 w-8 text-blue-300" />
            </div>
          </div>
        </div>

        {/* Top leads parados */}
        {staleLeads.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Mais críticos
            </div>
            {staleLeads.slice(0, 5).map((lead) => {
              const isCritical = lead.daysSinceLastContact >= 7;
              return (
                <Link
                  key={lead.id}
                  href={`/vendas/leads/${lead.id}`}
                  className="flex items-center justify-between rounded-md border bg-white p-2 text-sm transition-colors hover:border-direta-orange hover:bg-orange-50/30"
                >
                  <div className="flex-1 truncate">
                    <div className="truncate font-medium text-slate-900">{lead.fullName}</div>
                    <div className="text-xs text-slate-500">
                      {lead.assignedTo?.name ?? "Sem vendedor"} · {lead.courseName ?? "Sem curso"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isCritical ? "destructive" : "outline"}>
                      {lead.daysSinceLastContact}d
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <Button variant="outline" className="w-full" asChild>
          <Link href={linkHref}>
            <Phone className="mr-2 h-4 w-4" />
            Ver todos os alertas
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
