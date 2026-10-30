import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, GraduationCap, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentMethod } from "@prisma/client";
import {
  createStudentAction,
  updateStudentAction,
  type AlunoInput,
} from "@/lib/actions/alunos";

/**
 * Sprint 20 — formulário do cadastro do aluno.
 *
 * O mesmo formulário serve para o cadastro direto (novo) e para a edição
 * da ficha. É um Server Component: a submissão acontece por server action,
 * igual ao formulário de matrícula já existente.
 */

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

export type AlunoFormValues = {
  fullName: string;
  birthDate: string;
  cpf: string;
  rg: string;
  phone: string;
  phone2: string;
  email: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  courseId: string;
  classId: string;
  paymentMethod: string;
  paymentDetails: string;
  installments: string;
  totalAmount: string;
  notes: string;
};

const VALORES_VAZIOS: AlunoFormValues = {
  fullName: "",
  birthDate: "",
  cpf: "",
  rg: "",
  phone: "",
  phone2: "",
  email: "",
  addressStreet: "",
  addressNumber: "",
  addressComplement: "",
  addressCity: "",
  addressState: "",
  addressZip: "",
  courseId: "",
  classId: "",
  paymentMethod: "",
  paymentDetails: "",
  installments: "1",
  totalAmount: "0",
  notes: "",
};

export function StudentForm({
  mode,
  enrollmentId,
  courses,
  classes,
  defaultValues,
  erro,
}: {
  mode: "novo" | "editar";
  enrollmentId?: string;
  courses: { id: string; name: string; price: number }[];
  classes: { id: string; name: string; courseName: string }[];
  defaultValues?: Partial<AlunoFormValues>;
  erro?: string | null;
}) {
  const v = { ...VALORES_VAZIOS, ...(defaultValues ?? {}) };

  return (
    <form
      action={async (formData) => {
        "use server";
        const payload: AlunoInput = {
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
        };

        try {
          if (mode === "editar" && enrollmentId) {
            await updateStudentAction(enrollmentId, payload);
            redirect(`/alunos/${enrollmentId}`);
          }
          const criado = await createStudentAction(payload);
          redirect(`/alunos/${criado.id}`);
        } catch (e: any) {
          // redirect() lança um erro interno — precisa ser repassado
          if (typeof e?.digest === "string" && e.digest.startsWith("NEXT_REDIRECT")) {
            throw e;
          }
          const destino =
            mode === "editar" && enrollmentId ? `/alunos/${enrollmentId}/editar` : "/alunos/novo";
          redirect(`${destino}?erro=${encodeURIComponent(e?.message ?? "Erro ao salvar")}`);
        }
      }}
      className="max-w-4xl space-y-4"
    >
      {erro && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

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
              defaultValue={v.fullName}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="birthDate">Data de nascimento</Label>
            <Input
              id="birthDate"
              name="birthDate"
              type="date"
              defaultValue={v.birthDate}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input id="cpf" name="cpf" defaultValue={v.cpf} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="rg">RG</Label>
            <Input id="rg" name="rg" defaultValue={v.rg} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="phone">Telefone *</Label>
            <Input id="phone" name="phone" defaultValue={v.phone} required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="phone2">Telefone 2</Label>
            <Input id="phone2" name="phone2" defaultValue={v.phone2} className="mt-1" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={v.email}
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
              defaultValue={v.courseId}
              required
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Selecione o curso</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="classId">Turma</Label>
            <select
              id="classId"
              name="classId"
              defaultValue={v.classId}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Sem turma (definir depois)</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.courseName}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-direta-orange" />
            Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="paymentMethod">Forma de pagamento</Label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              defaultValue={v.paymentMethod}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Não informado</option>
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
              min={1}
              max={60}
              defaultValue={v.installments}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="totalAmount">Valor total (R$) *</Label>
            <Input
              id="totalAmount"
              name="totalAmount"
              type="number"
              step="0.01"
              min={0}
              defaultValue={v.totalAmount}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="paymentDetails">Detalhes do pagamento</Label>
            <Input
              id="paymentDetails"
              name="paymentDetails"
              defaultValue={v.paymentDetails}
              className="mt-1"
            />
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
            <Label htmlFor="addressStreet">Rua</Label>
            <Input
              id="addressStreet"
              name="addressStreet"
              defaultValue={v.addressStreet}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="addressNumber">Número</Label>
            <Input
              id="addressNumber"
              name="addressNumber"
              defaultValue={v.addressNumber}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="addressComplement">Complemento</Label>
            <Input
              id="addressComplement"
              name="addressComplement"
              defaultValue={v.addressComplement}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="addressCity">Cidade</Label>
            <Input
              id="addressCity"
              name="addressCity"
              defaultValue={v.addressCity}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="addressState">UF</Label>
            <Input
              id="addressState"
              name="addressState"
              maxLength={2}
              defaultValue={v.addressState}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="addressZip">CEP</Label>
            <Input
              id="addressZip"
              name="addressZip"
              defaultValue={v.addressZip}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Observações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={v.notes}
            placeholder="Anotações sobre o aluno (necessidades,TokCC, pagamento em atraso…)"
          />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit">
          {mode === "editar" ? "Salvar alterações" : "Cadastrar aluno"}
        </Button>
        <Button asChild variant="outline">
          <Link href={mode === "editar" && enrollmentId ? `/alunos/${enrollmentId}` : "/alunos"}>
            Cancelar
          </Link>
        </Button>
      </div>
    </form>
  );
}
