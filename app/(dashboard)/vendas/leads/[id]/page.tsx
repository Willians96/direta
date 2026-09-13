import Link from "next/link";

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
import { PageHeader } from "@/components/shared/page-header";
import { formatDateTime, formatPhone } from "@/lib/utils";

// Demo
const LEAD = {
  id: "1",
  nome: "Carlos Silva",
  telefone: "(11) 98765-4321",
  email: "carlos@email.com",
  curso: "Eletricista Industrial",
  status: "EM_NEGOCIACAO",
  criadoEm: "2026-09-10",
  atribuicao: "Ana Paula",
};

const INTERACOES = [
  { tipo: "ligacao", descricao: "Cliente interessado no curso, pediu detalhes sobre horário.", quando: "2026-09-11 14:30", autor: "Ana Paula" },
  { tipo: "whatsapp", descricao: "Enviei tabela de preços e formas de pagamento.", quando: "2026-09-11 15:10", autor: "Ana Paula" },
  { tipo: "reuniao", descricao: "Reunião presencial agendada para próxima segunda.", quando: "2026-09-12 09:00", autor: "Ana Paula" },
];

const DOCUMENTOS = [
  { tipo: "CPF", arquivo: "cpf-carlos.pdf", enviado: true },
  { tipo: "RG", arquivo: "rg-carlos.pdf", enviado: true },
  { tipo: "Comprovante de Residência", arquivo: "comprovante.pdf", enviado: true },
  { tipo: "Histórico Escolar", arquivo: null, enviado: false },
];

const INTERACTION_ICONS: Record<string, any> = {
  ligacao: Phone,
  whatsapp: MessageSquare,
  email: Mail,
  reuniao: Calendar,
  visita: User,
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <PageHeader
        title={LEAD.nome}
        description={`Lead #${id} · ${LEAD.curso}`}
        icon={User}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/vendas/leads">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <Button>
              Atualizar status
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 p-4 md:p-6 lg:grid-cols-3">
        {/* Coluna principal */}
        <div className="space-y-4 lg:col-span-2">
          {/* Informações + status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Informações do lead</CardTitle>
                  <CardDescription>
                    Atribuído para {LEAD.atribuicao} · criado em {formatDateTime(LEAD.criadoEm)}
                  </CardDescription>
                </div>
                <StatusBadge status={LEAD.status as any} />
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-slate-500">Telefone</div>
                <div className="font-medium">{formatPhone(LEAD.telefone)}</div>
              </div>
              <div>
                <div className="text-slate-500">E-mail</div>
                <div className="font-medium">{LEAD.email}</div>
              </div>
              <div>
                <div className="text-slate-500">Curso de interesse</div>
                <div className="font-medium">{LEAD.curso}</div>
              </div>
              <div>
                <div className="text-slate-500">Vendedor</div>
                <div className="font-medium">{LEAD.atribuicao}</div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline de interações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de interações</CardTitle>
              <CardDescription>
                Linha do tempo de contatos com o lead
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-4 border-l-2 border-slate-200 pl-6">
                {INTERACOES.map((it, i) => {
                  const Icon = INTERACTION_ICONS[it.tipo] || MessageSquare;
                  return (
                    <div key={i} className="relative">
                      <div className="absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full bg-white ring-2 ring-blue-500">
                        <Icon className="h-3 w-3 text-blue-600" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="font-medium capitalize text-slate-900">
                          {it.tipo}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatDateTime(it.quando)}
                        </div>
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {it.descricao}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        por {it.autor}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button variant="outline" className="mt-4 w-full">
                <MessageSquare className="mr-2 h-4 w-4" />
                Registrar nova interação
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4">
          {/* Ações rápidas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ações rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <MessageSquare className="mr-2 h-4 w-4" />
                Enviar WhatsApp
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Phone className="mr-2 h-4 w-4" />
                Registrar ligação
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="mr-2 h-4 w-4" />
                Agendar reunião
              </Button>
              <Button className="w-full justify-start" asChild>
                <Link href={`/vendas/pre-matricula/${id}`}>
                  <FileText className="mr-2 h-4 w-4" />
                  Fazer pré-matrícula
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Checklist de documentos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documentos ({DOCUMENTOS.filter(d => d.enviado).length}/{DOCUMENTOS.length})</CardTitle>
              <CardDescription>
                Obrigatórios para enviar à Recepção
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {DOCUMENTOS.map((doc) => (
                <div
                  key={doc.tipo}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      doc.enviado
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {doc.enviado ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{doc.tipo}</div>
                    {doc.arquivo ? (
                      <div className="text-xs text-slate-500">{doc.arquivo}</div>
                    ) : (
                      <div className="text-xs text-amber-600">Pendente</div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm">
                    {doc.enviado ? "Ver" : "Enviar"}
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="w-full mt-2">
                <Upload className="mr-2 h-4 w-4" />
                Enviar mais documentos
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
