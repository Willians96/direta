import { z } from "zod";

export const createLeadSchema = z.object({
  fullName: z.string().min(3, "Nome completo obrigatório").max(120),
  phone: z.string().regex(/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/, "Telefone inválido"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  courseId: z.string().cuid().optional(),
  campaignId: z.string().cuid().optional(),
  notes: z.string().max(500).optional(),
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
  ]),
  lostReason: z.string().optional(),
});

export const assignLeadSchema = z.object({
  assignedToId: z.string().cuid("Selecione um vendedor"),
});
