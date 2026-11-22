/**
 * Análise por IA da mensagem recebida no WhatsApp.
 *
 * Usa a API compatível com Anthropic (protocolo `messages`), configurada por
 * variáveis de ambiente:
 *
 *   LLM_API_KEY   — chave do provedor (obrigatória; sem ela o sistema cai
 *                   automaticamente para a análise por REGRAS)
 *   LLM_BASE_URL  — base da API (padrão: MiniMax)
 *   LLM_MODEL     — modelo (padrão: MiniMax-M3.1-Flash)
 *
 * Nunca lança: qualquer falha devolve `{ ok: false }` e o pipeline segue
 * com as regras.
 */

import { SalesStatus } from "@prisma/client";
import type { CursoParaAnalise } from "./rules";

export type AnaliseIA = {
  nome: string | null;
  resumo: string;
  courseId: string | null;
  courseName: string | null;
  intent: string;
  status: SalesStatus | null;
  score: number;
  tags: string[];
  perguntaPrincipal: string | null;
  atencao: string[];
};

export type ResultadoIA =
  | { ok: true; data: AnaliseIA; bruto: string }
  | { ok: false; erro: string };

const BASE_PADRAO = "https://agent.minimax.io/mavis/api/v1/llm/v1";
const MODELO_PADRAO = "MiniMax-M3.1-Flash";
const TIMEOUT_PADRAO = 12_000;

const STATUS_VALIDOS: SalesStatus[] = [
  "NEGOCIANDO",
  "MATRICULADO",
  "RETORNAR",
  "BLOQUEIOU",
  "FECHOU_CONCORRENTE",
  "FIN_SEM_RENDA",
  "CIDADE_110KM",
  "OUTRA_UNIDADE",
  "ADM_RESOLVER",
  "DUPLICADO",
  "OPORTUNIDADE_VENDAS",
  "VISITA",
];

export function iaConfigurada() {
  return !!process.env.LLM_API_KEY;
}

/** Situação da IA no ambiente — usado na tela para avisar o time. */
export function statusIA() {
  return {
    configurada: iaConfigurada(),
    modelo: process.env.LLM_MODEL || MODELO_PADRAO,
  };
}

function montarPrompt(cursos: CursoParaAnalise[]) {
  const listaCursos = cursos
    .map(
      (c) =>
        `- id: ${c.id} | nome: ${c.name}${
          c.description ? ` | descrição: ${c.description.slice(0, 220)}` : ""
        }`
    )
    .join("\n");

  return `Você é o assistente de captação da Direta Cursos (Sorocaba/SP, cursos técnicos de segurança do trabalho, elétrica e mecânica).

Analise a mensagem que um possível cliente enviou no WhatsApp e responda SOMENTE com um JSON válido, sem texto antes ou depois e sem blocos de código.

Formato obrigatório:
{
  "nome": string ou null,
  "resumo": string,
  "cursoId": string ou null,
  "curso": string ou null,
  "intencao": "duvida" | "matricula" | "pagamento" | "agendamento" | "visita" | "reclamacao" | "informacao",
  "status": "NEGOCIANDO" | "MATRICULADO" | "RETORNAR" | "BLOQUEIOU" | "FECHOU_CONCORRENTE" | "FIN_SEM_RENDA" | "CIDADE_110KM" | "OUTRA_UNIDADE" | "ADM_RESOLVER" | "DUPLICADO" | "OPORTUNIDADE_VENDAS" | "VISITA",
  "score": número de 0 a 100,
  "tags": array de strings,
  "perguntaPrincipal": string ou null,
  "atencao": array de strings
}

Regras:
- "nome" só se o cliente disser o próprio nome ("meu nome é João"). Nunca invente.
- "resumo": 2 a 3 frases curtas, na 3ª pessoa, dizendo o que a pessoa quer, para o time de vendas ler rápido.
- "cursoId": use o id da lista abaixo somente se o curso estiver claro. Se não estiver, null.
- "status": o "status do cliente" que o vendedor deveria lançar. Use VISITA quando a pessoa quer visitar a escola, NEGOCIANDO quando está negociando, RETORNAR quando pediu para ser contatada depois.
- "score": interesse real — 90+ quer se matricular agora, 60-89 quer preço/forma de pagamento, 30-59 está comparando, abaixo disso é dúvida solta.
- "tags": palavras curtas, ex.: ["boleto","presencial","noturno","urgente","pix","visitante"].
- "atencao": fatos que o vendedor precisa saber antes de ligar (cidade distante, reclamação, pediu para não ligar, etc.).

Cursos disponíveis:
${listaCursos || "(nenhum curso cadastrado)"}`;
}

/** Extrai o JSON da resposta mesmo que o modelo venha com texto em volta. */
function extrairJson(texto: string): any | null {
  const limpo = texto
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) return null;

  try {
    return JSON.parse(limpo.slice(inicio, fim + 1));
  } catch {
    return null;
  }
}

function textoDaResposta(payload: any): string {
  const conteudo = payload?.content;
  if (Array.isArray(conteudo)) {
    return conteudo
      .filter((p: any) => p?.type === "text" && typeof p.text === "string")
      .map((p: any) => p.text)
      .join("\n");
  }
  if (typeof conteudo === "string") return conteudo;
  return "";
}

export async function analisarComIA(opts: {
  mensagem: string;
  nome?: string | null;
  cursos: CursoParaAnalise[];
  timeoutMs?: number;
}): Promise<ResultadoIA> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    return { ok: false, erro: "LLM_API_KEY não configurada" };
  }

  const baseUrl = (process.env.LLM_BASE_URL || BASE_PADRAO).replace(/\/+$/, "");
  const model = process.env.LLM_MODEL || MODELO_PADRAO;
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_PADRAO;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resposta = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        temperature: 0.2,
        system: montarPrompt(opts.cursos),
        messages: [
          {
            role: "user",
            content: `Nome do perfil no WhatsApp: ${opts.nome || "não informado"}\n\nMensagem:\n${opts.mensagem}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!resposta.ok) {
      return { ok: false, erro: `HTTP ${resposta.status} na API de IA` };
    }

    const payload = await resposta.json();
    const bruto = textoDaResposta(payload);
    const dados = extrairJson(bruto);

    if (!dados) return { ok: false, erro: "resposta da IA não continha JSON" };

    const scoreNum = Number(dados.score);
    const status = STATUS_VALIDOS.includes(dados.status as SalesStatus)
      ? (dados.status as SalesStatus)
      : null;

    return {
      ok: true,
      bruto,
      data: {
        nome: typeof dados.nome === "string" && dados.nome.trim() ? dados.nome.trim() : null,
        resumo: typeof dados.resumo === "string" ? dados.resumo.trim() : "",
        courseId: typeof dados.cursoId === "string" ? dados.cursoId : null,
        courseName: typeof dados.curso === "string" ? dados.curso : null,
        intent: typeof dados.intencao === "string" ? dados.intencao : "informacao",
        status,
        score: Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, Math.round(scoreNum))) : 0,
        tags: Array.isArray(dados.tags)
          ? dados.tags.filter((t: any) => typeof t === "string").slice(0, 12)
          : [],
        perguntaPrincipal:
          typeof dados.perguntaPrincipal === "string" ? dados.perguntaPrincipal : null,
        atencao: Array.isArray(dados.atencao)
          ? dados.atencao.filter((t: any) => typeof t === "string").slice(0, 8)
          : [],
      },
    };
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "tempo limite da IA excedido" : String(e?.message || e);
    return { ok: false, erro: msg };
  } finally {
    clearTimeout(timer);
  }
}
