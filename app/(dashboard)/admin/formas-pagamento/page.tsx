import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { RegistryFormDialog } from "@/components/shared/registry/registry-form-dialog";
import { RegistryRowActions } from "@/components/shared/registry/registry-row-actions";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { rotuloPagamento } from "@/lib/registries";
import {
  createPaymentMethodAction,
  deletePaymentMethodAction,
  togglePaymentMethodAction,
  updatePaymentMethodAction,
} from "@/lib/actions/payment-methods";

/**
 * Administração › Formas de pagamento — cadastro pedido pela cliente
 * ("onde cadastrar mais formas de pagamento"). As formas ativas alimentam o
 * cadastro de curso e a matrícula.
 */
export default async function FormasPagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!session?.user) redirect("/login");
  if (role !== "ADMIN") redirect("/");

  const params = await searchParams;
  const q = (params.q ?? "").trim();

  const formas = await prisma.paymentMethodType.findMany({
    orderBy: [{ active: "desc" }, { description: "asc" }],
  });

  const filtradas = q
    ? formas.filter((f) => f.description.toLowerCase().includes(q.toLowerCase()))
    : formas;

  const total = formas.length;
  const ativas = formas.filter((f) => f.active).length;
  const inativas = total - ativas;

  // Quantos registros usam cada forma (curso / matrícula).
  const usos = await Promise.all(
    formas.map(async (f) => {
      const [cursos, matriculas] = await Promise.all([
        prisma.coursePaymentMethod.count({ where: { method: f.description } }),
        prisma.enrollment.count({ where: { paymentMethod: f.description } }),
      ]);
      return { id: f.id, total: cursos + matriculas };
    })
  );
  const usoPorId = new Map(usos.map((u) => [u.id, u.total]));

  return (
    <div>
      <PageHeader
        title="Formas de Pagamento"
        description="Como o cliente pode pagar — formas ativas aparecem no cadastro de curso e na matrícula"
        icon={CreditCard}
        action={
          <RegistryFormDialog
            createTitle="Nova forma de pagamento"
            editTitle="Editar forma de pagamento"
            description="As formas ativas aparecem no cadastro de curso (Administração › Cursos) e na matrícula."
            triggerLabel="Nova forma de pagamento"
            fieldLabel="Descrição"
            placeholder="Ex: Pix parcelado"
            createAction={createPaymentMethodAction}
            updateAction={updatePaymentMethodAction}
          />
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Formas cadastradas</CardTitle>
            <CardDescription>
              Formas inativas somem do cadastro de curso e da matrícula, mas o histórico é
              preservado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                name="q"
                defaultValue={q}
                placeholder="Buscar forma de pagamento..."
                className="w-full sm:max-w-xs"
              />
              <Button type="submit" size="sm" variant="outline">
                <Search className="mr-2 h-4 w-4" />
                Buscar
              </Button>
              {q && (
                <Button type="button" size="sm" variant="ghost" asChild>
                  <a href="/admin/formas-pagamento">
                    <X className="mr-1 h-4 w-4" />
                    Limpar
                  </a>
                </Button>
              )}
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Em uso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500">
                      {q
                        ? "Nenhuma forma de pagamento encontrada."
                        : "Nenhuma forma de pagamento cadastrada."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtradas.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">
                        {rotuloPagamento(f.description)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.active ? "success" : "neutral"}>
                          {f.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-slate-600">
                        {usoPorId.get(f.id) ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <RegistryFormDialog
                            createTitle="Nova forma de pagamento"
                            editTitle="Editar forma de pagamento"
                            description="As formas ativas aparecem no cadastro de curso e na matrícula."
                            triggerLabel="Nova forma de pagamento"
                            fieldLabel="Descrição"
                            placeholder="Ex: Pix parcelado"
                            item={{
                              id: f.id,
                              description: f.description,
                              active: f.active,
                            }}
                            createAction={createPaymentMethodAction}
                            updateAction={updatePaymentMethodAction}
                          />
                          <RegistryRowActions
                            id={f.id}
                            descricao={f.description}
                            ativa={f.active}
                            tipo="forma de pagamento"
                            usos={usoPorId.get(f.id) ?? 0}
                            aoInativar="deixará de aparecer no cadastro de curso e na matrícula. Os registros já feitos continuam como estão."
                            toggleAction={togglePaymentMethodAction}
                            deleteAction={deletePaymentMethodAction}
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
