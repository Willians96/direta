import { z } from "zod";

export const createCourseSchema = z.object({
  name: z.string().min(3, "Nome obrigatório").max(120),
  description: z.string().max(1000).optional(),
  workloadHours: z.coerce.number().int().positive("Carga horária deve ser positiva"),
  price: z.coerce.number().positive("Preço deve ser positivo"),
  syllabus: z.string().max(5000).optional(),
  status: z.enum(["ATIVO", "INATIVO", "EM_BREVE"]).default("ATIVO"),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
