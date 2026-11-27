"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Formas de pagamento — cadastro pedido pela cliente ("onde cadastrar mais
 * formas de pagamento"). Antes a lista era fixa no código.
 *
 * As formas ativas alimentam:
 *   - o cadastro de curso (Administração › Cursos)
 *   - a matrícula (Vendas › Matrícula) e a ficha do aluno
 */

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user) throw new Error("Não autenticado");
  if (role !== "ADMIN") {
    throw new Error("Acesso negado: apenas administradores.");
  }
  return session.user as { id: string; role: string };
}

const formaSchema = z.object({
  description: z
    .string()
    .min(2, "Informe a descrição da forma de pagamento")
    .max(80, "Máximo de 80 caracteres"),
  active: z.boolean(),
});

function revalidateFormas() {
  revalidatePath("/admin/formas-pagamento");
  revalidatePath("/admin/cursos");
  revalidatePath("/admin/cursos/[id]");
  revalidatePath("/vendas/leads/[id]/matricula");
  revalidatePath("/alunos");
  revalidatePath("/alunos/[id]");
}

/** Cria uma nova forma de pagamento. */
export async function createPaymentMethodAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const parsed = formaSchema.safeParse({
      description: (formData.get("description") as string)?.trim() ?? "",
      active: formData.get("active") === "on" || formData.get("active") === "true",
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const duplicada = await prisma.paymentMethodType.findUnique({
      where: { description: parsed.data.description },
      select: { id: true },
    });
    if (duplicada) {
      return { ok: false, error: "Já existe uma forma de pagamento com essa descrição." };
    }

    await prisma.paymentMethodType.create({
      data: {
        description: parsed.data.description,
        active: parsed.data.active,
      },
    });

    revalidateFormas();
    return { ok: true, message: "Forma de pagamento cadastrada." };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao cadastrar a forma de pagamento." };
  }
}

/** Edita a descrição e a situação de uma forma de pagamento. */
export async function updatePaymentMethodAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const parsed = formaSchema.safeParse({
      description: (formData.get("description") as string)?.trim() ?? "",
      active: formData.get("active") === "on" || formData.get("active") === "true",
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const atual = await prisma.paymentMethodType.findUnique({
      where: { id },
      select: { id: true, description: true },
    });
    if (!atual) return { ok: false, error: "Forma de pagamento não encontrada." };

    const duplicada = await prisma.paymentMethodType.findUnique({
      where: { description: parsed.data.description },
      select: { id: true },
    });
    if (duplicada && duplicada.id !== id) {
      return { ok: false, error: "Já existe uma forma de pagamento com essa descrição." };
    }

    await prisma.paymentMethodType.update({
      where: { id },
      data: {
        description: parsed.data.description,
        active: parsed.data.active,
      },
    });

    // Cursos e matrículas guardam o texto da forma: sincroniza o novo nome.
    if (atual.description !== parsed.data.description) {
      await prisma.coursePaymentMethod.updateMany({
        where: { method: atual.description },
        data: { method: parsed.data.description },
      });
      await prisma.enrollment.updateMany({
        where: { paymentMethod: atual.description },
        data: { paymentMethod: parsed.data.description },
      });
    }

    revalidateFormas();
    return { ok: true, message: "Forma de pagamento atualizada." };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao atualizar a forma de pagamento." };
  }
}

/** Alterna a situação (Ativo / Inativo). */
export async function togglePaymentMethodAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const atual = await prisma.paymentMethodType.findUnique({
      where: { id },
      select: { id: true, active: true, description: true },
    });
    if (!atual) return { ok: false, error: "Forma de pagamento não encontrada." };

    const novoSituacao = formData.get("active") === "true" ? true : !atual.active;

    await prisma.paymentMethodType.update({
      where: { id },
      data: { active: novoSituacao },
    });

    revalidateFormas();
    return {
      ok: true,
      message: `${atual.description} agora está ${novoSituacao ? "ativa" : "inativa"}.`,
    };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao alterar a situação." };
  }
}

/** Exclui a forma de pagamento (só se não estiver em uso). */
export async function deletePaymentMethodAction(
  id: string,
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const forma = await prisma.paymentMethodType.findUnique({
      where: { id },
      select: { id: true, description: true },
    });
    if (!forma) return { ok: false, error: "Forma de pagamento não encontrada." };

    const [emCursos, emMatriculas] = await Promise.all([
      prisma.coursePaymentMethod.count({ where: { method: forma.description } }),
      prisma.enrollment.count({ where: { paymentMethod: forma.description } }),
    ]);

    const usos = emCursos + emMatriculas;
    if (usos > 0) {
      return {
        ok: false,
        error: `Esta forma está em uso em ${usos} registro(s). Altere a situação para Inativo em vez de excluir.`,
      };
    }

    await prisma.paymentMethodType.delete({ where: { id } });

    revalidateFormas();
    return { ok: true, message: "Forma de pagamento excluída." };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao excluir a forma de pagamento." };
  }
}
