import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  Users,
  ArrowLeft,
  Calendar,
  Clock,
  GraduationCap,
  UserCog,
  Trash2,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  formatCurrency,
  formatDate,
  formatPhone,
} from "@/lib/utils";
import {
  unenrollStudentAction,
  updateEnrollmentStatusAction,
} from "@/lib/actions/classes";
import { EnrollDialog } from "./enroll-dialog";

export const dynamic = "force-dynamic";

const STATUS_VARIANTS: Record<string, "success" | "info" | "warning" | "neutral"> = {
  ABERTA: "success",
  EM_ANDAMENTO: "info",
  ENCERRADA: "neutral",
  CANCELADA: "warning",
};

const STUDENT_STATUS_VARIANTS: Record<string, "success" | "warning" | "neutral" | "info"> = {
  ATIVA: "success",
  TRANCADA: "warning",
  CONCLUIDA: "info",
  CANCELADA: "neutral",
};

const DAY_LABELS: Record<string, string> = {
  SEG: "Seg", TER: "Ter", QUA: "Qua", QUI: "Qui", SEX: "Sex", SAB: "Sáb", DOM: "Dom",
};

export default async function AdminTurmaDetalhePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") redirect("/");

  const cls = await prisma.class.findUnique({
    where: { id: params.id },
    include: {
      course: true,
      professor: { select: { id: true, name: true, email: true, phone: true } },
      students: {
        include: {
          lead: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
              cpf: true,
            },
          },
        },
        orderBy: { enrolledAt: "asc" },
      },
    },
  });

  if (!cls) notFound();

  // Leads aprovados (aptos a matricular)
  const leadsAprovados = await prisma.lead.findMany({
    where: {
      status: "APROVADA",
      classStudents: { none: { classId: cls.id } },
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
    take: 100,
  });

  const schedule = cls.schedule as any;
  const dias = (schedule?.days as string[]) ?? [];

  const totalAtivos = cls.students.filter((s) => s.status === "ATIVA").length;
  const trancados = cls.students.filter((s) => s.status === "TRANCADA").length;
  const concluidos = cls.students.filter((s) => s.status === "CONCLUIDA").length;

  return (
    <div>
      <PageHeader
        title={cls.name}
        description={`${cls.course.name} • ${cls.code ?? "sem código"}`}
        icon={Users}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/turmas">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <EnrollDialog classId={cls.id} leads={leadsAprovados} />
          </div>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* Info da turma */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Lotação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {totalAtivos}
                <span className="text-base text-slate-400">
                  /{cls.maxStudents}
                </span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-direta-orange"
                  style={{
                    width: `${Math.min(
                      100,
                      (totalAtivos / cls.maxStudents) * 100
                    )}%`,
                  }}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={STATUS_VARIANTS[cls.status]} className="text-base">
                {cls.status.replace("_", " ")}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <Calendar className="inline h-4 w-4" />{" "}
                {formatDate(cls.startDate)}
                {cls.endDate && ` → ${formatDate(cls.endDate)}`}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Valor do curso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(Number(cls.course.price))}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Horários + Professor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Horário & Professor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium text-slate-500">
                  Dias da semana
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {dias.length > 0 ? (
                    dias.map((d) => (
                      <Badge key={d} variant="info" className="text-sm">
                        {DAY_LABELS[d]}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">
                      Não definido
                    </span>
                  )}
                </div>
                {schedule?.time && (
                  <p className="mt-2 text-sm text-slate-700">
                    <Clock className="inline h-4 w-4" /> {schedule.time}
                  </p>
                )}
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-500">
                  Professor
                </p>
                {cls.professor ? (
                  <div className="rounded-md border bg-slate-50 p-3">
                    <p className="flex items-center gap-1.5 font-medium">
                      <UserCog className="h-4 w-4" />
                      {cls.professor.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {cls.professor.email}
                    </p>
                    {cls.professor.phone && (
                      <p className="text-xs text-slate-600">
                        {formatPhone(cls.professor.phone)}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">
                    Sem professor atribuído
                  </span>
                )}
              </div>
            </div>
            {cls.notes && (
              <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                <strong>Observações:</strong> {cls.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alunos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Alunos matriculados ({cls.students.length})
            </CardTitle>
            <CardDescription>
              {totalAtivos} ativos · {trancados} trancados · {concluidos} concluídos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cls.students.length === 0 ? (
              <div className="rounded-md border border-dashed p-12 text-center text-sm text-slate-500">
                Nenhum aluno matriculado ainda.
                <br />
                <span className="text-xs">
                  Clique em "Matricular aluno" pra adicionar.
                </span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Matriculado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cls.students.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.lead.fullName}</div>
                        {s.lead.cpf && (
                          <div className="text-xs text-slate-500">
                            CPF: {s.lead.cpf}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {s.lead.phone && <div>{formatPhone(s.lead.phone)}</div>}
                        {s.lead.email && (
                          <div className="text-xs">{s.lead.email}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STUDENT_STATUS_VARIANTS[s.status]}>
                          {s.status}
                        </Badge>
                        {s.notes && (
                          <div className="mt-1 text-xs text-slate-500">
                            {s.notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {formatDate(s.enrolledAt)}
                        {s.finishedAt && (
                          <div className="text-xs text-slate-500">
                            Concluiu: {formatDate(s.finishedAt)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {s.status === "ATIVA" && (
                            <form
                              action={async () => {
                                "use server";
                                await updateEnrollmentStatusAction(
                                  s.id,
                                  "TRANCADA"
                                );
                              }}
                            >
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                title="Trancar matrícula"
                              >
                                <span>⏸</span>
                              </Button>
                            </form>
                          )}
                          {s.status === "TRANCADA" && (
                            <form
                              action={async () => {
                                "use server";
                                await updateEnrollmentStatusAction(s.id, "ATIVA");
                              }}
                            >
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                title="Reativar matrícula"
                              >
                                <span>▶</span>
                              </Button>
                            </form>
                          )}
                          {s.status !== "CONCLUIDA" && (
                            <form
                              action={async () => {
                                "use server";
                                await updateEnrollmentStatusAction(
                                  s.id,
                                  "CONCLUIDA"
                                );
                              }}
                            >
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                title="Marcar como concluída"
                              >
                                ✓
                              </Button>
                            </form>
                          )}
                          <form
                            action={async () => {
                              "use server";
                              await unenrollStudentAction(s.id);
                            }}
                          >
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              title="Remover matrícula"
                            >
                              <Trash2 className="h-3 w-3 text-red-600" />
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
