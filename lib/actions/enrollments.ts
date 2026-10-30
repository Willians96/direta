"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PaymentMethod, SalesStatus } from "@prisma/client";

/**
 * Sprint 14 — "Realizar Matrícula".
 * Ao salvar: cria o registro Enrollment, marca o lead como MATRICULADO
 * (status do cliente) e APROVADO (status de fluxo).
 */

const enrollmentSchema = z.object({
  leadId: z.string().cuid(),
  courseId: z.string().cuid("Selecione o curso"),
  classId: z.string().cuid().optional().or(z.literal("")),
  fullName: z.string().min(3, "Nome completo obrigatório").max(120),
  birthDate: z.string().optional().or(z.literal("")),
  cpf: z.string().max(20).optional().or(z.literal("")),
  rg: z.string().max(20).optional().or(z.literal("")),
  phone: z.string().min(8, "Telefone obrigatório").max(20),
  phone2: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  addressStreet: z.string().max(150).optional().or(z.literal("")),
  addressNumber: z.string().max(20).optional().or(z.literal("")),
  addressComplement: z.string().max(100).optional().or(z.literal("")),
  addressCity: z.string().max(80).optional().or(z.literal("")),
  addressState: z.string().max(2).optional().or(z.literal("")),
  addressZip: z.string().max(12).optional().or(z.literal("")),
  paymentMethod: z.nativeEnum(PaymentMethod).optional().or(z.literal("")),
  paymentDetails: z.string().max(300).optional().or(z.literal("")),
  installments: z.coerce.number().int().min(1).max(60).default(1),
  totalAmount: z.coerce.number().min(0, "Valor inválido"),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type EnrollmentInput = z.infer<typeof enrollmentSchema>;

export async function createEnrollmentAction(raw: EnrollmentInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");
  const actor = session.user as {
    id: string;
    role: "ADMIN" | "CAPTACAO" | "VENDAS" | "RECEPCAO";
  };

  const data = enrollmentSchema.parse(raw);

  const lead = await prisma.lead.findUnique({
    where: { id: data.leadId },
    select: { id: true, assignedToId: true, fullName: true },
  });
  if (!lead) throw new Error("Lead não encontrado");
  if (actor.role === "VENDAS" && lead.assignedToId !== actor.id) {
    throw new Error("Sem permissão para matricular este lead");
  }

  const course = await prisma.course.findUnique({
    where: { id: data.courseId },
    select: { id: true, name: true, price: true },
  });
  if (!course) throw new Error("Curso não encontrado");

  // Matrícula única por lead
  const existing = await prisma.enrollment.findUnique({
    where: { leadId: data.leadId },
    select: { id: true },
  });
  if (existing) throw new Error("Este lead já possui matrícula registrada");

  const enrollment = await prisma.enrollment.create({
    data: {
      leadId: data.leadId,
      courseId: data.courseId,
      classId: data.classId || null,
      fullName: data.fullName,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      cpf: data.cpf || null,
      rg: data.rg || null,
      phone: data.phone,
      phone2: data.phone2 || null,
      email: data.email || null,
      addressStreet: data.addressStreet || null,
      addressNumber: data.addressNumber || null,
      addressComplement: data.addressComplement || null,
      addressCity: data.addressCity || null,
      addressState: data.addressState || null,
      addressZip: data.addressZip || null,
      paymentMethod: (data.paymentMethod || null) as PaymentMethod | null,
      paymentDetails: data.paymentDetails || null,
      installments: data.installments,
      totalAmount: data.totalAmount,
      notes: data.notes || null,
      enrolledById: actor.id,
    },
  });

  // Lead: status do cliente = MATRICULADO, status de fluxo = APROVADA
  await prisma.lead.update({
    where: { id: data.leadId },
    data: {
      salesStatus: SalesStatus.MATRICULADO,
      status: "APROVADA",
      assignedToId: lead.assignedToId ?? actor.id,
    },
  });

  // Se houver turma, matricula na ClassStudent
  if (data.classId) {
    const jaMatriculado = await prisma.classStudent.findUnique({
      where: { classId_leadId: { classId: data.classId, leadId: data.leadId } },
      select: { id: true },
    });
    if (!jaMatriculado) {
      await prisma.classStudent.create({
        data: { classId: data.classId, leadId: data.leadId, status: "ATIVA" },
      });
    }
  }

  await prisma.enrollmentAudit.create({
    data: {
      leadId: data.leadId,
      action: "PRE_ENROLLMENT_APPROVED",
      actorId: actor.id,
      targetType: "Enrollment",
      targetId: enrollment.id,
      details: `Matrícula realizada — curso: ${course.name}; valor: R$ ${data.totalAmount}; parcelas: ${data.installments}`,
    },
  });

  revalidatePath(`/vendas/leads/${data.leadId}`);
  revalidatePath("/vendas");
  revalidatePath("/vendas/leads");
  revalidatePath("/vendas/alertas");
  revalidatePath("/admin");
  revalidatePath("/admin/metas");

  return { ok: true, id: enrollment.id };
}
