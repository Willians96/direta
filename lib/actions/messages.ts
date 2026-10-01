"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { MessageChannel, MessageDirection } from "@prisma/client";

/**
 * Sprint 13 — Chat-log por lead (modal popup).
 *
 * Cada mensagem é registrada com:
 *  - channel (WHATSAPP / LIGACAO / EMAIL / REUNIAO / PRESENCIAL / OUTRO)
 *  - direction (OUTBOUND / INBOUND / INTERNAL)
 *  - content (texto livre)
 *
 * A gerência vê todas as conversas em /admin/conversas.
 */

const messageSchema = z.object({
  leadId: z.string().min(1),
  channel: z.nativeEnum(MessageChannel),
  direction: z.nativeEnum(MessageDirection),
  content: z.string().min(1).max(5000),
});

export type RegisterMessageInput = z.infer<typeof messageSchema>;

async function requireActor() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");
  return session.user as { id: string; role: "ADMIN" | "CAPTACAO" | "VENDAS" | "RECEPCAO"; name: string };
}

export async function logLeadMessageAction(raw: RegisterMessageInput) {
  const actor = await requireActor();
  const parsed = messageSchema.parse(raw);

  const lead = await prisma.lead.findUnique({
    where: { id: parsed.leadId },
    select: { id: true, assignedToId: true, fullName: true },
  });
  if (!lead) throw new Error("Lead não encontrado");

  // Vendedor só registra nos próprios leads
  if (actor.role === "VENDAS" && lead.assignedToId !== actor.id) {
    throw new Error("Sem permissão para registrar mensagem neste lead");
  }

  const msg = await prisma.leadMessage.create({
    data: {
      leadId: parsed.leadId,
      userId: actor.id,
      channel: parsed.channel,
      direction: parsed.direction,
      content: parsed.content,
    },
  });

  await prisma.enrollmentAudit.create({
    data: {
      leadId: lead.id,
      action: "LEAD_STATUS_CHANGED", // reuse — não há MESSAGE_LOGGED
      actorId: actor.id,
      targetType: "LeadMessage",
      targetId: msg.id,
      details: `Mensagem ${parsed.channel}/${parsed.direction}: "${parsed.content.slice(0, 80)}${parsed.content.length > 80 ? "..." : ""}"`,
    },
  });

  // Atualizar updatedAt do lead para o card de "alertas" recalcular
  await prisma.lead.update({
    where: { id: lead.id },
    data: { updatedAt: new Date() },
  });

  revalidatePath(`/vendas/leads/${lead.id}`);
  revalidatePath(`/captacao/leads/${lead.id}`);
  revalidatePath("/vendas/alertas");
  revalidatePath("/admin/alertas");
  revalidatePath("/admin/conversas");

  return { ok: true, id: msg.id };
}

/**
 * Lista as mensagens de um lead (mais antiga → mais recente).
 */
export async function getLeadMessages(leadId: string) {
  await requireActor();
  return prisma.leadMessage.findMany({
    where: { leadId },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
    orderBy: { occurredAt: "asc" },
  });
}

/**
 * Resumo das conversas mais recentes para a gerência.
 * Retorna 1 card por lead que tem mensagens.
 */
export async function getRecentConversations(limit = 50) {
  const actor = await requireActor();
  if (actor.role !== "ADMIN" && actor.role !== "CAPTACAO") {
    throw new Error("Sem permissão");
  }

  // Agregar por lead — última mensagem + total
  const leads = await prisma.lead.findMany({
    where: {
      messages: { some: {} },
    },
    include: {
      messages: {
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: {
          id: true,
          content: true,
          channel: true,
          direction: true,
          occurredAt: true,
          user: { select: { name: true } },
        },
      },
      _count: { select: { messages: true } },
      assignedTo: { select: { id: true, name: true } },
      course: { select: { name: true } },
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  // Ordenar por última mensagem (mais recente primeiro)
  return leads
    .map((l) => ({
      id: l.id,
      fullName: l.fullName,
      phone: l.phone,
      status: l.status,
      assignedTo: l.assignedTo,
      courseName: l.course?.name ?? null,
      totalMessages: l._count.messages,
      lastMessage: l.messages[0] ?? null,
    }))
    .sort((a, b) => {
      const ta = a.lastMessage?.occurredAt?.getTime() ?? 0;
      const tb = b.lastMessage?.occurredAt?.getTime() ?? 0;
      return tb - ta;
    });
}
