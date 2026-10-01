"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const paymentMethodEnum = z.enum([
  "PIX",
  "BOLETO",
  "CARTAO_CREDITO",
  "CARTAO_DEBITO",
  "DINHEIRO",
  "TRANSFERENCIA",
  "PARCELADO_PROPRIO",
  "OUTRO",
]);

const courseSchema = z.object({
  name: z.string().min(3, "Nome obrigatório"),
  description: z.string().max(1000).optional(),
  workloadHours: z.coerce.number().int().positive("Carga horária deve ser positiva"),
  price: z.coerce.number().positive("Preço deve ser positivo"),
  syllabus: z.string().max(5000).optional(),
  status: z.enum(["ATIVO", "INATIVO", "EM_BREVE"]).default("ATIVO"),
});

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") {
    throw new Error("Acesso negado: apenas administradores.");
  }
  const adminId = (session?.user as any)?.id as string;
  return adminId;
}

interface PaymentMethodInput {
  method: z.infer<typeof paymentMethodEnum>;
  details?: string;
  active?: boolean;
}

function parsePaymentMethods(formData: FormData): PaymentMethodInput[] {
  const methods = formData.getAll("paymentMethod") as string[];
  const details = formData.getAll("paymentDetails") as string[];
  const result: PaymentMethodInput[] = [];
  methods.forEach((m, i) => {
    if (!m) return;
    const parsed = paymentMethodEnum.safeParse(m);
    if (!parsed.success) return;
    result.push({
      method: parsed.data,
      details: details[i] || undefined,
      active: true,
    });
  });
  return result;
}

async function upsertPaymentMethods(courseId: string, items: PaymentMethodInput[]) {
  // Remove todos os antigos e recria (estratégia simples pra CRUD básico)
  await prisma.coursePaymentMethod.deleteMany({ where: { courseId } });
  if (items.length === 0) return;
  await prisma.coursePaymentMethod.createMany({
    data: items.map((it) => ({
      courseId,
      method: it.method,
      details: it.details || null,
      active: it.active ?? true,
    })),
  });
}

export async function createCourseAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const adminId = await requireAdmin();

    const data = {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || undefined,
      workloadHours: formData.get("workloadHours") as string,
      price: formData.get("price") as string,
      syllabus: (formData.get("syllabus") as string) || undefined,
      status: (formData.get("status") as string) || "ATIVO",
    };

    const parsed = courseSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }

    const paymentMethods = parsePaymentMethods(formData);

    const course = await prisma.course.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        workloadHours: parsed.data.workloadHours,
        price: parsed.data.price,
        syllabus: parsed.data.syllabus,
        status: parsed.data.status,
      },
    });

    if (paymentMethods.length > 0) {
      await upsertPaymentMethods(course.id, paymentMethods);
    }

    await prisma.enrollmentAudit.create({
      data: {
        action: "COURSE_CREATED",
        actorId: adminId,
        targetType: "Course",
        targetId: course.id,
        details: `Curso criado: ${course.name}`,
      },
    });

    revalidatePath("/admin/cursos");
    return { ok: true, message: "Curso criado com sucesso!" };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao criar curso." };
  }
}

export async function updateCourseAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const adminId = await requireAdmin();

    const data = {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || undefined,
      workloadHours: formData.get("workloadHours") as string,
      price: formData.get("price") as string,
      syllabus: (formData.get("syllabus") as string) || undefined,
      status: formData.get("status") as string,
    };

    const parsed = courseSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }

    const paymentMethods = parsePaymentMethods(formData);

    const course = await prisma.course.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        workloadHours: parsed.data.workloadHours,
        price: parsed.data.price,
        syllabus: parsed.data.syllabus,
        status: parsed.data.status,
      },
    });

    await upsertPaymentMethods(course.id, paymentMethods);

    await prisma.enrollmentAudit.create({
      data: {
        action: "COURSE_UPDATED",
        actorId: adminId,
        targetType: "Course",
        targetId: course.id,
        details: `Curso atualizado: ${course.name}`,
      },
    });

    revalidatePath("/admin/cursos");
    revalidatePath(`/admin/cursos/${course.id}`);
    return { ok: true, message: "Curso atualizado!" };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao atualizar curso." };
  }
}

export async function toggleCourseStatusAction(id: string): Promise<void> {
  const adminId = await requireAdmin();
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) return;

  const newStatus =
    course.status === "ATIVO" ? "INATIVO" : course.status === "INATIVO" ? "EM_BREVE" : "ATIVO";

  await prisma.course.update({
    where: { id },
    data: { status: newStatus },
  });

  await prisma.enrollmentAudit.create({
    data: {
      action: "COURSE_STATUS_CHANGED",
      actorId: adminId,
      targetType: "Course",
      targetId: id,
      details: `${course.name} → ${newStatus}`,
    },
  });

  revalidatePath("/admin/cursos");
}
