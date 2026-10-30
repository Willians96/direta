import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

import {
  UserPlus,
  ArrowLeft,
  Phone,
  Info,
  GraduationCap,
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
import { createLeadAndRedirect } from "@/lib/actions/leads";
import { SALES_STATUS_OPTIONS } from "@/components/shared/sales-status-badge";

/**
 * Cadastro do Cliente — Sprint 14.
 * Inclui 3 telefones de contato e a "Fonte" (como o cliente conheceu a escola).
 */

const SOURCE_OPTIONS = [
  "Instagram",
  "Facebook",
  "Google",
  "WhatsApp",
  "Indicação",
  "Portão (indicação)",
  "Evento",
  "Outdoor",
  "Escola / aluno",
  "Site",
  "Outro",
];

export default async function NovoLeadPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as any).role as string;
  if (role === "RECEPCAO") redirect("/recepcao");

  const [courses, campaigns, vendedores] = await Promise.all([
    prisma.course.findMany({
      where: { status: "ATIVO" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.campaign.findMany({
      where: { status: "ATIVA" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "VENDAS", status: "ATIVO" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Cadastro do Cliente"
        description="Registre um novo lead com todos os contatos"
        icon={UserPlus}
        action={
          <Button variant="outline" asChild>
            <Link href="/captacao/leads">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <div className="p-4 md:p-6">
        <form action={createLeadAndRedirect} className="max-w-4xl space-y-4">
          {/* Dados principais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados do cliente</CardTitle>
              <CardDescription>
                Nome e documentos básicos para identificação
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="fullName">Nome completo *</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  placeholder="Ex: Carlos Silva"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" name="cpf" placeholder="000.000.000-00" className="mt-1" />
              </div>

              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="cliente@email.com"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* 3 telefones */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-4 w-4 text-direta-orange" />
                Telefones de contato
              </CardTitle>
              <CardDescription>
                O primeiro é obrigatório; os demais são alternativos (ex: celular do
                cônjuge, telefone do trabalho)
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="phone">Telefone principal *</Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="(11) 98765-4321"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="phone2">2º telefone</Label>
                <Input id="phone2" name="phone2" placeholder="Opcional" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="phone3">3º telefone</Label>
                <Input id="phone3" name="phone3" placeholder="Opcional" className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Fonte + classificação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4 text-direta-orange" />
                Origem e classificação
              </CardTitle>
              <CardDescription>
                Como o cliente conheceu a escola e a situação atual
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="source">Fonte (como conheceu a escola)</Label>
                <select
                  id="source"
                  name="source"
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">Selecione...</option>
                  {SOURCE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-slate-500">
                  Se a opção for &quot;Outro&quot;, informe a origem nas observações.
                </p>
              </div>

              <div>
                <Label htmlFor="salesStatus">Status do cliente</Label>
                <select
                  id="salesStatus"
                  name="salesStatus"
                  defaultValue="NEGOCIANDO"
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  {SALES_STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="priority">Prioridade</Label>
                <select
                  id="priority"
                  name="priority"
                  defaultValue="MEDIA"
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Média</option>
                  <option value="BAIXA">Baixa</option>
                </select>
              </div>

              <div>
                <Label htmlFor="assignedToId">Vendedor responsável</Label>
                <select
                  id="assignedToId"
                  name="assignedToId"
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">Não atribuir agora</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Curso + campanha */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="h-4 w-4 text-direta-orange" />
                Interesse e campanha
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="courseId">Curso de interesse</Label>
                <select
                  id="courseId"
                  name="courseId"
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">Selecione...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="campaignId">Campanha de origem</Label>
                <select
                  id="campaignId"
                  name="campaignId"
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">Nenhuma</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  placeholder="Detalhes do contato, origem se for &quot;Outro&quot;, preferência do cliente..."
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit">Cadastrar cliente</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/captacao/leads">Cancelar</Link>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
