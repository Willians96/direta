import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

import {
  ArrowLeft,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  FileText,
  Upload,
  CheckCircle2,
  User,
  GraduationCap,
  ExternalLink,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { SalesStatusBadge } from "@/components/shared/sales-status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { RegisterFollowupDialog } from "@/components/shared/followups/register-followup-dialog";
import { FollowupHistoryTable } from "@/components/shared/followups/followup-history-table";
import { ChatDialog } from "@/components/shared/messages/chat-dialog";
import { formatDateTime, formatPhone, formatDate } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLeadFollowupHistory } from "@/lib/actions/followups";
import { getLeadMessages } from "@/lib/actions/messages";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      course: { select: { name: true } },
      campaign: { select: { name: true } },
      assignedTo: { select: { id: true, name: true, email: true, phone: true } },
      createdBy: { select: { id: true, name: true } },
      preEnrollment: {
        select: { id: true, status: true, submittedAt: true, decidedAt: true },
      },
      enrollment: {
        select: {
          id: true,
          totalAmount: true,
          installments: true,
          paymentMethod: true,
          courseId: true,
          classId: true,
        },
      },
      documents: {
        orderBy: { uploadedAt: "desc" },
        select: { id: true, type: true, fileName: true, uploadedAt: true },
      },
    },
  });

  if (!lead) notFound();

  // Vendedor só vê leads atribuídos a ele (admin/captação veem todos)
  if ((session.user as any).role === "VENDAS" && lead.assignedToId !== session.user.id) {
    redirect("/vendas/leads");
  }

  const [followups, messages] = await Promise.all([
    getLeadFollowupHistory(lead.id),
    getLeadMessages(lead.id),
  ]);

  const docsByType = new Set(lead.documents.map((d) => d.type));
  // Documentos padrão definidos pela cliente
  const docsChecklist = [
    { type: "RG", label: "RG", present: docsByType.has("RG") },
    { type: "CPF", label: "CPF", present: docsByType.has("CPF") },
    { type: "COMPRO_ENDERECO", label: "Comprovante de Endereço", present: docsByType.has("COMPRO_ENDERECO") },
    { type: "COMPRO_PAGAMENTO", label: "Comprovante de Pagamento", present: docsByType.has("COMPRO_PAGAMENTO") },
    { type: "FOTO_ALUNO", label: "Foto do Aluno", present: docsByType.has("FOTO_ALUNO") },
  ];

  return (
    <div>
      <PageHeader
        title={lead.fullName}
        description={`Lead #${lead.id.slice(-6).toUpperCase()} · ${lead.course?.name ?? "Sem curso"}`}
        icon={User}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/vendas/leads">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <RegisterFollowupDialog leadId={lead.id} leadName={lead.fullName} />
          </div>
        }
      />

      <div className="grid gap-4 p-4 md:p-6 lg:grid-cols-3">
        {/* Coluna principal */}
        <div className="space-y-4 lg:col-span-2">
          {/* Informações + status */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">Informações do lead</CardTitle>
                  <CardDescription>
                    Atribuído para {lead.assignedTo?.name ?? "Ninguém"} · criado em {formatDate(lead.createdAt)}
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <SalesStatusBadge status={lead.salesStatus} />
                  <span className="text-[10px] text-slate-400">
                    Status do cliente (vendedor)
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-slate-500">Telefone principal</div>
                <div className="font-medium">{formatPhone(lead.phone)}</div>
              </div>
              <div>
                <div className="text-slate-500">E-mail</div>
                <div className="font-medium">{lead.email ?? "—"}</div>
              </div>
              {lead.phone2 && (
                <div>
                  <div className="text-slate-500">2º telefone</div>
                  <div className="font-medium">{formatPhone(lead.phone2)}</div>
                </div>
              )}
              {lead.phone3 && (
                <div>
                  <div className="text-slate-500">3º telefone</div>
                  <div className="font-medium">{formatPhone(lead.phone3)}</div>
                </div>
              )}
              <div>
                <div className="text-slate-500">Fonte (como conheceu a escola)</div>
                <div className="font-medium">{lead.source ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">Curso de interesse</div>
                <div className="font-medium">{lead.course?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">Campanha</div>
                <div className="font-medium">{lead.campaign?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">CPF</div>
                <div className="font-medium">{lead.cpf ?? "—"}</div>
              </div>
              {lead.notes && (
                <div className="col-span-2">
                  <div className="text-slate-500">Observações</div>
                  <div className="font-medium">{lead.notes}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Histórico de Follow-ups em tabela (formato da cliente) */}
          <FollowupHistoryTable items={followups} />

          {/* Pré-matrícula */}
          {lead.preEnrollment && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pré-matrícula</CardTitle>
                <CardDescription>
                  Status: {lead.preEnrollment.status}
                  {lead.preEnrollment.submittedAt &&
                    ` · Enviada em ${formatDate(lead.preEnrollment.submittedAt)}`}
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4">
          {/* Ações rápidas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ações rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ChatDialog
                leadId={lead.id}
                leadName={lead.fullName}
                leadPhone={lead.phone}
                initialMessages={messages}
                triggerLabel="Abrir Conversa"
                triggerVariant="default"
              />
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href={`tel:${lead.phone.replace(/\D/g, "")}`}>
                  <Phone className="mr-2 h-4 w-4" />
                  Ligar
                </a>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <a
                  href={`mailto:${lead.email ?? ""}?subject=${encodeURIComponent(
                    `Contato — ${lead.course?.name ?? "Direta Cursos"}`,
                  )}`}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar Email
                </a>
              </Button>
              <RegisterFollowupDialog
                leadId={lead.id}
                leadName={lead.fullName}
                triggerLabel="Registrar Follow-up"
                triggerVariant="outline"
              />
              {lead.enrollment ? (
                <div className="flex w-full items-center justify-start rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Matrícula realizada
                </div>
              ) : (
                <Button className="w-full justify-start" asChild>
                  <Link href={`/vendas/leads/${lead.id}/matricula`}>
                    <GraduationCap className="mr-2 h-4 w-4" />
                    Realizar Matrícula
                  </Link>
                </Button>
              )}
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href={`/vendas/documentos`}>
                  <FileText className="mr-2 h-4 w-4" />
                  Gerenciar documentos
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Checklist de documentos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Documentos ({docsChecklist.filter((d) => d.present).length}/{docsChecklist.length})
              </CardTitle>
              <CardDescription>
                Obrigatórios para enviar à Recepção
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {docsChecklist.map((doc) => (
                <div
                  key={doc.type}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      doc.present
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {doc.present ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{doc.label}</div>
                    {doc.present ? (
                      <div className="text-xs text-slate-500">
                        {(() => {
                          const docId = lead.documents.find(
                            (d) => d.type === doc.type
                          )?.id;
                          const fileName = lead.documents.find(
                            (d) => d.type === doc.type
                          )?.fileName;
                          if (!docId) return fileName;
                          return (
                            <a
                              href={`/api/documents/${docId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-direta-orange hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {fileName}
                            </a>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="text-xs text-amber-600">Pendente</div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
