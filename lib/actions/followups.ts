"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { FollowupType, FollowupOutcome, LeadStatus } from "@prisma/client";

/**
 * Sprint 10 — Follow-ups, Clientes parados e Alertas.
 *
 * Um lead é considerado "parado" quando:
 *  - tem status ativo (não PERDIDA / não APROVADA finalizada)
 *  - e (nunca houve followup OU último followup occurredAt < cutoff)
 *
 * A métrica usa updatedAt como fallback (caso nunca houve followup).
 */

const ACTIVE_STATUSES: LeadStatus[] = [
  "NOVO",
  "QUALIFICADO",
  "PROPOSTA_ENVIADA",
  "EM_NEGOCIACAO",
  "AGUARDANDO_ANALISE",
  "DEVOLVIDA_AJUSTE",
];

const registerSchema = z.object({
  leadId: z.string().min(1),
  type: z.nativeEnum(FollowupType),
  outcome: z.nativeEnum(FollowupOutcome),
  notes: z.string().max(2000).optional(),
  nextAction: z.string().optional(), // ISO datetime — vazio = sem próximo
  occurredAt: z.string().optional(), // ISO datetime — default now
});

export type RegisterFollowupInput = z.infer<typeof registerSchema>;

async function requireActor() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");
  return session.user as { id: string; role: "ADMIN" | "CAPTACAO" | "VENDAS" | "RECEPCAO"; name: string };
}

export async function registerFollowupAction(raw: RegisterFollowupInput) {
  const actor = await requireActor();
  const parsed = registerSchema.parse(raw);

  const nextAction = parsed.nextAction && parsed.nextAction !== ""
    ? new Date(parsed.nextAction)
    : null;
  const occurredAt = parsed.occurredAt && parsed.occurredAt !== ""
    ? new Date(parsed.occurredAt)
    : new Date();

  const lead = await prisma.lead.findUnique({
    where: { id: parsed.leadId },
    select: { id: true, assignedToId: true, status: true },
  });
  if (!lead) throw new Error("Lead não encontrado");

  // RBAC: vendedor só registra follow-up nos próprios leads
  if (actor.role === "VENDAS" && lead.assignedToId !== actor.id) {
    throw new Error("Sem permissão para registrar follow-up neste lead");
  }

  const followup = await prisma.followup.create({
    data: {
      leadId: parsed.leadId,
      userId: actor.id,
      type: parsed.type,
      outcome: parsed.outcome,
      notes: parsed.notes,
      nextAction,
      occurredAt,
    },
  });

  await prisma.enrollmentAudit.create({
    data: {
      leadId: lead.id,
      action: "LEAD_STATUS_CHANGED", // reuse — enum sem FOLLOWUP_CREATED
      actorId: actor.id,
      targetType: "Followup",
      targetId: followup.id,
      details: `Follow-up ${parsed.type} (${parsed.outcome})${
        nextAction ? ` — próximo: ${nextAction.toISOString().slice(0, 10)}` : ""
      }`,
    },
  });

  revalidatePath(`/vendas/leads/${lead.id}`);
  revalidatePath(`/captacao/leads/${lead.id}`);
  revalidatePath("/vendas");
  revalidatePath("/admin");
  revalidatePath("/admin/alertas");
  revalidatePath("/captacao");

  return { ok: true, id: followup.id };
}

export async function markNextActionDoneAction(followupId: string) {
  const actor = await requireActor();
  const f = await prisma.followup.findUnique({
    where: { id: followupId },
    select: {
      id: true,
      leadId: true,
      lead: { select: { assignedToId: true } },
    },
  });
  if (!f) throw new Error("Follow-up não encontrado");
  if (actor.role === "VENDAS" && f.lead.assignedToId !== actor.id) {
    throw new Error("Sem permissão");
  }

  await prisma.followup.update({
    where: { id: followupId },
    data: { nextActionDone: true },
  });

  revalidatePath(`/vendas/leads/${f.leadId}`);
  revalidatePath(`/captacao/leads/${f.leadId}`);
  revalidatePath("/admin/alertas");
  return { ok: true };
}

/**
 * Lista os follow-ups de um lead (mais recente primeiro).
 */
export async function getLeadFollowups(leadId: string) {
  await requireActor();
  return prisma.followup.findMany({
    where: { leadId },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
    orderBy: { occurredAt: "desc" },
  });
}

export type StaleLead = {
  id: string;
  fullName: string;
  status: LeadStatus;
  courseName: string | null;
  assignedTo: { id: string; name: string } | null;
  lastContactAt: Date;
  lastNextAction: Date | null;
  lastNextActionDone: boolean;
  daysSinceLastContact: number;
};

/**
 * Retorna leads "parados" há mais de `days` dias.
 * @param scope "all" — admin/captação veem todos | "mine" — vendedor vê os próprios
 */
export async function getStaleLeads(
  days: number,
  scope: "all" | "mine" = "all",
): Promise<StaleLead[]> {
  await requireActor();

  const leads = await prisma.lead.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
    },
    include: {
      followups: {
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: {
          occurredAt: true,
          nextAction: true,
          nextActionDone: true,
          type: true,
        },
      },
      assignedTo: { select: { id: true, name: true } },
      course: { select: { name: true } },
    },
    orderBy: { updatedAt: "asc" },
  });

  const scopeUserId = scope === "mine"
    ? (await requireActor()).id
    : null;

  return leads
    .filter((l) => (scopeUserId ? l.assignedToId === scopeUserId : true))
    .map<StaleLead>((l) => {
      const last = l.followups[0]?.occurredAt ?? l.updatedAt;
      const daysSince = Math.floor(
        (Date.now() - new Date(last).getTime()) / 86_400_000,
      );
      return {
        id: l.id,
        fullName: l.fullName,
        status: l.status,
        courseName: l.course?.name ?? null,
        assignedTo: l.assignedTo,
        lastContactAt: last,
        lastNextAction: l.followups[0]?.nextAction ?? null,
        lastNextActionDone: l.followups[0]?.nextActionDone ?? true,
        daysSinceLastContact: daysSince,
      };
    })
    .filter((l) => l.daysSinceLastContact >= days);
}

/**
 * Próximos contatos pendentes (nextAction >= hoje e !done).
 */
export async function getUpcomingFollowups(withinDays = 7, scope: "all" | "mine" = "all") {
  const actor = await requireActor();
  const now = new Date();
  const limit = new Date();
  limit.setDate(limit.getDate() + withinDays);

  return prisma.followup.findMany({
    where: {
      nextActionDone: false,
      nextAction: { gte: now, lte: limit },
      ...(scope === "mine" ? { lead: { assignedToId: actor.id } } : {}),
    },
    include: {
      lead: { select: { id: true, fullName: true, status: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { nextAction: "asc" },
  });
}

/**
 * Métricas do dia: total de follow-ups ocorridos e breakdown por tipo.
 */
export async function getTodayFollowupMetrics(scope: "all" | "mine" = "all") {
  const actor = await requireActor();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const where = {
    occurredAt: { gte: start, lte: end },
    ...(scope === "mine" ? { userId: actor.id } : {}),
  };

  const [total, byType] = await Promise.all([
    prisma.followup.count({ where }),
    prisma.followup.groupBy({
      by: ["type"],
      where,
      _count: { _all: true },
    }),
  ]);

  return {
    total,
    byType: byType.map((b) => ({ type: b.type, count: b._count._all })),
  };
}
