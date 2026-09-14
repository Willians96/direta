"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const uploadSchema = z.object({
  leadId: z.string().cuid(),
  type: z.enum(["CPF", "RG", "COMPROVANTE_RESIDENCIA", "HISTORICO_ESCOLAR", "OUTRO"]),
  description: z.string().max(200).optional(),
});

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const STORAGE_PATH = process.env.STORAGE_PATH ?? "./storage";

export async function uploadDocumentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "Não autenticado." };
    const userId = (session.user as any).id as string;

    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return { ok: false, error: "Selecione um arquivo." };
    }
    if (file.size > MAX_FILE_SIZE) {
      return {
        ok: false,
        error: `Arquivo muito grande (máx. ${MAX_FILE_SIZE / 1024 / 1024}MB).`,
      };
    }

    const data = {
      leadId: formData.get("leadId") as string,
      type: formData.get("type") as string,
      description: (formData.get("description") as string) || undefined,
    };

    const parsed = uploadSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }

    // Verifica permissão: lead precisa estar atribuído ao usuário, ou ser admin
    const lead = await prisma.lead.findUnique({ where: { id: parsed.data.leadId } });
    if (!lead) return { ok: false, error: "Lead não encontrado." };

    const role = (session.user as any).role;
    if (role !== "ADMIN" && lead.assignedToId !== userId) {
      return {
        ok: false,
        error: "Você não tem permissão para enviar docs deste lead.",
      };
    }

    // Grava arquivo
    const bytes = Buffer.from(await file.arrayBuffer());
    const fileExt = path.extname(file.name) || "";
    const safeName = `${randomUUID()}${fileExt}`;
    const leadDir = path.join(STORAGE_PATH, "leads", parsed.data.leadId);
    await mkdir(leadDir, { recursive: true });
    const filePath = path.join(leadDir, safeName);
    await writeFile(filePath, bytes);

    const doc = await prisma.document.create({
      data: {
        leadId: parsed.data.leadId,
        type: parsed.data.type as any,
        fileName: file.name,
        filePath: path.relative(STORAGE_PATH, filePath).replace(/\\/g, "/"),
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        uploadedById: userId,
      },
    });

    await prisma.enrollmentAudit.create({
      data: {
        leadId: parsed.data.leadId,
        action: "DOCUMENT_UPLOADED",
        actorId: userId,
        targetType: "Document",
        targetId: doc.id,
        details: `${parsed.data.type}: ${file.name}`,
      },
    });

    revalidatePath("/vendas/documentos");
    revalidatePath("/recepcao");
    revalidatePath("/recepcao/fila");
    revalidatePath(`/vendas/leads/${parsed.data.leadId}`);

    return { ok: true, message: "📎 Documento enviado!" };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao enviar documento." };
  }
}

export async function deleteDocumentAction(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  const userId = (session.user as any).id as string;
  const role = (session.user as any).role;

  const doc = await prisma.document.findUnique({
    where: { id },
    include: { lead: true },
  });
  if (!doc) return;

  if (role !== "ADMIN" && doc.lead.assignedToId !== userId) return;

  await prisma.document.delete({ where: { id } });

  await prisma.enrollmentAudit.create({
    data: {
      leadId: doc.leadId,
      action: "DOCUMENT_UPLOADED",
      actorId: userId,
      targetType: "Document",
      targetId: id,
      details: `Excluiu: ${doc.fileName}`,
    },
  });

  revalidatePath("/vendas/documentos");
}
