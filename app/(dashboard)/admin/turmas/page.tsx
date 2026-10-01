import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, ExternalLink, Calendar, Clock } from "lucide-react";
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
import { formatDate } from "@/lib/utils";
import { deleteClassAction } from "@/lib/actions/classes";
import { ClassFormDialog } from "./class-form-dialog";

export const dynamic = "force-dynamic";

const STATUS_VARIANTS: Record<string, "success" | "info" | "warning" | "neutral"> = {
  ABERTA: "success",
  EM_ANDAMENTO: "info",
  ENCERRADA: "neutral",
  CANCELADA: "warning",
};

const DAY_LABELS: Record<string, string> = {
  SEG: "Seg", TER: "Ter", QUA: "Qua", QUI: "Qui", SEX: "Sex", SAB: "Sáb", DOM: "Dom",
};

export default async function AdminTurmasPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") {
    redirect("/");
  }

  const [classes, courses, professors] = await Promise.all([
    prisma.class.findMany({
      orderBy: { startDate: "desc" },
      include: {
        course: { select: { id: true, name: true } },
        professor: { select: { id: true, name: true } },
        _count: {
          select: {
            students: { where: { status: "ATIVA" } },
          },
        },
      },
    }),
    prisma.course.findMany({
      where: { status: "ATIVO" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { status: "ATIVO" },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const total = classes.length;
  const abertas = classes.filter((c) => c.status === "ABERTA").length;
  const emAndamento = classes.filter((c) => c.status === "EM_ANDAMENTO").length;
  const totalAlunos = classes.reduce((acc, c) => acc + c._count.students, 0);
  const lotacaoMedia =
    classes.length > 0
      ? Math.round(
          (totalAlunos /
            classes.reduce((acc, c) => acc + c.maxStudents, 0)) *
            100
        )
      : 0;

  return (
    <div>
      <PageHeader
        title="Turmas"
        description="Horários, lotação, professor e alunos matriculados"
        icon={Users}
        action={<ClassFormDialog courses={courses} professors={professors} />}
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Abertas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600">{abertas}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Em andamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-sky-600">{emAndamento}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Lotação média
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-direta-orange">
                {lotacaoMedia}%
              </p>
              <p className="text-xs text-slate-500">{totalAlunos} alunos</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de turmas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Turma</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Professor</TableHead>
                  <TableHead>Lotação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500">
                      Nenhuma turma cadastrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  classes.map((cls) => {
                    const schedule = cls.schedule as any;
                    const dias = (schedule?.days as string[]) ?? [];
                    return (
                      <TableRow key={cls.id}>
                        <TableCell>
                          <div className="font-medium">{cls.name}</div>
                          {cls.code && (
                            <div className="text-xs text-slate-500">
                              <code>{cls.code}</code>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <Link
                            href={`/admin/cursos/${cls.course.id}`}
                            className="text-slate-700 hover:underline"
                          >
                            {cls.course.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {dias.length > 0 || schedule?.time ? (
                            <div className="text-xs">
                              <div className="flex flex-wrap gap-1 mb-0.5">
                                {dias.map((d) => (
                                  <Badge key={d} variant="info">
                                    {DAY_LABELS[d]}
                                  </Badge>
                                ))}
                              </div>
                              {schedule?.time && (
                                <div className="text-slate-600">
                                  <Clock className="inline h-3 w-3" />{" "}
                                  {schedule.time}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {cls.professor?.name ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-medium">
                              {cls._count.students}
                            </span>
                            <span className="text-slate-400">
                              /{cls.maxStudents}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full bg-direta-orange"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (cls._count.students / cls.maxStudents) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[cls.status]}>
                            {cls.status.replace("_", " ")}
                          </Badge>
                          <div className="mt-1 text-xs text-slate-500">
                            <Calendar className="inline h-3 w-3" />{" "}
                            {formatDate(cls.startDate)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/admin/turmas/${cls.id}`}>
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </Button>
                            <ClassFormDialog
                              courses={courses}
                              professors={professors}
                              cls={{
                                id: cls.id,
                                courseId: cls.courseId,
                                name: cls.name,
                                code: cls.code,
                                schedule: cls.schedule,
                                startDate: cls.startDate,
                                endDate: cls.endDate,
                                maxStudents: cls.maxStudents,
                                professorId: cls.professorId,
                                status: cls.status,
                                notes: cls.notes,
                              }}
                            />
                            <form
                              action={async () => {
                                "use server";
                                await deleteClassAction(cls.id);
                              }}
                            >
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                title="Excluir"
                              >
                                <span className="text-red-600">✕</span>
                              </Button>
                            </form>
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
