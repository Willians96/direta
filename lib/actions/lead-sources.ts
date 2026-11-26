"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Formas de Conhecimento (Fontes) — "de onde o cliente veio".
 *
 * Tela pedida pela cliente (menu Captação):
 *   Descrição | Não gerar comissão | Situação (Ativo / Inativo)
 *
 * O cadastro é consultado no formulário de lead e alimenta o painel de
 * Captação (bloco FONTE / CONHECIMENTO).
 */

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

/** Quem administra as fontes: ADMIN e CAPTAÇÃO. */
async function requireCapacao() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "CAPTACAO") {
    throw new Error("Acesso negado: apenas administração ou captação.");
  }
  return session.user as { id: string; role: string };
}

const fonteSchema = z.object({
  description: z
    .string()
    .min(2, "Informe a descrição da forma de conhecimento")
    .max(80, "Máximo de 80 caracteres"),
  noCommission: z.boolean(),
  active: z.boolean(),
});

function revalidateFontes() {
  revalidatePath("/captacao/fontes");
  revalidatePath("/captacao/leads");
  revalidatePath("/captacao/leads/novo");
  revalidatePath("/captacao");
  revalidatePath("/vendas/leads");
  revalidatePath("/vendas/leads/[id]");
}

/** Cria uma nova forma de conhecimento. */
export async function createLeadSourceAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireCapacao();

    const parsed = fonteSchema.safeParse({
      description: (formData.get("description") as string)?.trim() ?? "",
      noCommission: formData.get("noCommission") === "on" || formData.get("noCommission") === "true",
      active: formData.get("active") === "on" || formData.get("active") === "true",
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const duplicada = await prisma.leadSource.findUnique({
      where: { description: parsed.data.description },
      select: { id: true },
    });
    if (duplicada) {
      return { ok: false, error: "Já existe uma forma de conhecimento com essa descrição." };
    }

    await prisma.leadSource.create({
      data: {
        description: parsed.data.description,
        noCommission: parsed.data.noCommission,
        active: parsed.data.active,
      },
    });

    revalidateFontes();
    return { ok: true, message: "Forma de conhecimento cadastrada." };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao cadastrar a forma de conhecimento." };
  }
}

/** Edita a descrição, a flag de comissão e a situação. */
export async function updateLeadSourceAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireCapacao();

    const parsed = fonteSchema.safeParse({
      description: (formData.get("description") as string)?.trim() ?? "",
      noCommission: formData.get("noCommission") === "on" || formData.get("noCommission") === "true",
      active: formData.get("active") === "on" || formData.get("active") === "true",
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const atual = await prisma.leadSource.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!atual) return { ok: false, error: "Forma de conhecimento não encontrada." };

    const duplicada = await prisma.leadSource.findUnique({
      where: { description: parsed.data.description },
      select: { id: true },
    });
    if (duplicada && duplicada.id !== id) {
      return { ok: false, error: "Já existe uma forma de conhecimento com essa descrição." };
    }

    await prisma.leadSource.update({
      where: { id },
      data: {
        description: parsed.data.description,
        noCommission: parsed.data.noCommission,
        active: parsed.data.active,
      },
    });

    // Os leads que apontam para esta fonte mantêm o nome antigo no texto:
    // sincroniza para a nova descrição.
    await prisma.lead.updateMany({
      where: { sourceId: id },
      data: { source: parsed.data.description },
    });

    revalidateFontes();
    return { ok: true, message: "Forma de conhecimento atualizada." };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao atualizar a forma de conhecimento." };
  }
}

/** Alterna a situação (Ativo / Inativo). */
export async function toggleLeadSourceAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireCapacao();

    const atual = await prisma.leadSource.findUnique({
      where: { id },
      select: { id: true, active: true, description: true },
    });
    if (!atual) return { ok: false, error: "Forma de conhecimento não encontrada." };

    const novoSituacao = formData.get("active") === "true" ? true : !atual.active;

    await prisma.leadSource.update({
      where: { id },
      data: { active: novoSituacao },
    });

    revalidateFontes();
    return {
      ok: true,
      message: `${atual.description} agora está ${novoSituacao ? "ativa" : "inativa"}.`,
    };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao alterar a situação." };
  }
}

/** Exclui a forma de conhecimento (só se nenhum lead estiver vinculado). */
export async function deleteLeadSourceAction(
  id: string,
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  try {
    await requireCapacao();

    const fonte = await prisma.leadSource.findUnique({
      where: { id },
      select: { id: true, description: true, _count: { select: { leads: true } } },
    });
    if (!fonte) return { ok: false, error: "Forma de conhecimento não encontrada." };

    if (fonte._count.leads > 0) {
      return {
        ok: false,
        error: `Esta fonte está vinculada a ${fonte._count.leads} lead(s). Altere a situação para Inativo em vez de excluir.`,
      };
    }

    await prisma.leadSource.delete({ where: { id } });

    revalidateFontes();
    return { ok: true, message: "Forma de conhecimento excluída." };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao excluir a forma de conhecimento." };
  }
}
