import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { processarMensagemWhatsApp } from "@/lib/whatsapp/ingest";
import { extrairConteudo } from "@/lib/whatsapp/normalize";
import { CHAVES, obterValor } from "@/lib/integrations";

/**
 * Webhook da Meta (WhatsApp Cloud API).
 *
 * GET  → desafio de verificação do webhook (hub.mode/hub.verify_token/hub.challenge)
 * POST → mensagens recebidas dos clientes
 *
 * A Meta exige resposta rápida (200) — o processamento acontece antes da
 * resposta, com a análise por IA limitada por timeout. Se a IA demorar, o
 * fluxo cai para a análise por regras.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function temAssinaturaValida(rawBody: string, header: string | null, secret: string) {
  if (!header || !header.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const recebida = header.slice("sha256=".length);
  if (recebida.length !== esperada.length) return false;
  try {
    return timingSafeEqual(Buffer.from(esperada), Buffer.from(recebida));
  } catch {
    return false;
  }
}

/** GET — verificação do webhook pelo painel da Meta. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const modo = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const desafio = params.get("hub.challenge");

  const tokenEsperado = await obterValor(CHAVES.WHATSAPP_VERIFY_TOKEN);

  if (modo === "subscribe" && token && token === tokenEsperado && desafio) {
    return new NextResponse(desafio, { status: 200 });
  }

  // Sem hub.mode é uma pessoa abrindo a URL no navegador — e não a Meta.
  // Em vez de uma página "Forbidden" em branco, mostramos como verificar.
  if (!modo) {
    return new NextResponse(
      [
        "Webhook do WhatsApp (Meta Cloud API) - ativo.",
        "",
        "Esta URL é chamada pela Meta, não por pessoas. Para o desafio de",
        "verificação o endereço precisa ir com os parâmetros:",
        "",
        "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<numero>",
        "",
        "O token de verificação é o cadastrado em Administração > Integrações",
        "(também aceito da variável de ambiente do servidor). O POST",
        "(mensagens recebidas) só é aceito com a assinatura HMAC",
        "(X-Hub-Signature-256), que exige o App Secret configurado.",
      ].join("\n"),
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  // Meta enviou o desafio mas o token/challenge não conferem: precisa falhar
  // para o painel mostrar "verificação não concluída" em vez de aceitar.
  return new NextResponse("Forbidden", { status: 403 });
}

/** POST — mensagens recebidas. */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const secret = await obterValor(CHAVES.WHATSAPP_APP_SECRET);

  if (secret) {
    const ok = temAssinaturaValida(rawBody, req.headers.get("x-hub-signature-256"), secret);
    if (!ok) {
      return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Sem o app secret a rota fica aberta para qualquer um — não é aceitável
    // em produção. Em desenvolvimento seguimos para facilitar os testes.
    return NextResponse.json(
      {
        erro:
          "App Secret do WhatsApp não configurado — cadastre em Administração > Integrações",
      },
      { status: 503 }
    );
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const entradas = payload?.entry ?? [];
  let processadas = 0;
  let duplicadas = 0;
  let ignoradas = 0;
  const erros: string[] = [];

  for (const entrada of entradas) {
    for (const mudanca of entrada?.changes ?? []) {
      if (mudanca?.field !== "messages") continue;
      const valor = mudanca?.value ?? {};
      const contatos = new Map<string, string>();
      for (const contato of valor.contacts ?? []) {
        contatos.set(contato.wa_id, contato?.profile?.name || "");
      }

      for (const mensagem of valor.messages ?? []) {
        const waId = mensagem?.from;
        if (!waId) continue;

        // Mensagens de status (entregue/lido) não são conversa.
        if (mensagem.type === "status" || mensagem.status) {
          ignoradas++;
          continue;
        }

        const { tipo, texto } = extrairConteudo(mensagem);

        const resultado = await processarMensagemWhatsApp({
          waId,
          nome: contatos.get(waId) ?? null,
          tipo,
          texto,
          wamid: mensagem.id ?? `${waId}-${Date.now()}`,
          raw: mensagem,
        });

        if (!resultado.ok) {
          erros.push(resultado.erro ?? "erro desconhecido");
        } else if (resultado.duplicado) {
          duplicadas++;
        } else {
          processadas++;
        }
      }
    }
  }

  return NextResponse.json({
    ok: erros.length === 0,
    processadas,
    duplicadas,
    ignoradas,
    erros,
  });
}
