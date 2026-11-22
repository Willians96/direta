/**
 * Configurações das integrações externas (Meta/WhatsApp e provedor de IA).
 *
 * O cliente configura isso pelo painel (Administração > Integrações) e o
 * valor passa a valer na hora — sem novo deploy. Até a primeira configuração
 * pelo painel, o sistema continua lendo as variáveis de ambiente do servidor
 * (compatibilidade com o que já existe em produção).
 *
 * Segredos (App Secret, token de acesso, chave da IA) são gravados
 * CRIPTOGRAFADOS no banco: AES-256-GCM com chave derivada do AUTH_SECRET do
 * servidor (HKDF-SHA256). Assim, um dump do banco não expõe as credenciais da
 * Meta nem da IA.
 *
 * Se o AUTH_SECRET for rotacionado, os segredos gravados ficam ilegíveis —
 * neste caso o sistema volta a usar a variável de ambiente e a tela mostra
 * que é preciso digitar o valor novamente.
 */

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "crypto";
import { prisma } from "@/lib/prisma";

/** Chaves de configuração suportadas. */
export const CHAVES = {
  WHATSAPP_APP_SECRET: "whatsapp_app_secret",
  WHATSAPP_ACCESS_TOKEN: "whatsapp_access_token",
  WHATSAPP_PHONE_NUMBER_ID: "whatsapp_phone_number_id",
  WHATSAPP_VERIFY_TOKEN: "whatsapp_verify_token",
  LLM_API_KEY: "llm_api_key",
  LLM_BASE_URL: "llm_base_url",
  LLM_MODEL: "llm_model",
} as const;

export type ChaveIntegracao = (typeof CHAVES)[keyof typeof CHAVES];

/** Chaves que são segredos (gravadas criptografadas e nunca exibidas por inteiro). */
export const CHAVES_SECRETAS: ChaveIntegracao[] = [
  CHAVES.WHATSAPP_APP_SECRET,
  CHAVES.WHATSAPP_ACCESS_TOKEN,
  CHAVES.WHATSAPP_VERIFY_TOKEN,
  CHAVES.LLM_API_KEY,
];

/** Variável de ambiente usada como reserva quando não há valor no painel. */
function variavelDeAmbiente(chave: ChaveIntegracao): string | undefined {
  switch (chave) {
    case CHAVES.WHATSAPP_APP_SECRET:
      return process.env.WHATSAPP_APP_SECRET;
    case CHAVES.WHATSAPP_ACCESS_TOKEN:
      return process.env.WHATSAPP_TOKEN;
    case CHAVES.WHATSAPP_PHONE_NUMBER_ID:
      return process.env.WHATSAPP_PHONE_NUMBER_ID;
    case CHAVES.WHATSAPP_VERIFY_TOKEN:
      return process.env.WHATSAPP_VERIFY_TOKEN;
    case CHAVES.LLM_API_KEY:
      return process.env.LLM_API_KEY;
    case CHAVES.LLM_BASE_URL:
      return process.env.LLM_BASE_URL;
    case CHAVES.LLM_MODEL:
      return process.env.LLM_MODEL;
    default:
      return undefined;
  }
}

// ============================================
// CRIPTOGRAFIA
// ============================================

const SAL = "gescola-integrations-v1";
const INFO = "integration-setting-encryption";
const VERSION = "v1";

function chaveDeCriptografia(): Buffer | null {
  const segredo = process.env.AUTH_SECRET;
  if (!segredo) return null;
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(segredo, "utf8"), Buffer.from(SAL), Buffer.from(INFO), 32)
  );
}

/** Criptografa um texto (AES-256-GCM). Retorna null se não houver AUTH_SECRET. */
export function criptografar(texto: string): string | null {
  const chave = chaveDeCriptografia();
  if (!chave) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave, iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString("base64"), tag.toString("base64"), cifrado.toString("base64")].join(
    ":"
  );
}

