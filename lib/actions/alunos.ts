"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ClassStudentStatus, PaymentMethod } from "@prisma/client";
import type { StudentStatus } from "@/lib/alunos";

/**
 * Sprint 20 — Cadastro de Alunos.
 *
 * A matrícula (`Enrollment`) é o cadastro do aluno. Estas actions:
 *  - cadastram um aluno direto (aluno que chega na recepção, sem passar
 *    pelo funil de vendas) — cria o lead de apoio + a matrícula;
 *  - editam os dados do cadastro;
 *  - mudam a situação do aluno (trancar / reativar / concluir).
 */

const alunoSchema = z.object({
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

export type AlunoInput = z.infer<typeof alunoSchema>;

/** Somente administração e recepção cuidam do cadastro de alunos. */
async function requireGestaoAlunos() {
  const session = await auth();
  const user = session?.user as any;
  const role = user?.role;
  if (!user) throw new Error("Não autenticado");
  if (role !== "ADMIN" && role !== "RECEPCAO") {
    throw new Error("Acesso negado: apenas recepção ou admin.");
  }
  return { id: user.id as string, role };
}

function revalidarAlunos(enrollmentId?: string) {
  revalidatePath("/alunos");
  revalidatePath("/alunos/novo");
  revalidatePath("/admin");
  revalidatePath("/admin/turmas");
  revalidatePath("/admin/relatorios");
  revalidatePath("/vendas");
  if (enrollmentId) revalidatePath(`/alunos/${enrollmentId}`);
}

/**
 * Cadastro direto de aluno (sem passar pelo funil de vendas).
 *
 * O modelo exige que toda matrícula tenha um lead — então criamos um lead de
 * apoio com a fonte "Avulso", já marcado como MATRICULADO/APROVADA.
 */
export async function createStudentAction(raw: AlunoInput) {
  const actor = await requireGestaoAlunos();
  const data = alunoSchema.parse(raw);

  const course = await prisma.course.findUnique({
    where: { id: data.courseId },
    select: { id: true, name: true },
  });
  if (!course) throw new Error("Curso não encontrado");

  if (data.classId) {
    const turma = await prisma.class.findUnique({
      where: { id: data.classId },
      select: { id: true, name: true, courseId: true, status: true },
    });
    if (!turma) throw new Error("Turma não encontrada");
    if (turma.courseId !== data.courseId) {
      throw new Error("A turma selecionada não pertence ao curso escolhido.");
    }
  }

  const lead = await prisma.lead.create({
    data: {
      fullName: data.fullName,
      phone: data.phone,
      phone2: data.phone2 || null,
      email: data.email || null,
      cpf: data.cpf || null,
      source: "Avulso",
      status: "APROVADA",
      salesStatus: "MATRICULADO",
      priority: "MEDIA",
      courseId: data.courseId,
      assignedToId: actor.id,
      createdById: actor.id,
      notes: "Cadastro direto de aluno (sem funil de vendas).",
    },
  });

  const enrollment = await prisma.enrollment.create({
    data: {
      leadId: lead.id,
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

  if (data.classId) {
    await prisma.classStudent.create({
      data: { classId: data.classId, leadId: lead.id, status: "ATIVA" },
    });
  }

  await prisma.enrollmentAudit.create({
    data: {
      leadId: lead.id,
      action: "ENROLLMENT_CREATED",
      actorId: actor.id,
      targetType: "Enrollment",
      targetId: enrollment.id,
      details: `Cadastro direto de aluno — curso: ${course.name}; valor: R$ ${data.totalAmount}; parcelas: ${data.installments}`,
    },
  });

  revalidarAlunos(enrollment.id);
  return { ok: true, id: enrollment.id };
}

/** Edita os dados do cadastro do aluno. */
export async function updateStudentAction(enrollmentId: string, raw: AlunoInput) {
  const actor = await requireGestaoAlunos();
  const data = alunoSchema.parse(raw);

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, leadId: true, classId: true },
  });
  if (!enrollment) throw new Error("Matrícula não encontrada");

  const course = await prisma.course.findUnique({
    where: { id: data.courseId },
    select: { id: true, name: true },
  });
  if (!course) throw new Error("Curso não encontrado");

  if (data.classId) {
    const turma = await prisma.class.findUnique({
      where: { id: data.classId },
      select: { id: true, courseId: true },
    });
    if (!turma) throw new Error("Turma não encontrada");
    if (turma.courseId !== data.courseId) {
      throw new Error("A turma selecionada não pertence ao curso escolhido.");
    }
  }

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
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
    },
  });

  // Mantém o lead de origem em sincronia com o cadastro do aluno
  await prisma.lead.update({
    where: { id: enrollment.leadId },
    data: {
      fullName: data.fullName,
      phone: data.phone,
      phone2: data.phone2 || null,
      email: data.email || null,
      cpf: data.cpf || null,
      courseId: data.courseId,
    },
  });

  // Mantém o vínculo com a turma em dia
  if (data.classId && data.classId !== enrollment.classId) {
    const vinculo = await prisma.classStudent.findUnique({
      where: { classId_leadId: { classId: data.classId, leadId: enrollment.leadId } },
      select: { id: true },
    });
    if (!vinculo) {
      await prisma.classStudent.create({
        data: { classId: data.classId, leadId: enrollment.leadId, status: "ATIVA" },
      });
    }
    if (enrollment.classId) {
      await prisma.classStudent.deleteMany({
        where: { classId: enrollment.classId, leadId: enrollment.leadId },
      });
    }
  }

  await prisma.enrollmentAudit.create({
    data: {
      leadId: enrollment.leadId,
      action: "ENROLLMENT_UPDATED",
      actorId: actor.id,
      targetType: "Enrollment",
      targetId: enrollmentId,
      details: `Cadastro do aluno atualizado — curso: ${course.name}; valor: R$ ${data.totalAmount}`,
    },
  });

  revalidarAlunos(enrollmentId);
  return { ok: true, id: enrollmentId };
}

