"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  CHAVES,
  CHAVES_SECRETAS,
  gravarValor,
  obterValor,
  removerValor,
  type ChaveIntegracao,
} from "@/lib/integrations";

/**
 * Configuração das integrações pelo painel.
 *
 * As credenciais ficam gravadas no banco (segredos criptografados) e valem
 * na hora — sem novo deploy. Quem edita é o administrador; os demais
 * apenas veem o estado da conexão.
 */

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") {
    throw new Error("Acesso negado: apenas administradores.");
  }
  return {
    id: (session?.user as any)?.id as string,
    nome: (session?.user?.name || session?.user?.email || "Administrador") as string,
  };
}

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

const CHAVES_VALIDAS = new Set<string>(Object.values(CHAVES));

// ============================================
// WHATSAPP (META CLOUD API)
// ============================================

const whatsappSchema = z.object({
  appSecret: z.string().max(200).optional(),
  accessToken: z.string().max(1000).optional(),
  phoneNumberId: z.string().max(100).optional(),
  verifyToken: z.string().max(200).optional(),
});

export async function salvarWhatsappAction(formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();

    const parsed = whatsappSchema.safeParse({
      appSecret: texto(formData, "appSecret"),
      accessToken: texto(formData, "accessToken"),
      phoneNumberId: texto(formData, "phoneNumberId"),
      verifyToken: texto(formData, "verifyToken"),
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const dados = parsed.data;
    const salvos: string[] = [];

    // Campo em branco = manter o valor atual.
    if (dados.appSecret) {
      if (!/^[0-9a-f]{32}$/i.test(dados.appSecret)) {
        return {
          ok: false,
          error:
            "O App Secret da Meta tem 32 caracteres hexadecimais. Confira se colou o valor certo.",
        };
      }
      await gravarValor(CHAVES.WHATSAPP_APP_SECRET, dados.appSecret, admin.nome);
      salvos.push("App Secret");
    }

    if (dados.accessToken) {
      await gravarValor(CHAVES.WHATSAPP_ACCESS_TOKEN, dados.accessToken, admin.nome);
      salvos.push("Token de acesso");
    }

    if (dados.phoneNumberId) {
      await gravarValor(CHAVES.WHATSAPP_PHONE_NUMBER_ID, dados.phoneNumberId, admin.nome);
      salvos.push("Phone Number ID");
    }

    if (dados.verifyToken) {
      await gravarValor(CHAVES.WHATSAPP_VERIFY_TOKEN, dados.verifyToken, admin.nome);
      salvos.push("Token de verificação");
    }

    revalidatePath("/admin/integracoes");
    revalidatePath("/captacao/whatsapp");

    if (salvos.length === 0) {
      return {
        ok: false,
        error: "Preencha ao menos um campo para salvar (campo em branco mantém o valor atual).",
      };
    }

    return {
      ok: true,
      message: `Salvo: ${salvos.join(", ")}. Já vale para as próximas mensagens.`,
    };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// ============================================
// ANÁLISE POR IA
// ============================================

const iaSchema = z.object({
  apiKey: z.string().max(500).optional(),
  baseUrl: z.string().max(300).optional(),
  model: z.string().max(120).optional(),
});

export async function salvarIaAction(formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();

    const parsed = iaSchema.safeParse({
      apiKey: texto(formData, "apiKey"),
      baseUrl: texto(formData, "baseUrl"),
      model: texto(formData, "model"),
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const dados = parsed.data;
    const salvos: string[] = [];

    if (dados.apiKey) {
      await gravarValor(CHAVES.LLM_API_KEY, dados.apiKey, admin.nome);
      salvos.push("chave da API");
    }

    if (dados.baseUrl) {
      await gravarValor(CHAVES.LLM_BASE_URL, dados.baseUrl.replace(/\/+$/, ""), admin.nome);
      salvos.push("base da API");
    }

    if (dados.model) {
      await gravarValor(CHAVES.LLM_MODEL, dados.model, admin.nome);
      salvos.push("modelo");
    }

    revalidatePath("/admin/integracoes");
    revalidatePath("/captacao/whatsapp");

    if (salvos.length === 0) {
      return {
        ok: false,
        error: "Preencha ao menos um campo para salvar (campo em branco mantém o valor atual).",
      };
    }

    return {
      ok: true,
      message: `Salvo: ${salvos.join(", ")}. A análise por IA já está valendo.`,
    };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// ============================================
// LIMPAR
// ============================================

export async function removerIntegracaoAction(formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();

    const chave = texto(formData, "chave");
    if (!CHAVES_VALIDAS.has(chave)) {
      return { ok: false, error: "Configuração desconhecida." };
    }

    await removerValor(chave as ChaveIntegracao);
    revalidatePath("/admin/integracoes");
    revalidatePath("/captacao/whatsapp");

    return {
      ok: true,
      message:
        "Removido do painel. Se houver variável de ambiente com o mesmo valor, ela passa a valer de novo.",
    };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// ============================================
// TESTES DE CONEXÃO
// ============================================

export type ResultadoTeste = { ok: boolean; mensagem: string };

/** Testa o token de acesso e o número na API Graph da Meta. */
export async function testarWhatsappAction(): Promise<ResultadoTeste> {
  try {
    await requireAdmin();

    const accessToken = await obterValor(CHAVES.WHATSAPP_ACCESS_TOKEN);
    const phoneNumberId = await obterValor(CHAVES.WHATSAPP_PHONE_NUMBER_ID);

    if (!accessToken || !phoneNumberId) {
      return {
        ok: false,
        mensagem: "Preencha o Token de acesso e o Phone Number ID antes de testar.",
      };
    }

    const versoes = ["v22.0", "v21.0", "v20.0", "v19.0"];
    let ultimoErro = "";

    for (const versao of versoes) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);

      try {
        const url = `https://graph.facebook.com/${versao}/${encodeURIComponent(
          phoneNumberId
        )}?fields=display_phone_number,verified_name,quality_rating&access_token=${encodeURIComponent(
          accessToken
        )}`;

        const resposta = await fetch(url, { signal: controller.signal });
        const corpo = await resposta.json().catch(() => ({}));

        if (resposta.ok) {
          const numero = (corpo as any)?.display_phone_number || phoneNumberId;
          const nome = (corpo as any)?.verified_name;
          const qualidade = (corpo as any)?.quality_rating;
          return {
            ok: true,
            mensagem: `Conexão OK — número ${numero}${nome ? ` (${nome})` : ""}${
              qualidade ? `, qualidade ${qualidade}` : ""
            }.`,
          };
        }

        const erro = (corpo as any)?.error;
        const textoErro = erro?.message || `HTTP ${resposta.status}`;

        // Versão da Graph API inexistente: tenta a próxima.
        if (erro?.code === 100 || /unsupported get request|does not exist/i.test(textoErro)) {
          ultimoErro = textoErro;
          continue;
        }

        return { ok: false, mensagem: `A Meta recusou: ${textoErro}` };
      } catch (e: any) {
        ultimoErro = e?.name === "AbortError" ? "tempo limite de 15s excedido" : String(e?.message || e);
      } finally {
        clearTimeout(timer);
      }
    }

    return { ok: false, mensagem: `Não foi possível falar com a Meta: ${ultimoErro}` };
  } catch (e: any) {
    return { ok: false, mensagem: String(e?.message || e) };
  }
}

/** Testa a chave da IA com uma chamada mínima ao provedor. */
export async function testarIaAction(): Promise<ResultadoTeste> {
  try {
    await requireAdmin();

    const apiKey = await obterValor(CHAVES.LLM_API_KEY);
    if (!apiKey) {
      return { ok: false, mensagem: "Preencha a chave da API antes de testar." };
    }

    const baseUrl =
      (await obterValor(CHAVES.LLM_BASE_URL)) || "https://agent.minimax.io/mavis/api/v1/llm/v1";
    const model = (await obterValor(CHAVES.LLM_MODEL)) || "MiniMax-M3.1-Flash";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);

    try {
      const inicio = Date.now();
      const resposta = await fetch(`${baseUrl.replace(/\/+$/, "")}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          model,
          max_tokens: 16,
          messages: [{ role: "user", content: "Responda apenas: ok" }],
        }),
        signal: controller.signal,
      });

      const corpo = await resposta.text();

      if (!resposta.ok) {
        let detalhe = `HTTP ${resposta.status}`;
        try {
          const json = JSON.parse(corpo);
          detalhe = json?.error?.message || json?.message || detalhe;
        } catch {
          if (corpo) detalhe = `${detalhe} — ${corpo.slice(0, 180)}`;
        }
        return { ok: false, mensagem: `A IA recusou: ${detalhe}` };
      }

      const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
      return {
        ok: true,
        mensagem: `Conexão OK — o modelo ${model} respondeu em ${segundos}s.`,
      };
    } catch (e: any) {
      const msg =
        e?.name === "AbortError" ? "tempo limite de 20s excedido" : String(e?.message || e);
      return { ok: false, mensagem: `Falha na chamada: ${msg}` };
    } finally {
      clearTimeout(timer);
    }
  } catch (e: any) {
    return { ok: false, mensagem: String(e?.message || e) };
  }
}

/** Lista de segredos (usado pela tela para explicar o que é e o que não é). */
export function chavesSecretas() {
  return CHAVES_SECRETAS;
}
