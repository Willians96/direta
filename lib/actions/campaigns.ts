"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const campaignSchema = z.object({
  name: z.string().min(3, "Nome obrigatório"),
  channel: z.enum([
    "INSTAGRAM",
    "FACEBOOK",
    "GOOGLE_ADS",
    "WHATSAPP",
    "EMAIL",
    "INDICACAO",
    "OUTRO",
  ]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  budget: z.coerce.number().positive().optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["PLANEJADA", "ATIVA", "PAUSADA", "ENCERRADA"]).default("PLANEJADA"),
});

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

async function requireCaptacaoOrAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "CAPTACAO") {
    throw new Error("Acesso negado.");
  }
  return (session?.user as any)?.id as string;
}

export async function createCampaignAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const actorId = await requireCaptacaoOrAdmin();

    const data = {
      name: formData.get("name") as string,
      channel: formData.get("channel") as string,
      startDate: formData.get("startDate") as string,
      endDate: (formData.get("endDate") as string) || undefined,
      budget: (formData.get("budget") as string) || undefined,
      description: (formData.get("description") as string) || undefined,
      status: (formData.get("status") as string) || "PLANEJADA",
    };

    const parsed = campaignSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }

    const campaign = await prisma.campaign.create({
      data: {
        name: parsed.data.name,
        channel: parsed.data.channel,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        budget: parsed.data.budget,
        description: parsed.data.description,
        status: parsed.data.status,
        createdById: actorId,
      },
    });

    await prisma.enrollmentAudit.create({
      data: {
        action: "COURSE_CREATED", // reuse
        actorId,
        targetType: "Campaign",
        targetId: campaign.id,
        details: `Campanha criada: ${campaign.name}`,
      },
    });

    revalidatePath("/captacao/campanhas");
    return { ok: true, message: "Campanha criada com sucesso!" };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao criar campanha." };
  }
}

export async function updateCampaignAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const actorId = await requireCaptacaoOrAdmin();

    const data = {
      name: formData.get("name") as string,
      channel: formData.get("channel") as string,
      startDate: formData.get("startDate") as string,
      endDate: (formData.get("endDate") as string) || undefined,
      budget: (formData.get("budget") as string) || undefined,
      description: (formData.get("description") as string) || undefined,
      status: formData.get("status") as string,
    };

    const parsed = campaignSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        name: parsed.data.name,
        channel: parsed.data.channel,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        budget: parsed.data.budget,
        description: parsed.data.description,
        status: parsed.data.status,
      },
    });

    await prisma.enrollmentAudit.create({
      data: {
        action: "COURSE_UPDATED",
        actorId,
        targetType: "Campaign",
        targetId: campaign.id,
        details: `Campanha atualizada: ${campaign.name}`,
      },
    });

    revalidatePath("/captacao/campanhas");
    return { ok: true, message: "Campanha atualizada!" };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao atualizar campanha." };
  }
}

export async function toggleCampaignStatusAction(id: string): Promise<void> {
  const actorId = await requireCaptacaoOrAdmin();
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c) return;

  const next =
    c.status === "PLANEJADA"
      ? "ATIVA"
      : c.status === "ATIVA"
      ? "PAUSADA"
      : c.status === "PAUSADA"
      ? "ATIVA"
      : "PLANEJADA";

  await prisma.campaign.update({
    where: { id },
    data: { status: next },
  });

  await prisma.enrollmentAudit.create({
    data: {
      action: "COURSE_STATUS_CHANGED",
      actorId,
      targetType: "Campaign",
      targetId: id,
      details: `${c.name} → ${next}`,
    },
  });

  revalidatePath("/captacao/campanhas");
}
