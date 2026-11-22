import Link from "next/link";
import { MessageCircle, Plus, FlaskConical, Plug } from "lucide-react";

export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { WhatsappQueueRow, type LinhaWhatsApp } from "@/components/shared/whatsapp/whatsapp-queue-row";
import { WebhookUrl } from "@/components/shared/whatsapp/webhook-url";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { statusIA } from "@/lib/whatsapp/llm";
import { CHAVES, statusIntegracoes } from "@/lib/integrations";
import { formatDateTime } from "@/lib/utils";

/**
 * Sprint 22 — Fila do WhatsApp (Captação).
 *
 * Cada mensagem recebida no WhatsApp vira um lead com análise automática.
 * A Captação confere e libera para o vendedor.
 */

export default async function FilaWhatsAppPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const params = await searchParams;
  const filtro = params.filtro ?? "todos";

  const inbounds = await prisma.whatsappInbound.findMany({
    include: {
      lead: {
        select: {
          id: true,
          fullName: true,
          assignedTo: { select: { name: true } },
          course: { select: { name: true } },
          aiCourse: { select: { name: true } },
          aiSummary: true,
          aiTags: true,
          aiScore: true,
          aiIntent: true,
          aiStatus: true,
          aiModel: true,
        },
      },
    },
    orderBy: { receivedAt: "desc" },
    take: 100,
  });

  const vendedores = await prisma.user.findMany({
    where: { role: "VENDAS", status: "ATIVO" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const itens: LinhaWhatsApp[] = inbounds.map((m) => {
    let pergunta: string | null = null;
    let atencao: string[] = [];
    if (m.analysis) {
      try {
        const a = JSON.parse(m.analysis);
        pergunta = a?.perguntaPrincipal ?? null;
        atencao = Array.isArray(a?.atencao) ? a.atencao : [];
      } catch {
        // análise antiga ou inválida — segue sem os extras
      }
    }

    return {
      id: m.id,
      body: m.body,
      type: m.type,
      pushname: m.pushname,
      phone: m.phone,
      status: m.status,
      receivedAt: formatDateTime(m.receivedAt),
      leadId: m.leadId,
      leadName: m.lead?.fullName ?? null,
      leadVendedor: m.lead?.assignedTo?.name ?? null,
      resumo: m.lead?.aiSummary ?? null,
      tags: m.lead?.aiTags ?? [],
      score: m.lead?.aiScore ?? null,
      intent: m.lead?.aiIntent ?? null,
      statusSugerido: m.lead?.aiStatus ?? null,
      cursoSugerido: m.lead?.aiCourse?.name ?? null,
      cursoAtual: m.lead?.course?.name ?? null,
      modelo: m.lead?.aiModel ?? null,
      atencao,
      pergunta,
    };
  });

  const aguardando = itens.filter((i) => !i.leadVendedor && i.status !== "IGNORADA");
  const liberados = itens.filter((i) => !!i.leadVendedor);
  const comIA = itens.filter((i) => i.modelo === "llm").length;

  const visiveis =
    filtro === "aguardando"
      ? aguardando
      : filtro === "liberados"
        ? liberados
        : filtro === "ignorados"
          ? itens.filter((i) => i.status === "IGNORADA")
          : itens;

  const ia = await statusIA();
  const [sessao, statusConexao, headerList] = await Promise.all([
    auth(),
    statusIntegracoes(),
    headers(),
  ]);
  const ehAdmin = (sessao?.user as any)?.role === "ADMIN";
  const assinaturaAtiva = statusConexao[CHAVES.WHATSAPP_APP_SECRET].configurada;

  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "app.scioti.tech";
  const proto = headerList.get("x-forwarded-proto") || "https";
  const urlWebhook = `${proto}://${host}/api/whatsapp/webhook`;

  return (
    <div>
      <PageHeader
        title="WhatsApp"
        description="Mensagens recebidas no WhatsApp da Captação"
        icon={MessageCircle}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/captacao/whatsapp/simulador">
                <FlaskConical className="mr-2 h-4 w-4" />
                Simulador
              </Link>
            </Button>
            {ehAdmin && (
              <Button variant="outline" asChild>
                <Link href="/admin/integracoes">
                  <Plug className="mr-2 h-4 w-4" />
                  Configurar conexão
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        {/* Indicadores */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Recebidas
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-700">{itens.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Aguardando
              </div>
              <div className="mt-1 text-2xl font-bold text-amber-600">{aguardando.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Liberadas
              </div>
              <div className="mt-1 text-2xl font-bold text-emerald-600">{liberados.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Analisadas por IA
              </div>
              <div className="mt-1 text-2xl font-bold text-sky-600">{comIA}</div>
            </CardContent>
          </Card>
        </div>

        {/* Aviso sobre a IA */}
        {!ia.configurada && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <span className="font-medium">Análise por IA desligada.</span> As mensagens estão
            sendo qualificadas só por regras.{" "}
            {ehAdmin ? (
              <>
                Cadastre a chave em{" "}
                <Link href="/admin/integracoes" className="underline">
                  Administração &gt; Integrações
                </Link>{" "}
                — passa a valer na hora.
              </>
            ) : (
              "Peça ao administrador para cadastrar a chave em Administração > Integrações."
            )}
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { valor: "todos", label: "Todas" },
            { valor: "aguardando", label: "Aguardando liberação" },
            { valor: "liberados", label: "Liberadas" },
            { valor: "ignorados", label: "Ignoradas" },
          ].map((f) => (
            <Button
              key={f.valor}
              size="sm"
              variant={filtro === f.valor ? "default" : "outline"}
              asChild
            >
              <Link href={`/captacao/whatsapp?filtro=${f.valor}`}>{f.label}</Link>
            </Button>
          ))}
        </div>

        {/* Fila */}
        {visiveis.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-sm text-slate-500">
              <MessageCircle className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              Nenhuma mensagem nesta fila ainda.
              <div className="mt-2 text-xs text-slate-400">
                Use o <Link href="/captacao/whatsapp/simulador" className="underline">simulador</Link>{" "}
                para testar o fluxo agora, ou aponte o webhook da Meta para este endereço.
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {visiveis.map((item) => (
              <WhatsappQueueRow key={item.id} item={item} vendedores={vendedores} />
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Estado da conexão</CardTitle>
              {assinaturaAtiva ? (
                <Badge variant="success">Assinatura ativa</Badge>
              ) : (
                <Badge variant="warning">App Secret pendente</Badge>
              )}
            </div>
            <CardDescription>
              A Meta envia as mensagens para este endereço. Cada mensagem recebida gera um lead,
              uma análise e uma mensagem no chat-log.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div>
              <span className="font-medium text-slate-700">Endereço do webhook:</span>{" "}
              <span className="text-xs text-slate-500">
                (cadastre este endereço no painel da Meta)
              </span>
              <div className="mt-1">
                <WebhookUrl url={urlWebhook} />
              </div>
            </div>
            <div>
              <span className="font-medium text-slate-700">Verificação:</span> o token do painel da
              Meta (hub.verify_token) precisa ser igual ao token de verificação cadastrado no
              sistema.
            </div>
            <div>
              <span className="font-medium text-slate-700">Segurança:</span>{" "}
              {assinaturaAtiva
                ? "o webhook exige a assinatura X-Hub-Signature-256 — sem isso, qualquer um criaria leads falsos."
                : "sem o App Secret o webhook recusa as mensagens (503). Cadastre-o em Integrações para liberar o recebimento real."}
            </div>
            <div>
              <span className="font-medium text-slate-700">Análise por IA:</span>{" "}
              {ia.configurada ? `ligada (${ia.modelo}).` : "desligada — só regras."}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
