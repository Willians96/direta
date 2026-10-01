import { redirect } from "next/navigation";
import Link from "next/link";
import { GraduationCap, CreditCard, ExternalLink } from "lucide-react";
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
import { formatCurrency } from "@/lib/utils";
import { CourseFormDialog } from "./course-form-dialog";

export const dynamic = "force-dynamic";

const STATUS_VARIANTS: Record<string, "success" | "warning" | "neutral"> = {
  ATIVO: "success",
  EM_BREVE: "warning",
  INATIVO: "neutral",
};

const PAYMENT_LABELS: Record<string, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CARTAO_CREDITO: "Crédito",
  CARTAO_DEBITO: "Débito",
  DINHEIRO: "Dinheiro",
  TRANSFERENCIA: "Transf.",
  PARCELADO_PROPRIO: "Parcelado",
  OUTRO: "Outro",
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
      paymentMethods: {
        where: { active: true },
        orderBy: { method: "asc" },
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
                  <TableHead>Formas pgto.</TableHead>
                  <TableHead>Turmas</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500">
                      Nenhum curso cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  courses.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">
                          <Link
                            href={`/admin/cursos/${c.id}`}
                            className="hover:text-direta-orange hover:underline"
                          >
                            {c.name}
                          </Link>
                        </div>
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
                      <TableCell>
                        {c.paymentMethods.length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {c.paymentMethods.slice(0, 3).map((pm) => (
                              <Badge
                                key={pm.id}
                                variant="info"
                                className="text-[10px]"
                              >
                                <CreditCard className="mr-0.5 h-2.5 w-2.5" />
                                {PAYMENT_LABELS[pm.method] ?? pm.method}
                              </Badge>
                            ))}
                            {c.paymentMethods.length > 3 && (
                              <Badge variant="neutral" className="text-[10px]">
                                +{c.paymentMethods.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/turmas?curso=${c.id}`}
                          className="text-sm font-medium text-slate-700 hover:text-direta-orange hover:underline"
                        >
                          {c._count.classes}
                        </Link>
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
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/admin/cursos/${c.id}`}>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                          <CourseFormDialog
                            course={{
                              id: c.id,
                              name: c.name,
                              description: c.description,
                              workloadHours: c.workloadHours,
                              price: c.price,
                              syllabus: c.syllabus,
                              status: c.status,
                              paymentMethods: c.paymentMethods,
                            }}
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
