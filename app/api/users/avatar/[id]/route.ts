import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openStoredFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** No storage em disco o mime não vem junto — deduz pela extensão do arquivo. */
function mimePelaExtensao(referencia: string): string {
  const ext = referencia.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

/**
 * Serve a foto do colaborador.
 *
 * GET /api/users/avatar/:id → devolve a imagem (inline)
 *
 * O banco guarda só a referência do arquivo (caminho no storage da VPS ou URL
 * do Blob). A imagem é servida pelo servidor — nunca é um caminho público.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { avatarUrl: true },
  });

  if (!user?.avatarUrl) {
    return NextResponse.json({ ok: false, error: "Foto não encontrada." }, { status: 404 });
  }

  const stored = await openStoredFile(user.avatarUrl);
  if (!stored) {
    return NextResponse.json({ ok: false, error: "Foto indisponível." }, { status: 404 });
  }

  const mimeType = stored.mimeType || mimePelaExtensao(user.avatarUrl);
  const headers: Record<string, string> = {
    "Content-Type": mimeType,
    "Content-Disposition": "inline",
    // Foto muda pouco: cache curto no navegador, mas sempre revalidado.
    "Cache-Control": "private, max-age=60, must-revalidate",
    "X-Content-Type-Options": "nosniff",
  };
  if (stored.size) headers["Content-Length"] = String(stored.size);

  return new NextResponse(stored.stream, { headers });
}
