import Link from "next/link";
import { MessageCircle, Plus, FlaskConical, Radio } from "lucide-react";

export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { WhatsappQueueRow, type LinhaWhatsApp } from "@/components/shared/whatsapp/whatsapp-queue-row";
import { prisma } from "@/lib/prisma";
import { statusIA } from "@/lib/whatsapp/llm";
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

  const ia = statusIA();

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
            <Button variant="outline" asChild>
              <a href="/api/whatsapp/webhook" target="_blank" rel="noopener noreferrer">
                <Radio className="mr-2 h-4 w-4" />
                Webhook
              </a>
            </Button>
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
            sendo qualificadas só por regras. Para ativar a IA, cadastre a chave{" "}
            <code className="rounded bg-white px-1">LLM_API_KEY</code> nas variáveis de ambiente
            da Vercel.
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
            <CardTitle className="text-base">Como este módulo se conecta</CardTitle>
            <CardDescription>
              A Meta envia as mensagens para este endereço. Cada mensagem recebida gera um lead,
              uma análise e uma mensagem no chat-log.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <div>
              <span className="font-medium text-slate-700">Webhook:</span>{" "}
              <code className="rounded bg-slate-100 px-1">/api/whatsapp/webhook</code>
            </div>
            <div>
              <span className="font-medium text-slate-700">Verificação:</span> o token do painel da
              Meta (hub.verify_token) precisa ser igual a{" "}
              <code className="rounded bg-slate-100 px-1">WHATSAPP_VERIFY_TOKEN</code>.
            </div>
            <div>
              <span className="font-medium text-slate-700">Segurança:</span> com{" "}
              <code className="rounded bg-slate-100 px-1">WHATSAPP_APP_SECRET</code> configurado, o
              webhook exige a assinatura{" "}
              <code className="rounded bg-slate-100 px-1">X-Hub-Signature-256</code> — sem isso
              qualquer um conseguiria criar leads falsos.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