const situacoesValidas = ["ATIVA", "TRANCADA", "CONCLUIDA", "CANCELADA"] as const;

/**
 * Muda a situação do aluno (trancar / reativar / concluir / cancelar).
 * A situação mora no vínculo com a turma — aluno sem turma fica "SEM_TURMA".
 */
export async function updateStudentStatusAction(
  enrollmentId: string,
  situacao: StudentStatus
) {
  const actor = await requireGestaoAlunos();

  if (!situacoesValidas.includes(situacao as (typeof situacoesValidas)[number])) {
    throw new Error("Situação inválida");
  }
  const status = situacao as ClassStudentStatus;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, leadId: true, classId: true },
  });
  if (!enrollment) throw new Error("Matrícula não encontrada");

  if (!enrollment.classId) {
    throw new Error(
      "Este aluno não está em nenhuma turma. Alocá-lo em uma turma para definir a situação."
    );
  }

  const vinculo = await prisma.classStudent.findUnique({
    where: { classId_leadId: { classId: enrollment.classId, leadId: enrollment.leadId } },
    select: { id: true },
  });

  const finishedAt = situacao === "CONCLUIDA" ? new Date() : null;

  if (vinculo) {
    await prisma.classStudent.update({
      where: { id: vinculo.id },
      data: { status, finishedAt },
    });
  } else {
    await prisma.classStudent.create({
      data: {
        classId: enrollment.classId,
        leadId: enrollment.leadId,
        status,
        finishedAt,
      },
    });
  }

  await prisma.enrollmentAudit.create({
    data: {
      leadId: enrollment.leadId,
      action: "ENROLLMENT_STATUS_CHANGED",
      actorId: actor.id,
      targetType: "Enrollment",
      targetId: enrollmentId,
      details: `Situação do aluno alterada para ${situacao}`,
    },
  });

  revalidarAlunos(enrollmentId);
  return { ok: true };
}
