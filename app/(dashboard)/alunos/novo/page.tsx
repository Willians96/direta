import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StudentForm } from "../student-form";

export const dynamic = "force-dynamic";

export default async function NovoAlunoPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user) redirect("/login");
  if (role !== "ADMIN" && role !== "RECEPCAO") redirect(`/${role?.toLowerCase()}`);

  const [courses, classes] = await Promise.all([
    prisma.course.findMany({
      where: { status: "ATIVO" },
      select: { id: true, name: true, price: true },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({
      select: {
        id: true,
        name: true,
        course: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Novo aluno"
        description="Cadastro direto de aluno — sem passar pelo funil de vendas"
        icon={UserPlus}
        action={
          <Button asChild variant="outline">
            <Link href="/alunos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <p className="text-sm text-slate-600">
          Use esta tela quando o aluno chegar na escola e já quiser matricular — sem
          passar por captação e vendas. O sistema cria a matrícula e registra o lead de
          apoio com a fonte <strong>Avulso</strong>.
        </p>

        <StudentForm
          mode="novo"
          courses={courses.map((c) => ({ ...c, price: Number(c.price) }))}
          classes={classes.map((c) => ({ id: c.id, name: c.name, courseName: c.course.name }))}
          erro={searchParams.erro ?? null}
        />
      </div>
    </div>
  );
}
