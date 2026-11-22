import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Plug, MessageSquare, Sparkles, Radio, ShieldCheck, ShieldAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CHAVES, obterValor, statusIntegracoes, type ChaveIntegracao } from "@/lib/integrations";
import { WhatsappConfigForm } from "@/components/shared/integrations/whatsapp-config-form";
import { IaConfigForm } from "@/components/shared/integrations/ia-config-form";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Configuração das integrações (WhatsApp/Meta e análise por IA).
 *
 * Tudo que é salvo aqui passa a valer na hora, sem novo deploy — o cliente
 * não precisa mexer em arquivo no servidor.
 */
export default async function AdminIntegracoesPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") {
    redirect("/");
  }

  const [status, ultimaMensagem, headerList] = await Promise.all([
    statusIntegracoes(),
    prisma.whatsappInbound.findFirst({
      orderBy: { receivedAt: "desc" },
      select: { receivedAt: true, phone: true, body: true },
    }),
    headers(),
  ]);

  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "app.scioti.tech";
  const proto = headerList.get("x-forwarded-proto") || "https";
  const webhookUrl = `${proto}://${host}/api/whatsapp/webhook`;

  const assinaturaAtiva = status[CHAVES.WHATSAPP_APP_SECRET].configurada;
  // Valor efetivo (descriptografado se vier do painel) — o admin precisa
  // dele para copiar e colar no painel da Meta.
  const verifyToken = await obterValor(CHAVES.WHATSAPP_VERIFY_TOKEN);

  const statusDe = (chave: ChaveIntegracao) => {
    const s = status[chave];
    return {
      configurada: s.configurada,
      origem: s.origem,
      mascara: s.mascara,
      atualizadoEm: s.updatedAt ? formatDateTime(s.updatedAt) : null,
      atualizadoPor: s.updatedBy,
    };
  };

  return (
    <div>
      <PageHeader
        title="Integrações"
        description="Conecte o WhatsApp e a análise por IA — o que for salvo aqui já vale na hora"
        icon={Plug}
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* Resumo */}
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              {assinaturaAtiva ? (
                <ShieldCheck className="h-8 w-8 text-emerald-500" />
              ) : (
                <ShieldAlert className="h-8 w-8 text-amber-500" />
              )}
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Assinatura das mensagens
                </div>
                <div className="text-sm font-semibold text-slate-700">
                  {assinaturaAtiva ? "Ativa (App Secret cadastrado)" : "Inativa — webhook fechado"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Sparkles className="h-8 w-8 text-sky-500" />
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Análise por IA
                </div>
                <div className="text-sm font-semibold text-slate-700">
                  {status[CHAVES.LLM_API_KEY].configurada ? "Ativa" : "Desligada (só regras)"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Radio className="h-8 w-8 text-direta-orange" />
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Última mensagem recebida
                </div>
                <div className="text-sm font-semibold text-slate-700">
                  {ultimaMensagem
                    ? `${formatDateTime(ultimaMensagem.receivedAt)} · ${ultimaMensagem.phone}`
                    : "Nenhuma ainda"}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* WhatsApp */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-5 w-5 text-emerald-600" />
                WhatsApp (Meta Cloud API)
              </CardTitle>
              <Badge variant={assinaturaAtiva ? "success" : "warning"}>
                {assinaturaAtiva ? "Recebendo mensagens" : "Aguardando App Secret"}
              </Badge>
            </div>
            <CardDescription>
              Cole aqui os dados do seu app na Meta. O webhook começa a validar a assinatura das
              mensagens assim que o App Secret for salvo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <WhatsappConfigForm
              verifyToken={verifyToken}
              status={{
                appSecret: statusDe(CHAVES.WHATSAPP_APP_SECRET),
                accessToken: statusDe(CHAVES.WHATSAPP_ACCESS_TOKEN),
                phoneNumberId: statusDe(CHAVES.WHATSAPP_PHONE_NUMBER_ID),
                verifyToken: statusDe(CHAVES.WHATSAPP_VERIFY_TOKEN),
              }}
            />

            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Endereço do webhook (cadastre este no painel da Meta)
              </div>
              <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-xs text-slate-700">
                {webhookUrl}
              </code>
              <p className="mt-2 text-xs text-slate-500">
                No painel da Meta: WhatsApp → Configuração → Webhook → URL do webhook + token de
                verificação (o campo acima). Depois marque o campo <strong>messages</strong> para
                assinar as mensagens recebidas.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* IA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-sky-600" />
              Análise por IA
            </CardTitle>
            <CardDescription>
              A IA qualifica cada mensagem recebida (curso, situação, score e resumo para o
              vendedor). Sem a chave, o sistema continua funcionando com as regras.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IaConfigForm
              status={{
                apiKey: statusDe(CHAVES.LLM_API_KEY),
                baseUrl: statusDe(CHAVES.LLM_BASE_URL),
                model: statusDe(CHAVES.LLM_MODEL),
              }}
            />
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500">
          Os segredos (App Secret, token de acesso, chave da IA) são gravados criptografados no
          banco do sistema. Se o servidor tiver o mesmo valor em variável de ambiente, ele continua
          valendo até que o valor seja salvo aqui.
        </p>
      </div>
    </div>
  );
}
