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

async function requireRecepcaoOrAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "RECEPCAO") {
    throw new Error("Acesso negado: apenas recepção ou admin.");
  }
  return (session?.user as any)?.id as string;
}

const decideSchema = z.object({
  leadId: z.string().min(1),
  decision: z.enum(["APROVAR", "DEVOLVER"]),
  reason: z.string().max(500).optional(),
});

export async function decideEnrollmentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const actorId = await requireRecepcaoOrAdmin();

    const data = {
      leadId: formData.get("leadId") as string,
      decision: formData.get("decision") as string,
      reason: (formData.get("reason") as string) || undefined,
    };

    const parsed = decideSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }

    if (parsed.data.decision === "DEVOLVER" && !parsed.data.reason) {
      return {
        ok: false,
        error: "Informe o motivo da devolução.",
      };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: parsed.data.leadId },
    });
    if (!lead) return { ok: false, error: "Lead não encontrado." };
    if (lead.status !== "AGUARDANDO_ANALISE") {
      return { ok: false, error: `Lead já está como ${lead.status}.` };
    }

    const newStatus =
      parsed.data.decision === "APROVAR" ? "APROVADA" : "DEVOLVIDA_AJUSTE";

    await prisma.lead.update({
      where: { id: parsed.data.leadId },
      data: { status: newStatus },
    });

    await prisma.enrollmentAudit.create({
      data: {
        leadId: parsed.data.leadId,
        action:
          parsed.data.decision === "APROVAR"
            ? "PRE_ENROLLMENT_APPROVED"
            : "PRE_ENROLLMENT_RETURNED",
        actorId,
        targetType: "Lead",
        targetId: parsed.data.leadId,
        details: parsed.data.reason,
      },
    });

    revalidatePath("/recepcao");
    revalidatePath("/recepcao/fila");
    revalidatePath("/vendas");
    revalidatePath("/admin/auditoria");
    revalidatePath(`/vendas/leads/${parsed.data.leadId}`);

    return {
      ok: true,
      message:
        parsed.data.decision === "APROVAR"
          ? "✅ Matrícula aprovada!"
          : "↩️ Devolvida para vendas com sucesso.",
    };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao processar decisão." };
  }
}

export async function sendToAnalysisAction(
  leadId: string
): Promise<ActionState> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "Não autenticado." };

    const actorId = (session.user as any).id as string;
    const role = (session.user as any).role;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { ok: false, error: "Lead não encontrado." };

    // Vendedor pode enviar o próprio lead; admin/recepcao podem enviar qualquer
    if (
      role !== "ADMIN" &&
      role !== "RECEPCAO" &&
      lead.assignedToId !== actorId
    ) {
      return { ok: false, error: "Você não pode enviar este lead." };
    }

    if (!["QUALIFICADO", "PROPOSTA_ENVIADA", "EM_NEGOCIACAO"].includes(lead.status)) {
      return {
        ok: false,
        error: `Lead precisa estar QUALIFICADO/PROPOSTA/NEGOCIAÇÃO para enviar. Status atual: ${lead.status}.`,
      };
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "AGUARDANDO_ANALISE" },
    });

    await prisma.enrollmentAudit.create({
      data: {
        leadId,
        action: "PRE_ENROLLMENT_SUBMITTED",
        actorId,
        targetType: "Lead",
        targetId: leadId,
        details: "Enviado para análise documental",
      },
    });

    revalidatePath("/vendas");
    revalidatePath("/recepcao");
    revalidatePath("/recepcao/fila");
    revalidatePath("/admin/auditoria");

    return { ok: true, message: "📤 Enviado para análise!" };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao enviar para análise." };
  }
}
