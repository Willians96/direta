import type { DocumentType } from "@prisma/client";

/**
 * Rótulos e cores dos tipos de documento.
 *
 * Fonte única da verdade: a página de Documentos e o diálogo de upload usam
 * este mapa, para que todo tipo aceito pelo banco apareça com etiqueta.
 * (O enum DocumentType tem 9 valores — a lista exibia apenas 5, deixando
 *  Comprovante de endereço / Comprovante de pagamento / Foto do aluno
 *  com badge vazio.)
 */

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  RG: "RG",
  CPF: "CPF",
  COMPRO_ENDERECO: "Comprovante de endereço",
  COMPRO_PAGAMENTO: "Comprovante de pagamento",
  FOTO_ALUNO: "Foto do aluno",
  COMPROVANTE_RESIDENCIA: "Comprovante de residência",
  FOTO: "Foto",
  HISTORICO_ESCOLAR: "Histórico escolar",
  OUTRO: "Outro",
};

export type DocumentTypeVariant =
  | "default"
  | "info"
  | "warning"
  | "success"
  | "neutral";

export const DOCUMENT_TYPE_VARIANTS: Record<DocumentType, DocumentTypeVariant> = {
  RG: "info",
  CPF: "info",
  COMPRO_ENDERECO: "warning",
  COMPRO_PAGAMENTO: "warning",
  FOTO_ALUNO: "success",
  COMPROVANTE_RESIDENCIA: "warning",
  FOTO: "success",
  HISTORICO_ESCOLAR: "success",
  OUTRO: "neutral",
};

/** Rótulo seguro: devolve o próprio valor se algum tipo novo entrar no enum. */
export function documentTypeLabel(type: string): string {
  return DOCUMENT_TYPE_LABELS[type as DocumentType] ?? type;
}

/** Variante segura: devolve "neutral" para tipos fora do mapa. */
export function documentTypeVariant(type: string): DocumentTypeVariant {
  return DOCUMENT_TYPE_VARIANTS[type as DocumentType] ?? "neutral";
}

/** Tipos oferecidos no diálogo de upload (padrão da cliente + complementares). */
export const UPLOADABLE_DOCUMENT_TYPES: DocumentType[] = [
  "RG",
  "CPF",
  "COMPRO_ENDERECO",
  "COMPRO_PAGAMENTO",
  "FOTO_ALUNO",
  "HISTORICO_ESCOLAR",
  "OUTRO",
];
