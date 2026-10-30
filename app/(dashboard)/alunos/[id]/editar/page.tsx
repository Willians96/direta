import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StudentForm, type AlunoFormValues } from "../../student-form";

export const dynamic = "force-dynamic";

/** Data no formato do input date (yyyy-mm-dd). */
function dataInput(value: Date | null): string {
  if (!value) return "";
  const d = new Date(value);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export default async function EditarAlunoPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { erro?: string };
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user) redirect("/login");
  if (role !== "ADMIN" && role !== "RECEPCAO") redirect(`/${role?.toLowerCase()}`);

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      fullName: true,
      birthDate: true,
      cpf: true,
      rg: true,
      phone: true,
      phone2: true,
      email: true,
      addressStreet: true,
      addressNumber: true,
      addressComplement: true,
      addressCity: true,
      addressState: true,
      addressZip: true,
      courseId: true,
      classId: true,
      paymentMethod: true,
      paymentDetails: true,
      installments: true,
      totalAmount: true,
      notes: true,
    },
  });
  if (!enrollment) notFound();

  const [courses, classes] = await Promise.all([
    prisma.course.findMany({
      where: { status: "ATIVO" },
      select: { id: true, name: true, price: true },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({
      select: { id: true, name: true, course: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const defaultValues: AlunoFormValues = {
    fullName: enrollment.fullName,
    birthDate: dataInput(enrollment.birthDate),
    cpf: enrollment.cpf ?? "",
    rg: enrollment.rg ?? "",
    phone: enrollment.phone,
    phone2: enrollment.phone2 ?? "",
    email: enrollment.email ?? "",
    addressStreet: enrollment.addressStreet ?? "",
    addressNumber: enrollment.addressNumber ?? "",
    addressComplement: enrollment.addressComplement ?? "",
    addressCity: enrollment.addressCity ?? "",
    addressState: enrollment.addressState ?? "",
    addressZip: enrollment.addressZip ?? "",
    courseId: enrollment.courseId,
    classId: enrollment.classId ?? "",
    paymentMethod: enrollment.paymentMethod ?? "",
    paymentDetails: enrollment.paymentDetails ?? "",
    installments: String(enrollment.installments),
    totalAmount: String(Number(enrollment.totalAmount)),
    notes: enrollment.notes ?? "",
  };

  return (
    <div>
      <PageHeader
        title={`Editar cadastro — ${enrollment.fullName}`}
        description="Atualize os dados definitivos do aluno"
        icon={Pencil}
        action={
          <Button asChild variant="outline">
            <Link href={`/alunos/${enrollment.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <StudentForm
          mode="editar"
          enrollmentId={enrollment.id}
          courses={courses.map((c) => ({ ...c, price: Number(c.price) }))}
          classes={classes.map((c) => ({ id: c.id, name: c.name, courseName: c.course.name }))}
          defaultValues={defaultValues}
          erro={searchParams.erro ?? null}
        />
      </div>
    </div>
  );
}
