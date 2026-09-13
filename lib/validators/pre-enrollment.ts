import { z } from "zod";

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)")
  .optional()
  .or(z.literal(""));

export const createPreEnrollmentSchema = z.object({
  leadId: z.string().cuid(),
  classId: z.string().cuid().optional(),
  birthDate: optionalDate,
  cpf: z
    .string()
    .regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, "CPF inválido")
    .optional()
    .or(z.literal("")),
  rg: z.string().max(20).optional(),
  addressStreet: z.string().max(120).optional(),
  addressNumber: z.string().max(20).optional(),
  addressComplement: z.string().max(60).optional(),
  addressCity: z.string().max(60).optional(),
  addressState: z.string().length(2, "UF deve ter 2 caracteres").optional(),
  addressZip: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, "CEP inválido")
    .optional()
    .or(z.literal("")),
  guardianName: z.string().max(120).optional(),
  guardianCpf: z.string().optional(),
  guardianPhone: z.string().optional(),
});

export type CreatePreEnrollmentInput = z.infer<typeof createPreEnrollmentSchema>;

export const decideEnrollmentSchema = z.object({
  preEnrollmentId: z.string().cuid(),
  decision: z.enum(["APROVAR", "DEVOLVER"]),
  reason: z.string().max(500).optional(),
});
