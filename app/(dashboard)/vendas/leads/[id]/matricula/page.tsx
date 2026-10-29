import Link from "next/link";
import { redirect, notFound } from "next/navigation";

export const dynamic = "force-dynamic";

import {
  ArrowLeft,
  GraduationCap,
  Save,
  Banknote,
  MapPin,
  User,
  Calendar,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEnrollmentAction } from "@/lib/actions/enrollments";
import { PaymentMethod } from "@prisma/client";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_DEBITO: "Cartão de débito",
  DINHEIRO: "Dinheiro",
  TRANSFERENCIA: "Transferência",
  PARCELADO_PROPRIO: "Parcelado próprio",
  OUTRO: "Outro",
};

export default async function MatriculaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;
  const role = (session.user as any).role as string;

  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      course: { select: { id: true, name: true, price: true } },
      enrollment: { select: { id: true, totalAmount: true } },
    },
  });
  if (!lead) notFound();
  if (role === "VENDAS" && lead.assignedToId !== userId) {
    redirect("/vendas/leads");
  }

  const [courses, classes] = await Promise.all([
    prisma.course.findMany({
      where: { status: "ATIVO" },
      select: { id: true, name: true, price: true },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({
      where: { status: { in: ["ABERTA", "EM_ANDAMENTO"] } },
      include: { course: { select: { name: true } } },
      orderBy: { startDate: "asc" },
    }),
  ]);

  if (lead.enrollment) {
    return (
      <div className="p-4 md:p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="text-base">Matrícula já realizada</CardTitle>
            <CardDescription>
              Este lead já possui matrícula registrada no sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/vendas/leads/${lead.id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao lead
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const defaultCourseId = lead.course?.id ?? courses[0]?.id ?? "";
  const defaultAmount = lead.course?.price ? Number(lead.course.price) : 0;

  return (
    <div>
      <PageHeader
        title="Realizar Matrícula"
        description={`${lead.fullName} · dados definitivos do aluno`}
        icon={GraduationCap}
        action={
          <Button variant="outline" asChild>
            <Link href={`/vendas/leads/${lead.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <div className="p-4 md:p-6">
        <EnrollmentForm
          leadId={lead.id}
          courses={courses.map((c) => ({
            id: c.id,
            name: c.name,
            price: Number(c.price),
          }))}
          classes={classes.map((c) => ({
            id: c.id,
            name: c.name,
            courseName: c.course.name,
          }))}
          defaultCourseId={defaultCourseId}
          defaultAmount={defaultAmount}
          defaultValues={{
            fullName: lead.fullName,
            phone: lead.phone,
            phone2: lead.phone2 ?? "",
            email: lead.email ?? "",
            cpf: lead.cpf ?? "",
          }}
        />
      </div>
    </div>
  );
}

// ============================================
// FORM (client component)
// ============================================

function EnrollmentForm({
  leadId,
  courses,
  classes,
  defaultCourseId,
  defaultAmount,
  defaultValues,
}: {
  leadId: string;
  courses: { id: string; name: string; price: number }[];
  classes: { id: string; name: string; courseName: string }[];
  defaultCourseId: string;
  defaultAmount: number;
  defaultValues: {
    fullName: string;
    phone: string;
    phone2: string;
    email: string;
    cpf: string;
  };
}) {
  return (
    <form
      action={async (formData) => {
        "use server";
        await createEnrollmentAction({
          leadId,
          courseId: (formData.get("courseId") as string) || "",
          classId: (formData.get("classId") as string) || "",
          fullName: (formData.get("fullName") as string) || "",
          birthDate: (formData.get("birthDate") as string) || "",
          cpf: (formData.get("cpf") as string) || "",
          rg: (formData.get("rg") as string) || "",
          phone: (formData.get("phone") as string) || "",
          phone2: (formData.get("phone2") as string) || "",
          email: (formData.get("email") as string) || "",
          addressStreet: (formData.get("addressStreet") as string) || "",
          addressNumber: (formData.get("addressNumber") as string) || "",
          addressComplement: (formData.get("addressComplement") as string) || "",
          addressCity: (formData.get("addressCity") as string) || "",
          addressState: (formData.get("addressState") as string) || "",
          addressZip: (formData.get("addressZip") as string) || "",
          paymentMethod: ((formData.get("paymentMethod") as string) ||
            "") as PaymentMethod | "",
          paymentDetails: (formData.get("paymentDetails") as string) || "",
          installments: Number(formData.get("installments") || 1),
          totalAmount: Number(formData.get("totalAmount") || 0),
          notes: (formData.get("notes") as string) || "",
        });
        redirect(`/vendas/leads/${leadId}`);
      }}
      className="max-w-4xl space-y-4"
    >
      <input type="hidden" name="leadId" value={leadId} />

      {/* Aluno */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-direta-orange" />
            Dados do aluno
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="fullName">Nome completo *</Label>
            <Input
              id="fullName"
              name="fullName"
              defaultValue={defaultValues.fullName}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="birthDate">Data de nascimento</Label>
            <Input id="birthDate" name="birthDate" type="date" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              name="cpf"
              defaultValue={defaultValues.cpf}
              placeholder="000.000.000-00"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="rg">RG</Label>
            <Input id="rg" name="rg" placeholder="00.000.000-0" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={defaultValues.email}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              name="phone"
              defaultValue={defaultValues.phone}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="phone2">2º telefone</Label>
            <Input
              id="phone2"
              name="phone2"
              defaultValue={defaultValues.phone2}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Curso e turma */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4 text-direta-orange" />
            Curso e turma
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="courseId">Curso *</Label>
            <select
              id="courseId"
              name="courseId"
              defaultValue={defaultCourseId}
              required
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Selecione...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — R$ {c.price.toFixed(2)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="classId">Turma</Label>
            <select
              id="classId"
              name="classId"
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Sem turma específica</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.courseName}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-direta-orange" />
            Endereço
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label htmlFor="addressStreet">Logradouro</Label>
            <Input id="addressStreet" name="addressStreet" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="addressNumber">Número</Label>
            <Input id="addressNumber" name="addressNumber" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="addressComplement">Complemento</Label>
            <Input id="addressComplement" name="addressComplement" className="mt-1" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="addressCity">Cidade</Label>
            <Input id="addressCity" name="addressCity" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="addressState">UF</Label>
            <Input id="addressState" name="addressState" maxLength={2} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="addressZip">CEP</Label>
            <Input id="addressZip" name="addressZip" placeholder="00000-000" className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4 text-direta-orange" />
            Pagamento
          </CardTitle>
          <CardDescription>
            Ao salvar, o lead é marcado como <strong>Matriculado</strong> e sai do
            funil do vendedor.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="totalAmount">Valor total (R$) *</Label>
            <Input
              id="totalAmount"
              name="totalAmount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={defaultAmount}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="paymentMethod">Forma de pagamento</Label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Selecione...</option>
              {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="installments">Parcelas</Label>
            <Input
              id="installments"
              name="installments"
              type="number"
              min="1"
              max="60"
              defaultValue={1}
              className="mt-1"
            />
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="paymentDetails">Condições / detalhes</Label>
            <Input
              id="paymentDetails"
              name="paymentDetails"
              placeholder="Ex: 3x R$ 450 sem juros — entrada de R$ 200"
              className="mt-1"
            />
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="notes">Observações da matrícula</Label>
            <Textarea id="notes" name="notes" rows={3} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit">
          <Save className="mr-2 h-4 w-4" />
          Confirmar matrícula
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={`/vendas/leads/${leadId}`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
