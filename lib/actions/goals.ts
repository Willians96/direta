"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const goalSchema = z.object({
  userId: z.string().cuid(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  metaMatricula: z.coerce.number().int().min(0),
  metaFaturamento: z.coerce.number().min(0),
  metaFollowup: z.coerce.number().int().min(0),
  metaIndicacao: z.coerce.number().int().min(0),
  notes: z.string().max(500).optional(),
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
  return (session?.user as any).id as string;
}

export async function upsertGoalAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const data = {
      userId: formData.get("userId") as string,
      month: formData.get("month") as string,
      year: formData.get("year") as string,
      metaMatricula: formData.get("metaMatricula") as string,
      metaFaturamento: formData.get("metaFaturamento") as string,
      metaFollowup: formData.get("metaFollowup") as string,
      metaIndicacao: formData.get("metaIndicacao") as string,
      notes: (formData.get("notes") as string) || undefined,
    };

    const parsed = goalSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }

    await prisma.goal.upsert({
      where: {
        userId_month_year: {
          userId: parsed.data.userId,
          month: parsed.data.month,
          year: parsed.data.year,
        },
      },
      create: {
        userId: parsed.data.userId,
        month: parsed.data.month,
        year: parsed.data.year,
        metaMatricula: parsed.data.metaMatricula,
        metaFaturamento: parsed.data.metaFaturamento,
        metaFollowup: parsed.data.metaFollowup,
        metaIndicacao: parsed.data.metaIndicacao,
        notes: parsed.data.notes,
      },
      update: {
        metaMatricula: parsed.data.metaMatricula,
        metaFaturamento: parsed.data.metaFaturamento,
        metaFollowup: parsed.data.metaFollowup,
        metaIndicacao: parsed.data.metaIndicacao,
        notes: parsed.data.notes,
      },
    });

    revalidatePath("/admin/metas");
    revalidatePath("/vendas");
    revalidatePath("/captacao");
    revalidatePath("/admin");

    return { ok: true, message: "Meta salva com sucesso!" };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao salvar meta." };
  }
}

export async function deleteGoalAction(
  userId: string,
  month: number,
  year: number
): Promise<void> {
  await requireAdmin();
  await prisma.goal.delete({
    where: {
      userId_month_year: { userId, month, year },
    },
  });
  revalidatePath("/admin/metas");
}

/**
 * Calcula o progresso de cada meta para um vendedor no mês atual
 */
export async function getGoalProgress(userId: string, month: number, year: number) {
  const goal = await prisma.goal.findUnique({
    where: { userId_month_year: { userId, month, year } },
  });

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  // Matrículas no mês (leads que viraram aprovados)
  const matriculas = await prisma.lead.count({
    where: {
      assignedToId: userId,
      status: "APROVADA",
      updatedAt: { gte: startOfMonth, lte: endOfMonth },
    },
  });

  // Faturamento (soma dos preços dos cursos nos leads aprovados)
  const leadsAprovados = await prisma.lead.findMany({
    where: {
      assignedToId: userId,
      status: "APROVADA",
      updatedAt: { gte: startOfMonth, lte: endOfMonth },
    },
    include: { course: { select: { price: true } } },
  });
  const faturamento = leadsAprovados.reduce(
    (acc, l) => acc + Number(l.course?.price ?? 0),
    0
  );

  // Acionamentos = mudanças de status (toda Interaction conta como acionamento)
  const followup = await prisma.interaction.count({
    where: {
      createdById: userId,
      occurredAt: { gte: startOfMonth, lte: endOfMonth },
    },
  });

  // Indicações = leads com campaign INDICACAO
  const indicacao = await prisma.lead.count({
    where: {
      assignedToId: userId,
      status: { in: ["QUALIFICADO", "PROPOSTA_ENVIADA", "EM_NEGOCIACAO", "AGUARDANDO_ANALISE", "APROVADA", "DEVOLVIDA_AJUSTE"] },
      createdAt: { gte: startOfMonth, lte: endOfMonth },
      campaign: { channel: "INDICACAO" },
    },
  });

  return {
    goal,
    realized: {
      matriculas,
      faturamento,
      followup,
      indicacao,
    },
  };
}
