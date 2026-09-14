import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardList, AlertCircle, Clock, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatDateTime, formatPhone } from "@/lib/utils";
import { DecisionDialog } from "./decision-dialog";

export const dynamic = "force-dynamic";

export default async function RecepcaoFilaPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "RECEPCAO") {
    redirect("/");
  }

  const leads = await prisma.lead.findMany({
    where: { status: "AGUARDANDO_ANALISE" },
    include: {
      course: { select: { name: true } },
      assignedTo: { select: { name: true } },
      documents: { select: { type: true } },
    },
    orderBy: { updatedAt: "asc" }, // mais antigos primeiro
  });

  const total = leads.length;
  const urgentes = leads.filter(
    (l) => Date.now() - l.updatedAt.getTime() > 24 * 60 * 60 * 1000
  ).length;

  // Agrupa por vendedor
  const porVendedor = leads.reduce<Record<string, number>>((acc, l) => {
    const nome = l.assignedTo?.name ?? "Sem vendedor";
    acc[nome] = (acc[nome] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Fila de Análise"
        description="Pré-matrículas aguardando validação documental"
        icon={ClipboardList}
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Total na fila
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Urgentes (24h+)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-600">{urgentes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Vendedores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-700">
                {Object.keys(porVendedor).length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pré-matrículas aguardando análise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {leads.length === 0 ? (
              <div className="rounded-md border border-dashed p-12 text-center text-sm text-slate-500">
                🎉 Nenhuma pré-matrícula aguardando análise.
                <br />
                <span className="text-xs">
                  Quando vendedores enviarem leads para análise, eles aparecem aqui.
                </span>
              </div>
            ) : (
              leads.map((lead) => {
                const docsSet = new Set(lead.documents.map((d) => d.type));
                const obrigatorios = ["CPF", "RG", "COMPROVANTE_RESIDENCIA"];
                const docsCompletos = obrigatorios.every((d) =>
                  docsSet.has(d as any)
                );
                const horasAguardo =
                  (Date.now() - lead.updatedAt.getTime()) / (1000 * 60 * 60);
                const urgente = horasAguardo > 24;

                return (
                  <div
                    key={lead.id}
                    className={`rounded-md border bg-white p-4 transition-colors hover:bg-slate-50 ${
                      urgente
                        ? "border-l-4 border-l-amber-500 shadow-sm"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-900">
                            {lead.fullName}
                          </h3>
                          {urgente && (
                            <Badge variant="warning">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              {Math.floor(horasAguardo)}h na fila
                            </Badge>
                          )}
                          {lead.phone && (
                            <span className="text-xs text-slate-500">
                              {formatPhone(lead.phone)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {lead.course?.name ?? "—"} · vendedor:{" "}
                          <span className="font-medium">
                            {lead.assignedTo?.name ?? "Não atribuído"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <DecisionDialog
                          leadId={lead.id}
                          leadName={lead.fullName}
                          decision="APROVAR"
                        />
                        <DecisionDialog
                          leadId={lead.id}
                          leadName={lead.fullName}
                          decision="DEVOLVER"
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Documentos:</span>
                        {obrigatorios.map((docKey) => {
                          const ok = docsSet.has(docKey as any);
                          return (
                            <div
                              key={docKey}
                              className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                                ok
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              <span>{ok ? "✓" : "✗"}</span>
                              {docKey.replace("COMPROVANTE_RESIDENCIA", "Comp.")}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-xs text-slate-500">
                          <Clock className="mr-1 inline h-3 w-3" />
                          {formatDateTime(lead.updatedAt)}
                        </div>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/vendas/leads/${lead.id}`} target="_blank">
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>

                    {!docsCompletos && (
                      <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">
                        ⚠️ Documentação incompleta — verifique antes de aprovar.
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
