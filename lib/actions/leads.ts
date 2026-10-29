"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { LeadPriority, SalesStatus } from "@prisma/client";
import {
  createLeadSchema,
  updateSalesStatusSchema,
  assignLeadSchema,
  updateLeadContactSchema,
  type CreateLeadInput,
} from "@/lib/validators/lead";

/**
 * Sprint 14 — Ações de Lead (ajustes da cliente).
 */

async function requireActor() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");
  return session.user as {
    id: string;
    role: "ADMIN" | "CAPTACAO" | "VENDAS" | "RECEPCAO";
    name: string;
  };
}

/** Quem pode cadastrar lead: ADMIN, CAPTACAO e VENDAS. */
export async function createLeadAction(raw: CreateLeadInput) {
  const actor = await requireActor();
  if (actor.role === "RECEPCAO") {
    throw new Error("Recepção não cadastra leads");
  }

  const data = createLeadSchema.parse(raw);

  const lead = await prisma.lead.create({
    data: {
      fullName: data.fullName,
      phone: data.phone,
      phone2: data.phone2 || null,
      phone3: data.phone3 || null,
      email: data.email || null,
      cpf: data.cpf || null,
      courseId: data.courseId || null,
      campaignId: data.campaignId || null,
      assignedToId: data.assignedToId || null,
      source: data.source || null,
      priority: data.priority as LeadPriority,
      salesStatus: data.salesStatus as SalesStatus,
      notes: data.notes || null,
      createdById: actor.id,
    },
  });

  await prisma.enrollmentAudit.create({
    data: {
      leadId: lead.id,
      action: "LEAD_CREATED",
      actorId: actor.id,
      targetType: "Lead",
      targetId: lead.id,
      details: `Lead criado — fonte: ${data.source || "não informada"}; status de venda: ${data.salesStatus}`,
    },
  });

  revalidatePath("/captacao/leads");
  revalidatePath("/vendas/leads");
  revalidatePath("/captacao");
  revalidatePath("/admin");

  return { ok: true, id: lead.id };
}

/** Atualiza o "Status de Venda" (classificação do vendedor). */
export async function updateSalesStatusAction(raw: {
  leadId: string;
  salesStatus: string;
}) {
  const actor = await requireActor();
  const data = updateSalesStatusSchema.parse(raw);

  const lead = await prisma.lead.findUnique({
    where: { id: data.leadId },
    select: { id: true, assignedToId: true, fullName: true },
  });
  if (!lead) throw new Error("Lead não encontrado");
  if (actor.role === "VENDAS" && lead.assignedToId !== actor.id) {
    throw new Error("Sem permissão para alterar este lead");
  }

  await prisma.lead.update({
    where: { id: data.leadId },
    data: { salesStatus: data.salesStatus as SalesStatus },
  });

  await prisma.enrollmentAudit.create({
    data: {
      leadId: data.leadId,
      action: "LEAD_STATUS_CHANGED",
      actorId: actor.id,
      targetType: "Lead",
      targetId: data.leadId,
      details: `Status de venda alterado para ${data.salesStatus}`,
    },
  });

  revalidatePath(`/vendas/leads/${data.leadId}`);
  revalidatePath(`/captacao/leads/${data.leadId}`);
  revalidatePath("/vendas/leads");
  revalidatePath("/captacao/leads");
  revalidatePath("/vendas");
  revalidatePath("/vendas/alertas");
  revalidatePath("/admin");

  return { ok: true };
}

/** Atribui (ou reatribui) um lead a um vendedor. */
export async function assignLeadAction(raw: { assignedToId: string }) {
  const actor = await requireActor();
  if (actor.role !== "ADMIN" && actor.role !== "CAPTACAO") {
    throw new Error("Apenas ADMIN e CAPTAÇÃO atribuem leads");
  }
  const data = assignLeadSchema.parse(raw);

  await prisma.enrollmentAudit.create({
    data: {
      action: "LEAD_ASSIGNED",
      actorId: actor.id,
      targetType: "User",
      targetId: data.assignedToId,
      details: "Lead atribuído a vendedor",
    },
  });

  revalidatePath("/captacao/leads");
  revalidatePath("/vendas/leads");
  revalidatePath("/captacao");
  revalidatePath("/admin");

  return { ok: true };
}

/** Atualiza contatos (2º/3º telefone), fonte e prioridade. */
export async function updateLeadContactAction(raw: {
  leadId: string;
  phone2?: string;
  phone3?: string;
  source?: string;
  priority?: string;
}) {
  const actor = await requireActor();
  const data = updateLeadContactSchema.parse(raw);

  const lead = await prisma.lead.findUnique({
    where: { id: data.leadId },
    select: { id: true, assignedToId: true },
  });
  if (!lead) throw new Error("Lead não encontrado");
  if (actor.role === "VENDAS" && lead.assignedToId !== actor.id) {
    throw new Error("Sem permissão para alterar este lead");
  }

  await prisma.lead.update({
    where: { id: data.leadId },
    data: {
      phone2: data.phone2 || null,
      phone3: data.phone3 || null,
      source: data.source || null,
      priority: data.priority as LeadPriority,
    },
  });

  revalidatePath(`/vendas/leads/${data.leadId}`);
  revalidatePath(`/captacao/leads/${data.leadId}`);
  revalidatePath("/captacao/leads");
  revalidatePath("/vendas/leads");

  return { ok: true };
}

/**
 * Atribui um lead a um vendedor via Server Action com redirect.
 * Usado pelo formulário de cadastro de lead.
 */
export async function createLeadAndRedirect(formData: FormData) {
  const raw = {
    fullName: (formData.get("fullName") as string) || "",
    phone: (formData.get("phone") as string) || "",
    phone2: (formData.get("phone2") as string) || "",
    phone3: (formData.get("phone3") as string) || "",
    email: (formData.get("email") as string) || "",
    cpf: (formData.get("cpf") as string) || "",
    courseId: (formData.get("courseId") as string) || "",
    campaignId: (formData.get("campaignId") as string) || "",
    assignedToId: (formData.get("assignedToId") as string) || "",
    source: (formData.get("source") as string) || "",
    priority: (formData.get("priority") as string) || "MEDIA",
    salesStatus: (formData.get("salesStatus") as string) || "NEGOCIANDO",
    notes: (formData.get("notes") as string) || "",
  };
  const result = await createLeadAction(raw as CreateLeadInput);
  redirect(`/vendas/leads/${result.id}`);
}
