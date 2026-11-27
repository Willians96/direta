"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Situações de turma — cadastro pedido pela cliente ("onde consigo alterar ou
 * criar os status" da turma). Antes a lista era fixa no código.
 *
 * As situações ativas alimentam o select de Status do cadastro de turma.
 * "ABERTA" e "EM_ANDAMENTO" continuam sendo as turmas que aceitam matrícula.
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

const situacaoSchema = z.object({
  description: z
    .string()
    .min(2, "Informe a descrição da situação")
    .max(60, "Máximo de 60 caracteres"),
  active: z.boolean(),
});

function revalidateSituacoes() {
  revalidatePath("/admin/situacoes-turma");
  revalidatePath("/admin/turmas");
  revalidatePath("/admin/turmas/[id]");
  revalidatePath("/vendas/leads/[id]/matricula");
}

/** Cria uma nova situação de turma. */
export async function createClassStatusAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const parsed = situacaoSchema.safeParse({
      description: (formData.get("description") as string)?.trim() ?? "",
      active: formData.get("active") === "on" || formData.get("active") === "true",
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const duplicada = await prisma.classStatusType.findUnique({
      where: { description: parsed.data.description },
      select: { id: true },
    });
    if (duplicada) {
      return { ok: false, error: "Já existe uma situação de turma com essa descrição." };
    }

    await prisma.classStatusType.create({
      data: {
        description: parsed.data.description,
        active: parsed.data.active,
      },
    });

    revalidateSituacoes();
    return { ok: true, message: "Situação de turma cadastrada." };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao cadastrar a situação de turma." };
  }
}

/** Edita a descrição e a situação. */
export async function updateClassStatusAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const parsed = situacaoSchema.safeParse({
      description: (formData.get("description") as string)?.trim() ?? "",
      active: formData.get("active") === "on" || formData.get("active") === "true",
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const atual = await prisma.classStatusType.findUnique({
      where: { id },
      select: { id: true, description: true },
    });
    if (!atual) return { ok: false, error: "Situação de turma não encontrada." };

    const duplicada = await prisma.classStatusType.findUnique({
      where: { description: parsed.data.description },
      select: { id: true },
    });
    if (duplicada && duplicada.id !== id) {
      return { ok: false, error: "Já existe uma situação de turma com essa descrição." };
    }

    await prisma.classStatusType.update({
      where: { id },
      data: {
        description: parsed.data.description,
        active: parsed.data.active,
      },
    });

    // As turmas guardam o texto da situação: sincroniza o novo nome.
    if (atual.description !== parsed.data.description) {
      await prisma.class.updateMany({
        where: { status: atual.description },
        data: { status: parsed.data.description },
      });
    }

    revalidateSituacoes();
    return { ok: true, message: "Situação de turma atualizada." };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao atualizar a situação de turma." };
  }
}

/** Alterna a situação (Ativo / Inativo). */
export async function toggleClassStatusAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const atual = await prisma.classStatusType.findUnique({
      where: { id },
      select: { id: true, active: true, description: true },
    });
    if (!atual) return { ok: false, error: "Situação de turma não encontrada." };

    const novoSituacao = formData.get("active") === "true" ? true : !atual.active;

    await prisma.classStatusType.update({
      where: { id },
      data: { active: novoSituacao },
    });

    revalidateSituacoes();
    return {
      ok: true,
      message: `${atual.description} agora está ${novoSituacao ? "ativa" : "inativa"}.`,
    };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao alterar a situação." };
  }
}

/** Exclui a situação de turma (só se nenhuma turma estiver usando). */
export async function deleteClassStatusAction(
  id: string,
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const situacao = await prisma.classStatusType.findUnique({
      where: { id },
      select: { id: true, description: true },
    });
    if (!situacao) return { ok: false, error: "Situação de turma não encontrada." };

    const emUso = await prisma.class.count({ where: { status: situacao.description } });
    if (emUso > 0) {
      return {
        ok: false,
        error: `Esta situação está em uso em ${emUso} turma(s). Altere a situação para Inativo em vez de excluir.`,
      };
    }

    await prisma.classStatusType.delete({ where: { id } });

    revalidateSituacoes();
    return { ok: true, message: "Situação de turma excluída." };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao excluir a situação de turma." };
  }
}
