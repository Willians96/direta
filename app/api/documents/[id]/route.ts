import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "fs";
import { Readable } from "stream";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveStoredFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Abre ou baixa um documento.
 *
 * GET /api/documents/:id            → abre no navegador (inline)
 * GET /api/documents/:id?download=1 → força o download (attachment)
 *
 * Regras:
 *  - só quem está logado;
 *  - ADMIN vê tudo, demais usuários só os documentos dos leads atribuídos a eles;
 *  - nada de HTML/SVG servido inline (evita XSS no mesmo domínio) — esses vão
 *    sempre como attachment.
 */
const INLINE_SAFE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

function wantsHtml(req: NextRequest): boolean {
  return (req.headers.get("accept") ?? "").includes("text/html");
}

function erro(req: NextRequest, status: number, titulo: string, detalhe: string) {
  if (!wantsHtml(req)) {
    return NextResponse.json({ ok: false, error: titulo, detail: detalhe }, { status });
  }

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${titulo} · Direta Cursos</title>
    <style>
      body { margin: 0; min-height: 100vh; display: flex; align-items: center;
             justify-content: center; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
             background: #f8fafc; color: #0f172a; }
      .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px;
              max-width: 480px; box-shadow: 0 10px 30px rgba(15,23,42,.06); }
      h1 { font-size: 18px; margin: 0 0 8px; }
      p  { font-size: 14px; color: #475569; margin: 0 0 16px; line-height: 1.5; }
      a  { display: inline-block; background: #F26722; color: #fff; text-decoration: none;
           padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 500; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${titulo}</h1>
      <p>${detalhe}</p>
      <a href="/vendas/documentos">Voltar para Documentos</a>
    </div>
  </body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return erro(req, 401, "Sessão expirada", "Faça login novamente para acessar o documento.");
  }

  const userId = (session.user as any).id as string;
  const role = (session.user as any).role as string;

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: { lead: { select: { assignedToId: true, fullName: true } } },
  });

  if (!doc) {
    return erro(req, 404, "Documento não encontrado", "O registro pode ter sido excluído.");
  }

  if (role !== "ADMIN" && doc.lead.assignedToId !== userId) {
    return erro(
      req,
      403,
      "Sem permissão",
      `Este documento pertence a ${doc.lead.fullName}, que não está atribuído a você.`
    );
  }

  const filePath = resolveStoredFile(doc.filePath);
  if (!filePath) {
    return erro(req, 400, "Arquivo inválido", "O caminho do arquivo no banco não é válido.");
  }

  let size: number;
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) throw new Error("não é arquivo");
    size = stat.size;
  } catch {
    return erro(
      req,
      404,
      "Arquivo indisponível",
      "O arquivo não está mais no servidor (na Vercel o armazenamento é temporário e se perde a cada deploy). Reenvie o documento."
    );
  }

  const mimeType = doc.mimeType || "application/octet-stream";
  const forcarDownload = req.nextUrl.searchParams.get("download") === "1";
  const inline = !forcarDownload && INLINE_SAFE_TYPES.has(mimeType.toLowerCase());

  const safeName = (doc.fileName || "documento").replace(/[^\w.\- ]/g, "_");

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
