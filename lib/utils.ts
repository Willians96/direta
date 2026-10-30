import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatPhone(phone: string) {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return phone;
}

export function maskCurrency(value: string) {
  const cleaned = value.replace(/\D/g, "");
  const cents = parseInt(cleaned || "0", 10);
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Tamanho da fonte do valor de um card de indicador.
 *
 * Valores monetários como "R$ 2.690,00" usam espaço inseparável (U+00A0)
 * vinda do Intl — a string inteira vira um bloco indivisível e estourava o
 * card. A fonte diminui conforme o comprimento e o texto pode quebrar.
 */
export function statValueSize(value: string | number) {
  const length = String(value).length;
  if (length <= 7) return "text-3xl";
  if (length <= 10) return "text-2xl";
  if (length <= 14) return "text-xl";
  return "text-lg";
}
