/**
 * Rótulos de exibição dos cadastros (formas de pagamento e situações de turma).
 *
 * O que é gravado no banco é o texto do cadastro (`description`); o rótulo é
 * apenas para mostrar na tela. Formas/situações criadas pela cliente aparecem
 * com o próprio texto.
 */

/** Rótulos amigáveis das formas de pagamento que já existiam no sistema. */
const ROTULOS_PAGAMENTO: Record<string, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_DEBITO: "Cartão de débito",
  DINHEIRO: "Dinheiro",
  TRANSFERENCIA: "Transferência",
  PARCELADO_PROPRIO: "Parcelado próprio",
  OUTRO: "Outro",
};

/** Rótulos amigáveis das situações de turma que já existiam no sistema. */
const ROTULOS_SITUACAO_TURMA: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
};

/** Ordem original das formas de pagamento (as novas vão para o final). */
const ORDEM_PAGAMENTO = [
  "PIX",
  "BOLETO",
  "CARTAO_CREDITO",
  "CARTAO_DEBITO",
  "DINHEIRO",
  "TRANSFERENCIA",
  "PARCELADO_PROPRIO",
  "OUTRO",
];

/** Ordem original das situações de turma (as novas vão para o final). */
const ORDEM_SITUACAO_TURMA = ["ABERTA", "EM_ANDAMENTO", "ENCERRADA", "CANCELADA"];

export function rotuloPagamento(valor?: string | null): string {
  if (!valor) return "—";
  return ROTULOS_PAGAMENTO[valor] ?? valor;
}

export function rotuloSituacaoTurma(valor?: string | null): string {
  if (!valor) return "—";
  return ROTULOS_SITUACAO_TURMA[valor] ?? valor;
}

/**
 * Mantém a ordem original dos itens que já existiam e coloca os novos
 * (cadastrados pela cliente) no final, em ordem alfabética.
 */
export function ordenarPorOrdemBase(valores: string[], ordemBase: string[]): string[] {
  return [...valores].sort((a, b) => {
    const ia = ordemBase.indexOf(a);
    const ib = ordemBase.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "pt-BR");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/** Formas de pagamento na ordem de exibição (usada nos selects). */
export function ordenarFormasPagamento(valores: string[]): string[] {
  return ordenarPorOrdemBase(valores, ORDEM_PAGAMENTO);
}

/** Situações de turma na ordem de exibição (usada nos selects). */
export function ordenarSituacoesTurma(valores: string[]): string[] {
  return ordenarPorOrdemBase(valores, ORDEM_SITUACAO_TURMA);
}

/**
 * Situações de turma que liberam matrícula de um aluno.
 * Turmas "Aberta" e "Em andamento" são as que aceitam novos alunos.
 */
export const SITUACOES_COM_MATRICULA = ["ABERTA", "EM_ANDAMENTO"] as const;
