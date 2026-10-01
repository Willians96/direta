import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  GraduationCap,
  ArrowLeft,
  Clock,
  DollarSign,
  CreditCard,
  Users,
  ExternalLink,
  Pencil,
  Calendar,
  FileText,
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
import { formatCurrency, formatDate } from "@/lib/utils";
import { CourseFormDialog } from "../course-form-dialog";
import { ClassFormDialog } from "../../turmas/class-form-dialog";

export const dynamic = "force-dynamic";

const PAYMENT_LABELS: Record<string, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CARTAO_CREDITO: "Cartão de Crédito",
  CARTAO_DEBITO: "Cartão de Débito",
  DINHEIRO: "Dinheiro",
  TRANSFERENCIA: "Transferência",
  PARCELADO_PROPRIO: "Parcelado Próprio",
  OUTRO: "Outro",
};

const CLASS_STATUS_VARIANTS: Record<string, "success" | "info" | "warning" | "neutral"> = {
  ABERTA: "success",
  EM_ANDAMENTO: "info",
  ENCERRADA: "neutral",
  CANCELADA: "warning",
};

const DAY_LABELS: Record<string, string> = {
  SEG: "Seg", TER: "Ter", QUA: "Qua", QUI: "Qui", SEX: "Sex", SAB: "Sáb", DOM: "Dom",
};

export default async function AdminCursoDetalhePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") redirect("/");

  const [course, professors] = await Promise.all([
    prisma.course.findUnique({
      where: { id: params.id },
      include: {
        paymentMethods: {
          where: { active: true },
          orderBy: { method: "asc" },
        },
        classes: {
          orderBy: { startDate: "desc" },
          include: {
            professor: { select: { name: true } },
            _count: { select: { students: { where: { status: "ATIVA" } } } },
          },
        },
        _count: {
          select: { classes: true, leads: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { status: "ATIVO" },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!course) notFound();

  // Buscar todos os cursos pra usar no form de turma
  const allCourses = [
    { id: course.id, name: course.name },
  ];

  return (
    <div>
      <PageHeader
        title={course.name}
        description={course.description ?? "Curso do catálogo Direta"}
        icon={GraduationCap}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/cursos">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <CourseFormDialog
              course={{
                id: course.id,
                name: course.name,
                description: course.description,
                workloadHours: course.workloadHours,
                price: course.price,
                syllabus: course.syllabus,
                status: course.status,
                paymentMethods: course.paymentMethods,
              }}
            />
          </div>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Preço
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600">
                {formatCurrency(Number(course.price))}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Carga horária
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold flex items-center gap-1">
                <Clock className="h-6 w-6 text-slate-500" />
                {course.workloadHours}h
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Turmas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-direta-orange">
                {course._count.classes}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Leads captados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-700">
                {course._count.leads}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Ementa + Formas de pagamento */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Ementa do curso
              </CardTitle>
            </CardHeader>
            <CardContent>
              {course.syllabus ? (
                <p className="whitespace-pre-wrap text-sm text-slate-700">
                  {course.syllabus}
                </p>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  Ementa não cadastrada
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" />
                Formas de pagamento
              </CardTitle>
              <CardDescription>
                {course.paymentMethods.length} ativa(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {course.paymentMethods.length === 0 ? (
                <p className="text-sm text-slate-400 italic">
                  Nenhuma forma cadastrada. Edite o curso para adicionar.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {course.paymentMethods.map((pm) => (
                    <div
                      key={pm.id}
                      className="rounded-md border border-slate-100 bg-slate-50 p-2"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="info">
                          {PAYMENT_LABELS[pm.method] ?? pm.method}
                        </Badge>
                      </div>
                      {pm.details && (
                        <p className="mt-1 text-xs text-slate-600">
                          {pm.details}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Turmas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Turmas deste curso ({course.classes.length})
              </CardTitle>
              <CardDescription>
                Horários, lotação e professor responsável
              </CardDescription>
            </div>
            <ClassFormDialog
              courses={allCourses}
              professors={professors}
            />
          </CardHeader>
          <CardContent>
            {course.classes.length === 0 ? (
              <div className="rounded-md border border-dashed p-12 text-center text-sm text-slate-500">
                Nenhuma turma cadastrada para este curso.
                <br />
                <span className="text-xs">
                  Clique em "Nova turma" no topo para criar.
                </span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Turma</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Professor</TableHead>
                    <TableHead>Lotação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {course.classes.map((cls) => {
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
                        <TableCell>
                          {dias.length > 0 || schedule?.time ? (
                            <div className="text-xs">
                              <div className="flex flex-wrap gap-1">
                                {dias.map((d) => (
                                  <Badge key={d} variant="info">
                                    {DAY_LABELS[d]}
                                  </Badge>
                                ))}
                              </div>
                              {schedule?.time && (
                                <div className="mt-0.5 text-slate-600">
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
                        </TableCell>
                        <TableCell>
                          <Badge variant={CLASS_STATUS_VARIANTS[cls.status]}>
                            {cls.status.replace("_", " ")}
                          </Badge>
                          <div className="mt-1 text-xs text-slate-500">
                            <Calendar className="inline h-3 w-3" />{" "}
                            {formatDate(cls.startDate)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/admin/turmas/${cls.id}`}>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
