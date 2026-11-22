/**
 * Análise por REGRAS da mensagem recebida no WhatsApp.
 *
 * É a camada que nunca falha: roda sempre, não custa nada e não depende de
 * rede. Serve de base e de fallback quando a análise por IA não está
 * configurada (ou falha).
 */

import { SalesStatus } from "@prisma/client";
import { extrairNomeDoTexto, semAcento } from "./normalize";

export type CursoParaAnalise = {
  id: string;
  name: string;
  description?: string | null;
};

export type AnalisePorRegras = {
  nome: string | null;
  courseId: string | null;
  courseName: string | null;
  intent: string;
  score: number;
  tags: string[];
  status: SalesStatus | null;
  resumo: string;
};

/** Tags reconhecidas na mensagem. */
const DICIONARIO_TAGS: { tag: string; padrao: RegExp }[] = [
  { tag: "boleto", padrao: /boleto|segunda via|2[ªa] via/i },
  { tag: "pix", padrao: /\bpix\b/i },
  { tag: "pagamento", padrao: /pagament|pagar|pagou|d[eé]bito|transfer[eê]ncia/i },
  { tag: "preço", padrao: /valor|pre[cç]o|quanto (custa|vai custar|fica|é)|investimento/i },
  { tag: "parcelamento", padrao: /parcel|em \d+ ?vezes|bolsa|desconto/i },
  { tag: "à vista", padrao: /[àa] vista|dinheiro/i },
  { tag: "matrícula", padrao: /matri|inscri|inscrever|vou fazer|come[cç]ar (o |o )?curso/i },
  { tag: "certificado", padrao: /certificad|diploma|documenta[cç][ãa]o de conclus/i },
  { tag: "visita", padrao: /visita|visitar|conhecer (a )?escola|passar na escola|ver a escola/i },
  { tag: "agendamento", padrao: /agenda|hor[áa]rio|pode (vir|poder vir)|t[êe]r[aá]rio|quando (tem|voc[êe] tem)/i },
  { tag: "presencial", padrao: /presencial|na escola|no local|na unidade/i },
  { tag: "online", padrao: /online|remoto|ao vivo|aula remota/i },
  { tag: "noturno", padrao: /noturn|à noite|a noite|vesper/i },
  { tag: "sábado", padrao: /s[áa]bado/i },
  { tag: "urgente", padrao: /urgent|urg[êe]ncia|preciso (hoje|agora|j[áa])|rapidin|o mais breve/i },
  { tag: "trabalho", padrao: /trabalho|emprego|demiss|sal[áa]rio|carreira|avalia[cç][ãa]o/i },
  { tag: "duvida", padrao: /\?|d[úu]vida|como funciona|qual a diferen[çc]a|me explica|saber mais/i },
];

/** Intenção principal da mensagem. */
const INTENCOES: { intent: string; padrao: RegExp; peso: number }[] = [
  {
    intent: "matricula",
    padrao: /matri|inscri|inscrever|quero fazer|vou fazer|come[cç]ar|como (me )?inscrevo/i,
    peso: 25,
  },
  {
    intent: "agendamento",
    padrao: /agenda|hor[áa]rio|pode (vir|poder vir)|visitar|conhecer|passar na escola/i,
    peso: 15,
  },
  {
    intent: "pagamento",
    padrao: /boleto|pix|pagar|pagamento|segunda via|como (eu )?pago/i,
    peso: 15,
  },
  { intent: "reclamacao", padrao: /reclam|problema|erro|falhou|n[ãa]o consegui|atrasad/i, peso: -10 },
  {
    intent: "duvida",
    padrao:
      /\?|d[úu]vida|como funciona|qual a diferen[çc]a|me explica|saber mais|quero saber|quero entender|qual (o |a )?curso/i,
    peso: 10,
  },
  { intent: "informacao", padrao: /.+/, peso: 5 },
];

