import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";

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
import { rotuloSituacaoTurma } from "@/lib/registries";
import {
  createClassStatusAction,
  deleteClassStatusAction,
  toggleClassStatusAction,
  updateClassStatusAction,
} from "@/lib/actions/class-statuses";

/**
 * Administração › Situações de turma — cadastro pedido pela cliente
 * ("onde consigo alterar ou criar os status" da turma).
 *
 * "Aberta" e "Em andamento" continuam sendo as turmas que aceitam matrícula.
 */
export default async function SituacoesTurmaPage({
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

  const situacoes = await prisma.classStatusType.findMany({
    orderBy: [{ active: "desc" }, { description: "asc" }],
  });

  const filtradas = q
    ? situacoes.filter((f) => f.description.toLowerCase().includes(q.toLowerCase()))
    : situacoes;

  const total = situacoes.length;
  const ativas = situacoes.filter((f) => f.active).length;
  const inativas = total - ativas;

  const turmasPorSituacao = await prisma.class.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const turmasPorStatus = new Map(turmasPorSituacao.map((t) => [t.status, t._count._all]));

  return (
    <div>
      <PageHeader
        title="Situações de Turma"
        description="Situações que a turma pode assumir — as ativas aparecem no cadastro de turma"
        icon={ClipboardList}
        action={
          <RegistryFormDialog
            createTitle="Nova situação de turma"
            editTitle="Editar situação de turma"
            description="As situações ativas aparecem no select Status do cadastro de turma (Administração › Turmas)."
            triggerLabel="Nova situação de turma"
            fieldLabel="Descrição"
            placeholder="Ex: Em espera"
            createAction={createClassStatusAction}
            updateAction={updateClassStatusAction}
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
            <CardTitle>Situações cadastradas</CardTitle>
            <CardDescription>
              Situações inativas somem do cadastro de turma, mas as turmas já existentes
              continuam com a situação preenchida.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                name="q"
                defaultValue={q}
                placeholder="Buscar situação de turma..."
                className="w-full sm:max-w-xs"
              />
              <Button type="submit" size="sm" variant="outline">
                <Search className="mr-2 h-4 w-4" />
                Buscar
              </Button>
              {q && (
                <Button type="button" size="sm" variant="ghost" asChild>
                  <a href="/admin/situacoes-turma">
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
                  <TableHead className="text-right">Turmas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500">
                      {q
                        ? "Nenhuma situação de turma encontrada."
                        : "Nenhuma situação de turma cadastrada."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtradas.map((f) => {
                    const emUso = turmasPorStatus.get(f.description) ?? 0;
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">
                          {rotuloSituacaoTurma(f.description)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={f.active ? "success" : "neutral"}>
                            {f.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-slate-600">{emUso}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <RegistryFormDialog
                              createTitle="Nova situação de turma"
                              editTitle="Editar situação de turma"
                              description="As situações ativas aparecem no select Status do cadastro de turma."
                              triggerLabel="Nova situação de turma"
                              fieldLabel="Descrição"
                              placeholder="Ex: Em espera"
                              item={{
                                id: f.id,
                                description: f.description,
                                active: f.active,
                              }}
                              createAction={createClassStatusAction}
                              updateAction={updateClassStatusAction}
                            />
                            <RegistryRowActions
                              id={f.id}
                              descricao={f.description}
                              ativa={f.active}
                              tipo="situação de turma"
                              usos={emUso}
                              aoInativar="deixará de aparecer no cadastro de turma. As turmas já criadas continuam com a situação preenchida."
                              toggleAction={toggleClassStatusAction}
                              deleteAction={deleteClassStatusAction}
                            />
                          </div>
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
