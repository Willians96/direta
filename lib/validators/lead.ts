import { z } from "zod";

/**
 * Validadores de Lead — Sprint 14 (ajustes da cliente).
 * - 3 telefones de contato
 * - "Fonte" (como o cliente conheceu a escola)
 * - status do cliente (classificação do vendedor)
 */

export const createLeadSchema = z.object({
  fullName: z.string().min(3, "Nome completo obrigatório").max(120),
  phone: z.string().min(8, "Telefone principal obrigatório").max(20),
  phone2: z.string().max(20).optional().or(z.literal("")),
  phone3: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  cpf: z.string().max(20).optional().or(z.literal("")),
  courseId: z.string().cuid().optional().or(z.literal("")),
  campaignId: z.string().cuid().optional().or(z.literal("")),
  assignedToId: z.string().cuid().optional().or(z.literal("")),
  source: z.string().max(80).optional().or(z.literal("")),
  priority: z.enum(["ALTA", "MEDIA", "BAIXA"]).default("MEDIA"),
  salesStatus: z
    .enum([
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
    ])
    .default("NEGOCIANDO"),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadStatusSchema = z.object({
  status: z.enum([
    "NOVO",
    "QUALIFICADO",
    "PROPOSTA_ENVIADA",
    "EM_NEGOCIACAO",
    "AGUARDANDO_ANALISE",
    "DEVOLVIDA_AJUSTE",
    "APROVADA",
    "PERDIDA",
    "QUARTO_CONTATO",
    "BLOQUEIOU",
    "CONCORRENTE",
    "FIN_SEM_RENDA",
    "INATIVO",
  ]),
  lostReason: z.string().optional(),
});

export const assignLeadSchema = z.object({
  assignedToId: z.string().cuid("Selecione um vendedor"),
});

export const updateSalesStatusSchema = z.object({
  leadId: z.string().cuid(),
  salesStatus: z.enum([
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
  ]),
});

export const updateLeadContactSchema = z.object({
  leadId: z.string().cuid(),
  phone2: z.string().max(20).optional().or(z.literal("")),
  phone3: z.string().max(20).optional().or(z.literal("")),
  source: z.string().max(80).optional().or(z.literal("")),
  priority: z.enum(["ALTA", "MEDIA", "BAIXA"]),
});
