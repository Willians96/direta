"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { analisarMensagem } from "@/lib/whatsapp/analyze";
import { processarMensagemWhatsApp } from "@/lib/whatsapp/ingest";

/**
 * Ações da fila de WhatsApp (Captação).
 *
 * O fluxo é "fila com aprovação": a Captação confere a análise e só então
 * libera o lead para o vendedor.
 */

async function requireAtor() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");
  const role = (session.user as any).role as string;
  if (role !== "ADMIN" && role !== "CAPTACAO") {
    throw new Error("Somente Captação ou Admin podem tratar a fila do WhatsApp");
  }
  return session.user as { id: string; role: string; name: string };
}

function revogar() {
  revalidatePath("/captacao/whatsapp");
  revalidatePath("/captacao/leads");
  revalidatePath("/vendas/leads");
  revalidatePath("/vendas");
}

/**
 * Libera o lead da fila para um vendedor.
 * Pode aplicar junto o curso e o status sugeridos pela análise.
 */
export async function liberarLeadWhatsAppAction(raw: {
  inboundId: string;
  vendedorId: string;
  aplicarCurso?: boolean;
  aplicarStatus?: boolean;
}) {
  const ator = await requireAtor();
  const dados = z
    .object({
      inboundId: z.string().min(1),
      vendedorId: z.string().min(1),
      aplicarCurso: z.boolean().optional(),
      aplicarStatus: z.boolean().optional(),
    })
    .parse(raw);

  const inbound = await prisma.whatsappInbound.findUnique({
    where: { id: dados.inboundId },
    select: { id: true, leadId: true, body: true },
  });
  if (!inbound?.leadId) throw new Error("Mensagem sem lead vinculado");

  const lead = await prisma.lead.findUnique({
    where: { id: inbound.leadId },
    select: {
      id: true,
      courseId: true,
      aiCourseId: true,
      salesStatus: true,
      aiStatus: true,
      assignedToId: true,
    },
  });
  if (!lead) throw new Error("Lead não encontrado");

  const vendedor = await prisma.user.findFirst({
    where: { id: dados.vendedorId, role: "VENDAS", status: "ATIVO" },
    select: { id: true, name: true },
  });
  if (!vendedor) throw new Error("Vendedor inválido ou inativo");

  const cursoAplicado = dados.aplicarCurso && lead.aiCourseId ? lead.aiCourseId : lead.courseId;
  const statusAplicado =
    dados.aplicarStatus && lead.aiStatus ? lead.aiStatus : lead.salesStatus;

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      assignedToId: vendedor.id,
      status: "EM_NEGOCIACAO",
      ...(cursoAplicado !== lead.courseId ? { courseId: cursoAplicado } : {}),
      ...(statusAplicado !== lead.salesStatus ? { salesStatus: statusAplicado } : {}),
    },
  });

  await prisma.enrollmentAudit.create({
    data: {
      leadId: lead.id,
      action: "LEAD_ASSIGNED",
      actorId: ator.id,
      targetType: "Lead",
      targetId: lead.id,
      details: `Lead do WhatsApp liberado para ${vendedor.name} pela Captação`,
    },
  });

  await prisma.interaction.create({
    data: {
      leadId: lead.id,
      type: "WHATSAPP",
      description: `Lead liberado para vendas (${vendedor.name}) pela Captação`,
      occurredAt: new Date(),
      createdById: ator.id,
    },
  });

  revogar();
  return { ok: true, leadId: lead.id, vendedor: vendedor.name };
}

/** Aplica apenas o curso sugerido pela análise. */
export async function aplicarCursoWhatsAppAction(raw: { inboundId: string }) {
  const ator = requireAtor();
  await ator;

  const dados = z.object({ inboundId: z.string().min(1) }).parse(raw);

  const inbound = await prisma.whatsappInbound.findUnique({
    where: { id: dados.inboundId },
    select: { leadId: true },
  });
  if (!inbound?.leadId) throw new Error("Mensagem sem lead vinculado");

  const lead = await prisma.lead.findUnique({
    where: { id: inbound.leadId },
    select: { id: true, aiCourseId: true },
  });
  if (!lead?.aiCourseId) throw new Error("A análise não sugeriu um curso");

  await prisma.lead.update({
    where: { id: lead.id },
    data: { courseId: lead.aiCourseId },
  });

  revogar();
  return { ok: true };
}

