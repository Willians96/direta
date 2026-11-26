import { redirect } from "next/navigation";
import { Waypoints } from "lucide-react";

export const dynamic = "force-dynamic";

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
import { LeadSourceFormDialog } from "./lead-source-form-dialog";
import { LeadSourceRowActions } from "./lead-source-row-actions";

/**
 * Captação > Fontes — "Cadastro de Formas de Conhecimento".
 *
 * Como o cliente conheceu a escola. A lista alimenta o select de Fonte do
 * cadastro de lead e o painel de Captação (bloco FONTE / CONHECIMENTO).
 */
export default async function FontesPage() {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!session?.user) redirect("/login");
  if (role !== "ADMIN" && role !== "CAPTACAO") redirect("/");

  const fontes = await prisma.leadSource.findMany({
    include: { _count: { select: { leads: true } } },
    orderBy: [{ active: "desc" }, { description: "asc" }],
  });

  const total = fontes.length;
  const ativas = fontes.filter((f) => f.active).length;
  const inativas = total - ativas;
  const semComissao = fontes.filter((f) => f.noCommission).length;

  return (
    <div>
      <PageHeader
        title="Formas de Conhecimento"
        description="De onde veio o cliente — fontes usadas no cadastro de lead e no painel"
        icon={Waypoints}
        action={<LeadSourceFormDialog />}
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Ativas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600">{ativas}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Inativas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-400">{inativas}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Sem comissão</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-600">{semComissao}</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista */}
        <Card>
          <CardHeader>
            <CardTitle>Formas cadastradas</CardTitle>
            <CardDescription>
              Formas inativas somem do cadastro de lead, mas continuam no histórico.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fontes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-500">
                      Nenhuma forma de conhecimento cadastrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  fontes.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.description}</TableCell>
                      <TableCell>
                        {f.noCommission ? (
                          <Badge variant="warning">Não gera comissão</Badge>
                        ) : (
                          <Badge variant="neutral">Gera comissão</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.active ? "success" : "neutral"}>
                          {f.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-slate-600">
                        {f._count.leads}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <LeadSourceFormDialog
                            fonte={{
                              id: f.id,
                              description: f.description,
                              noCommission: f.noCommission,
                              active: f.active,
                            }}
                          />
                          <LeadSourceRowActions
                            id={f.id}
                            descricao={f.description}
                            ativa={f.active}
                            leads={f._count.leads}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
