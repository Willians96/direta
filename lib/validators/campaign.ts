import { z } from "zod";

export const createCampaignSchema = z.object({
  name: z.string().min(3, "Nome obrigatório").max(120),
  channel: z.enum([
    "INSTAGRAM",
    "FACEBOOK",
    "GOOGLE_ADS",
    "WHATSAPP",
    "EMAIL",
    "INDICACAO",
    "OUTRO",
  ]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  budget: z.coerce.number().positive().optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["PLANEJADA", "ATIVA", "PAUSADA", "ENCERRADA"]).default("PLANEJADA"),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
