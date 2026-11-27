import { prisma } from "@/lib/prisma";
import {
  ordenarFormasPagamento,
  ordenarSituacoesTurma,
  rotuloPagamento,
  rotuloSituacaoTurma,
} from "@/lib/registries";

/**
 * Opções dos cadastros para alimentar os selects das telas.
 * Só entram as formas/situações ATIVAS — as inativas somem dos cadastros,
 * mas o histórico já gravado continua válido.
 */

export type RegistryOption = { value: string; label: string };

/** Formas de pagamento ativas (Administração › Formas de pagamento). */
export async function getFormasPagamentoAtivas(): Promise<RegistryOption[]> {
  const formas = await prisma.paymentMethodType.findMany({
    where: { active: true },
    select: { description: true },
  });

  const ordenadas = ordenarFormasPagamento(formas.map((f) => f.description));
  return ordenadas.map((value) => ({ value, label: rotuloPagamento(value) }));
}

/** Situações de turma ativas (Administração › Situações de turma). */
export async function getSituacoesTurmaAtivas(): Promise<RegistryOption[]> {
  const situacoes = await prisma.classStatusType.findMany({
    where: { active: true },
    select: { description: true },
  });

  const ordenadas = ordenarSituacoesTurma(situacoes.map((s) => s.description));
  return ordenadas.map((value) => ({ value, label: rotuloSituacaoTurma(value) }));
}

/** Todas as formas de pagamento (ativas e inativas) — para exibir rótulos. */
export async function getFormasPagamento(): Promise<RegistryOption[]> {
  const formas = await prisma.paymentMethodType.findMany({
    select: { description: true },
  });
  const ordenadas = ordenarFormasPagamento(formas.map((f) => f.description));
  return ordenadas.map((value) => ({ value, label: rotuloPagamento(value) }));
}