/** Palavras que sozinhas não identificam um curso. */
const PALAVRAS_GENERICAS = [
  "curso",
  "cursos",
  "industrial",
  "tecnico",
  "basico",
  "avancado",
  "especial",
  "turma",
  "formacao",
];

/**
 * Termos que identificam um curso a partir do nome cadastrado.
 * "NR-10 e NR-35" → "nr 10 e nr 35", "nr 10", "nr10", "nr 35", "nr35".
 * "Mecânica Automotiva" → "mecanica automotiva", "mecanica", "automotiva".
 */
export function termosDoCurso(nome: string) {
  const termos = new Set<string>();
  const normalizado = semAcento(nome);
  if (normalizado.length >= 4) termos.add(normalizado);

  const partes = nome
    .split(/\s+(?:e|&)\s+|,|\/|\||;/i)
    .map((p) => semAcento(p))
    .filter(Boolean);

  for (const parte of partes) {
    if (parte.length >= 4 || /\d/.test(parte)) {
      termos.add(parte);
      const compacto = parte.replace(/\s/g, "");
      if (compacto.length >= 3) termos.add(compacto);
    }
    // Palavras relevantes dentro de um nome composto ("mecânica automotiva")
    for (const palavra of parte.split(/\s+/)) {
      if (palavra.length >= 6 && !PALAVRAS_GENERICAS.includes(palavra)) {
        termos.add(palavra);
      }
    }
  }

  return [...termos];
}

function identificarCurso(texto: string, cursos: CursoParaAnalise[]) {
  const alvo = semAcento(texto);
  let melhor: { curso: CursoParaAnalise; tamanho: number } | null = null;

  for (const curso of cursos) {
    for (const termo of termosDoCurso(curso.name)) {
      if (termo.length < 4 && !/\d/.test(termo)) continue;
      if (!alvo.includes(termo)) continue;
      // Termo mais específico (mais longo) vence — "nr 35" ganha de "nr".
      if (!melhor || termo.length > melhor.tamanho) {
        melhor = { curso, tamanho: termo.length };
      }
    }
  }

  return melhor?.curso ?? null;
}

export function analisarPorRegras(
  mensagem: string,
  cursos: CursoParaAnalise[]
): AnalisePorRegras {
  const texto = mensagem || "";

  const tags = DICIONARIO_TAGS.filter((t) => t.padrao.test(texto)).map((t) => t.tag);

  const intencao =
    INTENCOES.find((i) => i.padrao.test(texto)) ?? INTENCOES[INTENCOES.length - 1];

  const curso = identificarCurso(texto, cursos);

  let score = 30 + intencao.peso;
  if (curso) score += 20;
  if (tags.includes("preço")) score += 10;
  if (tags.includes("matrícula")) score += 10;
  if (tags.includes("urgente")) score += 10;
  if (tags.includes("certificado")) score += 5;
  score = Math.max(0, Math.min(100, score));

  const status: SalesStatus | null =
    tags.includes("visita") || intencao.intent === "agendamento" ? "VISITA" : "NEGOCIANDO";

  const nome = extrairNomeDoTexto(texto);

  const partes: string[] = [];
  partes.push(
    curso
      ? `Interesse em ${curso.name}`
      : "Curso de interesse ainda não identificado"
  );
  if (intencao.intent === "matricula")
    partes.push("demonstrou intenção de se matricular");
  if (intencao.intent === "pagamento") partes.push("quer resolver pagamento");
  if (intencao.intent === "agendamento") partes.push("quer agendar ou visitar a escola");
  if (tags.includes("visita")) partes.push("quer visitar a escola");
  if (intencao.intent === "duvida") partes.push("tirou dúvidas sobre o curso");
  if (tags.includes("urgente")) partes.push("demonstrou urgência");

  return {
    nome,
    courseId: curso?.id ?? null,
    courseName: curso?.name ?? null,
    intent: intencao.intent,
    score,
    tags,
    status,
    resumo: `${partes.join(", ")}.`,
  };
}
