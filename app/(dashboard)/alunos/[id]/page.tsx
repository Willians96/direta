import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  UserRound,
  Pencil,
  ArrowLeft,
  GraduationCap,
  MapPin,
  Phone,
  Mail,
  FileText,
  Download,
  History,
  Wallet,
  CalendarDays,
  UserCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { auth } from "@/lib/auth";
import {
  getStudentDetail,
  situacaoDoAluno,
  SITUACAO_LABELS,
  SITUACAO_VARIANTS,
} from "@/lib/alunos";
import { updateStudentStatusAction } from "@/lib/actions/alunos";
import { documentTypeLabel, documentTypeVariant } from "@/lib/document-types";
import { formatCurrency, formatDate, formatDateTime, formatPhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Linha "rótulo: valor" usada nos cards de dados. */
function Dado({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm text-slate-700 ${mono ? "tabular-nums" : ""}`}>
        {value ?? "—"}
      </p>
    </div>
  );
}

export default async function AlunoDetalhePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user) redirect("/login");
  if (role !== "ADMIN" && role !== "RECEPCAO") redirect(`/${role?.toLowerCase()}`);

  const aluno = await getStudentDetail(params.id);
  if (!aluno) notFound();

  const situacao = situacaoDoAluno(aluno.classId, aluno.lead.classStudents);
  const vinculo = aluno.lead.classStudents.find((c) => c.classId === aluno.classId);
  const endereco = [
    aluno.addressStreet,
    aluno.addressNumber,
    aluno.addressComplement,
  ]
    .filter(Boolean)
    .join(", ");
  const cidade = [aluno.addressCity, aluno.addressState].filter(Boolean).join(" - ");

  const paymentLabels: Record<string, string> = {
    PIX: "PIX",
    BOLETO: "Boleto",
    CARTAO_CREDITO: "Cartão de crédito",
    CARTAO_DEBITO: "Cartão de débito",
    DINHEIRO: "Dinheiro",
    TRANSFERENCIA: "Transferência",
    PARCELADO_PROPRIO: "Parcelado próprio",
    OUTRO: "Outro",
  };

  return (
    <div>
      <PageHeader
        title={aluno.fullName}
        description={`${aluno.course.name}${
          aluno.class ? ` · ${aluno.class.name}` : " · sem turma"
        }`}
        icon={UserRound}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/alunos">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/alunos/${aluno.id}/editar`}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar cadastro
              </Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* Situação + ações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-4 w-4 text-direta-orange" />
              Situação do aluno
            </CardTitle>
            <CardDescription>
              A situação vem do vínculo com a turma. Aluno sem turma não pode ser
              trancado/concluído — aloque-o em uma turma primeiro.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Badge variant={SITUACAO_VARIANTS[situacao]} className="text-sm">
              {SITUACAO_LABELS[situacao]}
            </Badge>

            {aluno.classId && (
              <div className="flex flex-wrap gap-2">
                {situacao !== "TRANCADA" && situacao !== "CANCELADA" && (
                  <form
                    action={async () => {
                      "use server";
                      await updateStudentStatusAction(aluno.id, "TRANCADA");
                    }}
                  >
                    <Button type="submit" variant="outline" size="sm">
                      <span className="mr-1">⏸</span> Trancar
                    </Button>
                  </form>
                )}
                {situacao === "TRANCADA" && (
                  <form
                    action={async () => {
                      "use server";
                      await updateStudentStatusAction(aluno.id, "ATIVA");
                    }}
                  >
                    <Button type="submit" variant="outline" size="sm">
                      <span className="mr-1">▶</span> Reativar
                    </Button>
                  </form>
                )}
                {situacao !== "CONCLUIDA" && (
                  <form
                    action={async () => {
                      "use server";
                      await updateStudentStatusAction(aluno.id, "CONCLUIDA");
                    }}
                  >
                    <Button type="submit" variant="outline" size="sm">
                      <span className="mr-1">✓</span> Concluir curso
                    </Button>
                  </form>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Dados do cadastro */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="h-4 w-4 text-direta-orange" />
                Cadastro
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Dado label="Nome completo" value={aluno.fullName} />
              <Dado
                label="Nascimento"
                value={aluno.birthDate ? formatDate(aluno.birthDate) : null}
              />
              <Dado label="CPF" value={aluno.cpf} mono />
              <Dado label="RG" value={aluno.rg} mono />
              <Dado
                label="Telefone"
                value={
                  aluno.phone ? (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      {formatPhone(aluno.phone)}
                    </span>
                  ) : null
                }
              />
              <Dado
                label="Telefone 2"
                value={aluno.phone2 ? formatPhone(aluno.phone2) : null}
              />
              <div className="col-span-2">
                <Dado
                  label="E-mail"
                  value={
                    aluno.email ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        {aluno.email}
                      </span>
                    ) : null
                  }
                />
              </div>
              <div className="col-span-2">
                <Dado
                  label="Endereço"
                  value={
                    endereco || cidade ? (
                      <span className="inline-flex items-start gap-1">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span>
                          {endereco}
                          {cidade ? ` — ${cidade}` : ""}
                          {aluno.addressZip ? ` — CEP ${aluno.addressZip}` : ""}
                        </span>
                      </span>
                    ) : null
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Matrícula */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="h-4 w-4 text-direta-orange" />
                Matrícula
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Dado label="Curso" value={aluno.course.name} />
              <Dado
                label="Turma"
                value={
                  aluno.class ? (
                    <Link
                      href={`/admin/turmas/${aluno.class.id}`}
                      className="text-direta-orange hover:underline"
                    >
                      {aluno.class.name}
                      {aluno.class.code ? ` (${aluno.class.code})` : ""}
                    </Link>
                  ) : (
                    "Sem turma"
                  )
                }
              />
              <Dado label="Professor" value={aluno.class?.professor?.name ?? null} />
              <Dado
                label="Período"
                value={
                  aluno.class
                    ? `${formatDate(aluno.class.startDate)}${
                        aluno.class.endDate ? ` → ${formatDate(aluno.class.endDate)}` : ""
                      }`
                    : null
                }
              />
              <Dado
                label="Data da matrícula"
                value={
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                    {formatDate(aluno.createdAt)}
                  </span>
                }
              />
              <Dado
                label="Pagamento"
                value={aluno.paymentMethod ? paymentLabels[aluno.paymentMethod] : null}
              />
              <Dado label="Parcelas" value={`${aluno.installments}x`} />
              <Dado
                label="Valor total"
                value={
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <Wallet className="h-3.5 w-3.5" />
                    {formatCurrency(Number(aluno.totalAmount))}
                  </span>
                }
              />
              {vinculo?.finishedAt && (
                <Dado label="Concluído em" value={formatDate(vinculo.finishedAt)} />
              )}
              {aluno.paymentDetails && (
                <div className="col-span-2">
                  <Dado label="Detalhes do pagamento" value={aluno.paymentDetails} />
                </div>
              )}
              {aluno.notes && (
                <div className="col-span-2">
                  <Dado label="Observações" value={aluno.notes} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Origem */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Origem do aluno</CardTitle>
            <CardDescription>
              De onde veio o aluno e quem conduziu o atendimento.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Dado label="Fonte" value={aluno.lead.source ?? null} />
            <Dado label="Campanha" value={aluno.lead.campaign?.name ?? null} />
            <Dado label="Atendente" value={aluno.lead.assignedTo?.name ?? null} />
            <Dado label="Status do lead" value={<StatusBadge status={aluno.lead.status} />} />
          </CardContent>
        </Card>

        {/* Documentos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-direta-orange" />
              Documentos ({aluno.lead.documents.length})
            </CardTitle>
            <CardDescription>
              Documentos enviados no atendimento. Para incluir novos, use a aba
              Documentos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {aluno.lead.documents.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum documento anexado a este aluno.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {aluno.lead.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{doc.fileName}</p>
                      <p className="text-xs text-slate-500">
                        {documentTypeLabel(doc.type)} · {formatDate(doc.uploadedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={documentTypeVariant(doc.type)}>
                        {documentTypeLabel(doc.type)}
                      </Badge>
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={`/api/documents/${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Abrir
                        </a>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <a href={`/api/documents/${doc.id}?download=1`}>
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Histórico */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-direta-orange" />
              Histórico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-500">
                Acionamentos ({aluno.lead.followups.length})
              </p>
              {aluno.lead.followups.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum acionamento registrado.</p>
              ) : (
                <ul className="space-y-2">
                  {aluno.lead.followups.map((f) => (
                    <li key={f.id} className="rounded-md border bg-white p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{f.type}</span>
                        <span className="text-xs text-slate-500">
                          {formatDateTime(f.occurredAt)} · {f.user?.name ?? "—"}
                        </span>
                      </div>
                      {f.notes && <p className="mt-1 text-slate-600">{f.notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-500">
                Auditoria ({aluno.lead.audits.length})
              </p>
              {aluno.lead.audits.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum registro de auditoria.</p>
              ) : (
                <ul className="space-y-2">
                  {aluno.lead.audits.map((a) => (
                    <li key={a.id} className="rounded-md border bg-white p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{a.action.replace(/_/g, " ")}</span>
                        <span className="text-xs text-slate-500">
                          {formatDateTime(a.createdAt)} · {a.actor?.name ?? "—"}
                        </span>
                      </div>
                      {a.details && <p className="mt-1 text-slate-600">{a.details}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