/** Aplica apenas o "status do cliente" sugerido pela análise. */
export async function aplicarStatusWhatsAppAction(raw: { inboundId: string }) {
  const ator = requireAtor();
  await ator;

  const dados = z.object({ inboundId: z.string().min(1) }).parse(raw);

  const inbound = await prisma.whatsappInbound.findUnique({
    where: { id: dados.inboundId },
    select: { leadId: true },
  });
  if (!inbound?.leadId) throw new Error("Mensagem sem lead vinculado");

  const lead = await prisma.lead.findUnique({
    where: { id: inbound.leadId },
    select: { id: true, aiStatus: true },
  });
  if (!lead?.aiStatus) throw new Error("A análise não sugeriu um status");

  await prisma.lead.update({
    where: { id: lead.id },
    data: { salesStatus: lead.aiStatus },
  });

  await prisma.enrollmentAudit.create({
    data: {
      leadId: lead.id,
      action: "LEAD_STATUS_CHANGED",
      actorId: (await requireAtor()).id,
      targetType: "Lead",
      targetId: lead.id,
      details: `Status do cliente aplicado a partir da análise do WhatsApp: ${lead.aiStatus}`,
    },
  });

  revogar();
  return { ok: true };
}

/** Reprocessa a análise da mensagem (regras + IA). */
export async function reanalisarWhatsAppAction(raw: { inboundId: string }) {
  const ator = requireAtor();
  await ator;

  const dados = z.object({ inboundId: z.string().min(1) }).parse(raw);

  const inbound = await prisma.whatsappInbound.findUnique({
    where: { id: dados.inboundId },
    select: { id: true, leadId: true, body: true, pushname: true },
  });
  if (!inbound) throw new Error("Mensagem não encontrada");

  const cursos = await prisma.course.findMany({
    where: { status: "ATIVO" },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });

  const analise = await analisarMensagem({
    mensagem: inbound.body,
    nome: inbound.pushname,
    cursos,
  });

  if (inbound.leadId) {
    await prisma.lead.update({
      where: { id: inbound.leadId },
      data: {
        aiSummary: analise.resumo,
        aiTags: analise.tags,
        aiScore: analise.score,
        aiIntent: analise.intent,
        aiStatus: analise.status,
        aiCourseId: analise.courseId,
        aiModel: analise.model,
        aiAnalyzedAt: new Date(),
      },
    });
  }

  await prisma.whatsappInbound.update({
    where: { id: inbound.id },
    data: { analysis: JSON.stringify(analise), status: "ANALISADA" },
  });

  revogar();
  return { ok: true, analise };
}

/** Marca a mensagem como ignorada (spam, mensagem sem conteúdo). */
export async function ignorarWhatsAppAction(raw: { inboundId: string }) {
  const ator = requireAtor();
  await ator;

  const dados = z.object({ inboundId: z.string().min(1) }).parse(raw);

  await prisma.whatsappInbound.update({
    where: { id: dados.inboundId },
    data: { status: "IGNORADA" },
  });

  revogar();
  return { ok: true };
}

/**
 * Simulador: injeta uma mensagem como se tivesse vindo do WhatsApp.
 * Existe para demonstrar o fluxo antes (ou sem) a conexão com a Meta.
 */
export async function simularMensagemWhatsAppAction(raw: {
  nome: string;
  telefone: string;
  mensagem: string;
}) {
  const ator = requireAtor();
  await ator;

  const dados = z
    .object({
      nome: z.string().max(80).default(""),
      telefone: z
        .string()
        .min(8, "Informe um telefone válido")
        .max(20)
        .transform((v) => v.replace(/\D/g, "")),
      mensagem: z.string().min(1, "Escreva a mensagem").max(4000),
    })
    .parse(raw);

  const resultado = await processarMensagemWhatsApp({
    waId: dados.telefone,
    nome: dados.nome || null,
    tipo: "text",
    texto: dados.mensagem,
    wamid: `simulador-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    raw: { simulado: true },
  });

  revogar();
  return resultado;
}
