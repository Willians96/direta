"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") throw new Error("Acesso negado.");
  return (session?.user as any).id as string;
}

const classSchema = z.object({
  courseId: z.string().cuid(),
  name: z.string().min(2, "Nome obrigatório"),
  code: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  maxStudents: z.coerce.number().int().positive("Lotação > 0"),
  professorId: z.string().optional().or(z.literal("")),
  scheduleDays: z.array(z.string()).optional(),
  scheduleTime: z.string().optional(),
  notes: z.string().max(500).optional(),
  status: z.enum(["ABERTA", "EM_ANDAMENTO", "ENCERRADA", "CANCELADA"]).default("ABERTA"),
});

export async function createClassAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const adminId = await requireAdmin();

    const daysRaw = formData.getAll("scheduleDays") as string[];
    const data = {
      courseId: formData.get("courseId") as string,
      name: formData.get("name") as string,
      code: (formData.get("code") as string) || undefined,
      startDate: formData.get("startDate") as string,
      endDate: (formData.get("endDate") as string) || undefined,
      maxStudents: formData.get("maxStudents") as string,
      professorId: (formData.get("professorId") as string) || undefined,
      scheduleDays: daysRaw,
      scheduleTime: (formData.get("scheduleTime") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
      status: (formData.get("status") as string) || "ABERTA",
    };

    const parsed = classSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }

    const schedule = parsed.data.scheduleTime
      ? {
          days: parsed.data.scheduleDays ?? [],
          time: parsed.data.scheduleTime,
        }
      : null;

    const cls = await prisma.class.create({
      data: {
        courseId: parsed.data.courseId,
        name: parsed.data.name,
        code: parsed.data.code || null,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        maxStudents: parsed.data.maxStudents,
        professorId: parsed.data.professorId || null,
        schedule: schedule || undefined,
        notes: parsed.data.notes,
        status: parsed.data.status,
      },
    });

    await prisma.enrollmentAudit.create({
      data: {
        action: "COURSE_CREATED", // reuse
        actorId: adminId,
        targetType: "Class",
        targetId: cls.id,
        details: `Turma criada: ${cls.name}`,
      },
    });

    revalidatePath("/admin/turmas");
    revalidatePath(`/admin/cursos`);
    revalidatePath(`/admin/cursos/${cls.courseId}`);
    return { ok: true, message: "Turma criada com sucesso!" };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao criar turma." };
  }
}

export async function updateClassAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const adminId = await requireAdmin();

    const daysRaw = formData.getAll("scheduleDays") as string[];
    const data = {
      courseId: formData.get("courseId") as string,
      name: formData.get("name") as string,
      code: (formData.get("code") as string) || undefined,
      startDate: formData.get("startDate") as string,
      endDate: (formData.get("endDate") as string) || undefined,
      maxStudents: formData.get("maxStudents") as string,
      professorId: (formData.get("professorId") as string) || undefined,
      scheduleDays: daysRaw,
      scheduleTime: (formData.get("scheduleTime") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
      status: formData.get("status") as string,
    };

    const parsed = classSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }

    const schedule = parsed.data.scheduleTime
      ? {
          days: parsed.data.scheduleDays ?? [],
          time: parsed.data.scheduleTime,
        }
      : null;

    const cls = await prisma.class.update({
      where: { id },
      data: {
        courseId: parsed.data.courseId,
        name: parsed.data.name,
        code: parsed.data.code || null,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        maxStudents: parsed.data.maxStudents,
        professorId: parsed.data.professorId || null,
        schedule: schedule || undefined,
        notes: parsed.data.notes,
        status: parsed.data.status,
      },
    });

    await prisma.enrollmentAudit.create({
      data: {
        action: "COURSE_UPDATED",
        actorId: adminId,
        targetType: "Class",
        targetId: cls.id,
        details: `Turma atualizada: ${cls.name}`,
      },
    });

    revalidatePath("/admin/turmas");
    revalidatePath(`/admin/cursos/${cls.courseId}`);
    return { ok: true, message: "Turma atualizada!" };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao atualizar turma." };
  }
}

export async function deleteClassAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.class.delete({ where: { id } });
  revalidatePath("/admin/turmas");
  revalidatePath(`/admin/cursos`);
}

export async function enrollStudentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const adminId = await requireAdmin();

    const data = {
      classId: formData.get("classId") as string,
      leadId: formData.get("leadId") as string,
      notes: (formData.get("notes") as string) || undefined,
    };

    if (!data.classId || !data.leadId) {
      return { ok: false, error: "Selecione a turma e o aluno." };
    }

    // Valida capacidade
    const cls = await prisma.class.findUnique({
      where: { id: data.classId },
      include: { _count: { select: { students: { where: { status: "ATIVA" } } } } },
    });
    if (!cls) return { ok: false, error: "Turma não encontrada." };
    if (cls._count.students >= cls.maxStudents) {
      return {
        ok: false,
        error: `Turma lotada (${cls.maxStudents} vagas).`,
      };
    }

    // Valida duplicado
    const existing = await prisma.classStudent.findUnique({
      where: { classId_leadId: { classId: data.classId, leadId: data.leadId } },
    });
    if (existing) {
      return { ok: false, error: "Aluno já matriculado nesta turma." };
    }

    const enrollment = await prisma.classStudent.create({
      data: {
        classId: data.classId,
        leadId: data.leadId,
        notes: data.notes,
        status: "ATIVA",
      },
    });

    await prisma.enrollmentAudit.create({
      data: {
        action: "PRE_ENROLLMENT_APPROVED", // reuse (matrícula efetivada)
        actorId: adminId,
        targetType: "ClassStudent",
        targetId: enrollment.id,
        details: `Matriculou aluno na turma ${cls.name}`,
      },
    });

    revalidatePath("/admin/turmas");
    revalidatePath(`/admin/cursos`);
    return { ok: true, message: "Aluno matriculado!" };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao matricular aluno." };
  }
}

export async function unenrollStudentAction(
  classStudentId: string
): Promise<void> {
  await requireAdmin();
  const cs = await prisma.classStudent.findUnique({
    where: { id: classStudentId },
    include: { class: true },
  });
  if (!cs) return;

  await prisma.classStudent.delete({ where: { id: classStudentId } });

  const adminId = (await auth())?.user?.id as string;
  await prisma.enrollmentAudit.create({
    data: {
      action: "PRE_ENROLLMENT_RETURNED", // reuse
      actorId: adminId,
      targetType: "ClassStudent",
      targetId: classStudentId,
      details: `Removeu aluno da turma ${cs.class.name}`,
    },
  });

  revalidatePath("/admin/turmas");
}

export async function updateEnrollmentStatusAction(
  classStudentId: string,
  status: "ATIVA" | "TRANCADA" | "CONCLUIDA" | "CANCELADA"
): Promise<void> {
  await requireAdmin();
  await prisma.classStudent.update({
    where: { id: classStudentId },
    data: {
      status,
      finishedAt: status === "CONCLUIDA" ? new Date() : null,
    },
  });
  revalidatePath("/admin/turmas");
}