/** Descriptografa um valor gravado por `criptografar`. Retorna null se falhar. */
export function descriptografar(valor: string): string | null {
  try {
    const partes = valor.split(":");
    if (partes.length !== 4 || partes[0] !== VERSION) return null;

    const chave = chaveDeCriptografia();
    if (!chave) return null;

    const iv = Buffer.from(partes[1], "base64");
    const tag = Buffer.from(partes[2], "base64");
    const cifrado = Buffer.from(partes[3], "base64");

    const decipher = createDecipheriv("aes-256-gcm", chave, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ============================================
// LEITURA
// ============================================

export type OrigemValor = "painel" | "servidor" | null;

export type StatusChave = {
  chave: ChaveIntegracao;
  /** Existe valor utilizável (painel ou servidor)? */
  configurada: boolean;
  /** De onde vem o valor em uso. */
  origem: OrigemValor;
  /** Valor mascarado para exibição (segredos mostram só o final). */
  mascara: string | null;
  /** Segredo? (não pode ser lido de volta, só substituído) */
  secreta: boolean;
  updatedAt: Date | null;
  updatedBy: string | null;
};

/**
 * Valor efetivo de uma chave: painel (banco) tem prioridade sobre a
 * variável de ambiente do servidor.
 */
export async function obterValor(chave: ChaveIntegracao): Promise<string | null> {
  const registro = await prisma.integrationSetting.findUnique({ where: { key: chave } });

  if (registro?.value) {
    const valor = registro.encrypted ? descriptografar(registro.value) : registro.value;
    // Se a descriptografia falhou (AUTH_SECRET rotacionado), cai no .env.
    if (valor) return valor;
  }

  return variavelDeAmbiente(chave) ?? null;
}

/** Todos os valores efetivos de uma vez (menos queries ao banco). */
export async function obterValores(): Promise<Record<ChaveIntegracao, string | null>> {
  const registros = await prisma.integrationSetting.findMany();
  const mapa = new Map(registros.map((r) => [r.key, r]));

  const resolver = (chave: ChaveIntegracao): string | null => {
    const registro = mapa.get(chave);
    if (registro?.value) {
      const valor = registro.encrypted ? descriptografar(registro.value) : registro.value;
      if (valor) return valor;
    }
    return variavelDeAmbiente(chave) ?? null;
  };

  return Object.fromEntries(
    Object.values(CHAVES).map((chave) => [chave, resolver(chave)])
  ) as Record<ChaveIntegracao, string | null>;
}

/** Situação de cada chave — usada na tela para mostrar o que falta. */
export async function statusIntegracoes(): Promise<Record<ChaveIntegracao, StatusChave>> {
  const registros = await prisma.integrationSetting.findMany();
  const mapa = new Map(registros.map((r) => [r.key, r]));

  const montar = (chave: ChaveIntegracao): StatusChave => {
    const registro = mapa.get(chave);
    const secreta = CHAVES_SECRETAS.includes(chave);

    let valorPainel: string | null = null;
    if (registro?.value) {
      valorPainel = registro.encrypted ? descriptografar(registro.value) : registro.value;
    }

    const valorServidor = variavelDeAmbiente(chave) ?? null;
    const origem: OrigemValor = valorPainel ? "painel" : valorServidor ? "servidor" : null;
    const valor = valorPainel ?? valorServidor;

    return {
      chave,
      configurada: !!valor,
      origem,
      mascara: valor ? mascarar(valor, secreta) : null,
      secreta,
      updatedAt: registro?.updatedAt ?? null,
      updatedBy: registro?.updatedBy ?? null,
    };
  };

  return Object.fromEntries(
    Object.values(CHAVES).map((chave) => [chave, montar(chave)])
  ) as Record<ChaveIntegracao, StatusChave>;
}

/** Mostra o fim do valor (para o cliente conferir se colou o certo). */
export function mascarar(valor: string, secreta: boolean): string {
  if (!secreta) return valor;
  if (valor.length <= 4) return "•".repeat(valor.length);
  return `${"•".repeat(Math.min(12, valor.length - 4))}${valor.slice(-4)}`;
}

// ============================================
// ESCRITA
// ============================================

/** Grava (ou substitui) o valor de uma chave. Segredos são criptografados. */
export async function gravarValor(
  chave: ChaveIntegracao,
  valor: string,
  por: string | null
): Promise<void> {
  const secreta = CHAVES_SECRETAS.includes(chave);
  const valorGravado = secreta ? criptografar(valor) : valor;

  if (secreta && !valorGravado) {
    throw new Error(
      "AUTH_SECRET não configurado no servidor — não é possível gravar segredos com segurança."
    );
  }

  await prisma.integrationSetting.upsert({
    where: { key: chave },
    create: {
      key: chave,
      value: valorGravado as string,
      encrypted: secreta,
      updatedBy: por,
    },
    update: {
      value: valorGravado as string,
      encrypted: secreta,
      updatedBy: por,
    },
  });
}

/** Remove o valor do painel (volta a usar a variável de ambiente do servidor). */
export async function removerValor(chave: ChaveIntegracao): Promise<void> {
  await prisma.integrationSetting.deleteMany({ where: { key: chave } });
}

// ============================================
// ATALHOS
// ============================================

export type ConfiguracaoWhatsapp = {
  appSecret: string | null;
  accessToken: string | null;
  phoneNumberId: string | null;
  verifyToken: string | null;
  /** A assinatura HMAC está ativa? (sem app secret o webhook fica fechado) */
  assinaturaAtiva: boolean;
};

export async function configuracaoWhatsapp(): Promise<ConfiguracaoWhatsapp> {
  const valores = await obterValores();
  return {
    appSecret: valores[CHAVES.WHATSAPP_APP_SECRET],
    accessToken: valores[CHAVES.WHATSAPP_ACCESS_TOKEN],
    phoneNumberId: valores[CHAVES.WHATSAPP_PHONE_NUMBER_ID],
    verifyToken: valores[CHAVES.WHATSAPP_VERIFY_TOKEN],
    assinaturaAtiva: !!valores[CHAVES.WHATSAPP_APP_SECRET],
  };
}

export type ConfiguracaoIA = {
  apiKey: string | null;
  baseUrl: string | null;
  model: string | null;
  configurada: boolean;
};

export async function configuracaoIA(): Promise<ConfiguracaoIA> {
  const valores = await obterValores();
  return {
    apiKey: valores[CHAVES.LLM_API_KEY],
    baseUrl: valores[CHAVES.LLM_BASE_URL],
    model: valores[CHAVES.LLM_MODEL],
    configurada: !!valores[CHAVES.LLM_API_KEY],
  };
}
