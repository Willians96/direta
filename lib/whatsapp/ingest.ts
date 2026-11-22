/**
 * Pipeline de ingestão das mensagens recebidas no WhatsApp da Captação.
 *
 * Uma mensagem recebida vira:
 *   1. registro em WhatsappInbound (dedupe por wamid + auditoria)
 *   2. Lead criado (ou atualizado) com a fonte "WhatsApp"
 *   3. mensagem gravada no chat-log do lead (canal WHATSAPP, INBOUND)
 *   4. análise (regras + IA) aplicada no lead
 *
 * É o mesmo caminho usado pelo webhook da Meta e pelo simulador — o
 * simulador só troca a origem dos dados.
 */

import { prisma } from "@/lib/prisma";
import { LeadPriority } from "@prisma/client";
import { analisarMensagem, type AnaliseFinal } from "./analyze";
import { digitosComparaveis, normalizarTelefone, nomeUtil } from "./normalize";

export type EntradaWhatsApp = {
  waId: string;
  nome?: string | null;
  tipo: string;
  texto: string;
  wamid: string;
  raw?: unknown;
};

export type ResultadoIngestao = {
  ok: boolean;
  duplicado?: boolean;
  inboundId?: string;
  leadId?: string;
  leadNovo?: boolean;
  analise?: AnaliseFinal;
  erro?: string;
};

/** Usuário que "assina" as mensagens automáticas (conta da Captação). */
async function usuarioDoSistema() {
  const captacao = await prisma.user.findFirst({
    where: { role: "CAPTACAO", status: "ATIVO" },
    select: { id: true, name: true },
  });
  if (captacao) return captacao;

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", status: "ATIVO" },
    select: { id: true, name: true },
  });
  if (admin) return admin;

  throw new Error("Nenhum usuário de Captação/Admin ativo para registrar a mensagem");
}

/** Procura o lead pelo wa_id; se não achar, procura pelo telefone (ignorando máscara). */
async function acharLead(waId: string, phone: string) {
  const porWhatsapp = await prisma.lead.findFirst({ where: { whatsappId: waId } });
  if (porWhatsapp) return porWhatsapp;

  const digitos = digitosComparaveis(phone);
  const candidatos = await prisma.lead.findMany({
    where: { OR: [{ phone: { contains: digitos.slice(-8) } }, { whatsappId: { not: null } }] },
    select: { id: true, phone: true, whatsappId: true },
    take: 200,
  });

  const achado = candidatos.find((c) => digitosComparaveis(c.phone) === digitos);
  if (!achado) return null;

  return prisma.lead.findUnique({ where: { id: achado.id } });
}

function prioridadePorScore(score: number): LeadPriority {
  if (score >= 70) return "ALTA";
  if (score >= 40) return "MEDIA";
  return "BAIXA";
}

export async function processarMensagemWhatsApp(
  entrada: EntradaWhatsApp
): Promise<ResultadoIngestao> {
  const phone = normalizarTelefone(entrada.waId);
  const pushname = nomeUtil(entrada.nome);

  // 1) Dedupe — a Meta reenvia a mesma mensagem quando o webhook demora.
  const jaExiste = await prisma.whatsappInbound.findUnique({
    where: { wamid: entrada.wamid },
    select: { id: true, leadId: true },
  });
  if (jaExiste) {
    return { ok: true, duplicado: true, inboundId: jaExiste.id, leadId: jaExiste.leadId ?? undefined };
  }

  const inbound = await prisma.whatsappInbound.create({
    data: {
      wamid: entrada.wamid,
      waId: entrada.waId,
      phone,
      pushname,
      type: entrada.tipo,
      body: entrada.texto,
      status: "RECEBIDA",
      receivedAt: new Date(),
    },
  });

  try {
    const autor = await usuarioDoSistema();

    // 2) Lead (novo ou existente).
    const existente = await acharLead(entrada.waId, phone);
    let lead = existente;
    let leadNovo = false;

    if (!lead) {
      leadNovo = true;
      lead = await prisma.lead.create({
        data: {
          fullName: pushname || `Contato WhatsApp ${phone}`,
          phone,
          source: "WhatsApp",
          status: "NOVO",
          priority: "MEDIA",
          whatsappId: entrada.waId,
          notes: "Lead captado pelo WhatsApp da Captação.",
          createdById: autor.id,
        },
      });

      await prisma.enrollmentAudit.create({
        data: {
          leadId: lead.id,
          action: "LEAD_CREATED",
          actorId: autor.id,
          targetType: "Lead",
          targetId: lead.id,
          details: "Lead criado automaticamente pela captação via WhatsApp",
        },
      });
    }

    // 3) Chat-log + trilha de interação.
    await prisma.leadMessage.create({
      data: {
        leadId: lead.id,
        userId: autor.id,
        channel: "WHATSAPP",
        direction: "INBOUND",
        content: entrada.texto || "(mensagem sem texto)",
        occurredAt: new Date(),
      },
    });

    await prisma.interaction.create({
      data: {
        leadId: lead.id,
        type: "WHATSAPP",
        description: `Mensagem recebida no WhatsApp: ${(entrada.texto || "").slice(0, 240)}`,
        occurredAt: new Date(),
        createdById: autor.id,
      },
    });

    // 4) Análise (regras + IA).
    const cursos = await prisma.course.findMany({
      where: { status: "ATIVO" },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    });

    const analise = await analisarMensagem({
      mensagem: entrada.texto,
      nome: pushname,
      cursos,
    });

    // Lead já entregue ao vendedor: a análise não sobrescreve o trabalho dele.
    const leadLiberado = !!lead.assignedToId;

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        whatsappId: lead.whatsappId ?? entrada.waId,
        ...(leadNovo && analise.nome ? { fullName: analise.nome } : {}),
        ...(leadLiberado
          ? {}
          : {
              aiSummary: analise.resumo,
              aiTags: analise.tags,
              aiScore: analise.score,
              aiIntent: analise.intent,
              aiStatus: analise.status,
              aiCourseId: analise.courseId,
              aiModel: analise.model,
              aiRaw: analise.model === "llm" ? JSON.stringify(analise) : null,
              aiAnalyzedAt: new Date(),
              priority: prioridadePorScore(analise.score),
              notes: [
                lead.notes,
                `📲 WhatsApp (${analise.model === "llm" ? "análise por IA" : "análise por regras"}): ${analise.resumo}`,
              ]
                .filter(Boolean)
                .join("\n\n"),
            }),
      },
    });

    await prisma.whatsappInbound.update({
      where: { id: inbound.id },
      data: {
        status: "ANALISADA",
        leadId: lead.id,
        analysis: JSON.stringify(analise),
      },
    });

    return {
      ok: true,
      inboundId: inbound.id,
      leadId: lead.id,
      leadNovo,
      analise,
    };
  } catch (e: any) {
    await prisma.whatsappInbound.update({
      where: { id: inbound.id },
      data: { status: "ERRO", error: String(e?.message || e) },
    });
    return { ok: false, inboundId: inbound.id, erro: String(e?.message || e) };
  }
}
