import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
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
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { CourseFormDialog } from "./course-form-dialog";

export const dynamic = "force-dynamic";

const STATUS_VARIANTS: Record<string, "success" | "warning" | "neutral"> = {
  ATIVO: "success",
  EM_BREVE: "warning",
  INATIVO: "neutral",
};

export default async function AdminCursosPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") {
    redirect("/");
  }

  const courses = await prisma.course.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { classes: true, leads: true },
      },
    },
  });

  const totalAtivos = courses.filter((c) => c.status === "ATIVO").length;
  const totalEmBreve = courses.filter((c) => c.status === "EM_BREVE").length;

  return (
    <div>
      <PageHeader
        title="Cursos"
        description="Catálogo de cursos, cargas horárias e preços"
        icon={GraduationCap}
        action={<CourseFormDialog />}
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{courses.length}</p>
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
                Em breve
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-600">{totalEmBreve}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Catálogo de cursos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Carga horária</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Turmas</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500">
                      Nenhum curso cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  courses.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.name}</div>
                        {c.description && (
                          <div className="text-xs text-slate-500 line-clamp-1">
                            {c.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {c.workloadHours}h
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(Number(c.price))}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {c._count.classes}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {c._count.leads}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[c.status]}>
                          {c.status === "ATIVO"
                            ? "Ativo"
                            : c.status === "EM_BREVE"
                            ? "Em breve"
                            : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <CourseFormDialog
                          course={{
                            id: c.id,
                            name: c.name,
                            description: c.description,
                            workloadHours: c.workloadHours,
                            price: c.price,
                            syllabus: c.syllabus,
                            status: c.status,
                          }}
                        />
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
