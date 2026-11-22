/**
 * Análise híbrida: regras + IA.
 *
 * As regras SEMPRE rodam (são a base e a rede de segurança). A IA entra por
 * cima quando está configurada e responde — enrichecendo resumo, curso,
 * status e score. Se a IA falhar ou demorar, o resultado das regras é
 * devolvido normalmente e o lead nunca se perde.
 */

import { SalesStatus } from "@prisma/client";
import { analisarPorRegras, type CursoParaAnalise } from "./rules";
import { analisarComIA, iaConfigurada } from "./llm";

export type AnaliseFinal = {
  nome: string | null;
  resumo: string;
  courseId: string | null;
  courseName: string | null;
  intent: string;
  score: number;
  tags: string[];
  status: SalesStatus | null;
  model: "llm" | "regras";
  perguntaPrincipal: string | null;
  atencao: string[];
  erroIA: string | null;
};

export async function analisarMensagem(opts: {
  mensagem: string;
  nome?: string | null;
  cursos: CursoParaAnalise[];
}): Promise<AnaliseFinal> {
  const base = analisarPorRegras(opts.mensagem, opts.cursos);

  const somenteRegras: AnaliseFinal = {
    ...base,
    model: "regras",
    perguntaPrincipal: null,
    atencao: [],
    erroIA: null,
  };

  if (!iaConfigurada()) return somenteRegras;

  const ia = await analisarComIA({
    mensagem: opts.mensagem,
    nome: opts.nome,
    cursos: opts.cursos,
  });

  if (!ia.ok) {
    return { ...somenteRegras, erroIA: ia.erro };
  }

  const d = ia.data;

  // Curso: a IA só vale se apontar para um curso que existe.
  const cursoValido = opts.cursos.find((c) => c.id === d.courseId);
  const courseId = cursoValido?.id ?? base.courseId;
  const courseName = cursoValido?.name ?? base.courseName;

  const tags = [...new Set([...d.tags, ...base.tags])].slice(0, 12);

  return {
    nome: d.nome ?? base.nome,
    resumo: d.resumo || base.resumo,
    courseId,
    courseName,
    intent: d.intent || base.intent,
    score: Math.max(d.score, base.score),
    tags,
    status: d.status ?? base.status,
    model: "llm",
    perguntaPrincipal: d.perguntaPrincipal,
    atencao: d.atencao,
    erroIA: null,
  };
}
