import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import {
  Card,
  CardContent,
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
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatDate, formatPhone } from "@/lib/utils";
import { toggleUserStatusAction } from "@/lib/actions/users";
import { UserFormDialog } from "./user-form-dialog";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  CAPTACAO: "Captação",
  VENDAS: "Vendas",
  RECEPCAO: "Recepção",
};

const ROLE_VARIANTS: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  ADMIN: "danger",
  CAPTACAO: "info",
  VENDAS: "warning",
  RECEPCAO: "success",
};

export default async function AdminUsuariosPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") {
    redirect("/");
  }

  const [users, totalAtivos, totalInativos] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where: { status: "ATIVO" } }),
    prisma.user.count({ where: { status: "INATIVO" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Gestão de funcionários e permissões de acesso"
        icon={Users}
        action={<UserFormDialog />}
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{users.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600">{totalAtivos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Inativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-400">{totalInativos}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último login</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500">
                      Nenhum usuário cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-slate-600">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={ROLE_VARIANTS[u.role]}>
                          {ROLE_LABELS[u.role]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {u.phone ? formatPhone(u.phone) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.status === "ATIVO" ? "success" : "neutral"}
                        >
                          {u.status === "ATIVO" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs">
                        {u.lastLoginAt ? formatDate(u.lastLoginAt) : "Nunca"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <UserFormDialog
                            user={{
                              id: u.id,
                              name: u.name,
                              email: u.email,
                              role: u.role,
                              phone: u.phone,
                              status: u.status,
                            }}
                          />
                          <form
                            action={async () => {
                              "use server";
                              await toggleUserStatusAction(u.id);
                            }}
                          >
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              title={
                                u.status === "ATIVO"
                                  ? "Desativar usuário"
                                  : "Reativar usuário"
                              }
                            >
                              {u.status === "ATIVO" ? "⏸" : "▶"}
                            </Button>
                          </form>
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
