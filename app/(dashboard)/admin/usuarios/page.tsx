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
import { UserFormDialog } from "./user-form-dialog";
import { UserStatusToggle } from "@/components/shared/users/user-status-toggle";

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

  const meuId = (session?.user as any)?.id as string;

  const todosUsuarios = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Fora da lista ficam duas contas: a de quem está logado (é o acesso de
  // quem opera o sistema) e as contas protegidas (o dono do sistema).
  // Nenhuma das duas pode ser desativada ou rebaixada por engano.
  const users = todosUsuarios.filter((u) => u.id !== meuId && !u.protectedAccount);
  const totalAtivos = users.filter((u) => u.status === "ATIVO").length;
  const totalInativos = users.filter((u) => u.status === "INATIVO").length;

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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Lista de usuários</CardTitle>
              <p className="text-xs text-slate-500">
                A sua própria conta e as contas protegidas não aparecem na lista.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Último login</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500">
                      Nenhum usuário cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="text-slate-500 text-xs">{u.code ?? "—"}</TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-slate-600">
                        {u.jobTitle ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ROLE_VARIANTS[u.role]}>
                          {ROLE_LABELS[u.role]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        <div>{u.email}</div>
                        <div className="text-xs text-slate-400">
                          {u.mobile
                            ? formatPhone(u.mobile)
                            : u.phone
                              ? formatPhone(u.phone)
                              : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={u.status === "ATIVO" ? "success" : "neutral"}
                          >
                            {u.status === "ATIVO" ? "Ativo" : "Inativo"}
                          </Badge>
                          {!u.showEnrollment && (
                            <Badge variant="neutral" className="w-fit">
                              Sem matrícula
                            </Badge>
                          )}
                        </div>
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
                              code: u.code,
                              admissionDate: u.admissionDate?.toISOString() ?? null,
                              birthDate: u.birthDate?.toISOString() ?? null,
                              cpf: u.cpf,
                              rg: u.rg,
                              mobile: u.mobile,
                              jobTitle: u.jobTitle,
                              addressStreet: u.addressStreet,
                              addressNumber: u.addressNumber,
                              addressDistrict: u.addressDistrict,
                              addressCity: u.addressCity,
                              addressState: u.addressState,
                              addressZip: u.addressZip,
                              notes: u.notes,
                              showEnrollment: u.showEnrollment,
                              avatarUrl: u.avatarUrl,
                              createdAt: u.createdAt.toISOString(),
                            }}
                          />
                          <UserStatusToggle
                            id={u.id}
                            nome={u.name}
                            status={u.status}
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
