import { redirect } from "next/navigation";
import Link from "next/link";
import { Upload, FileText, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { deleteDocumentAction } from "@/lib/actions/documents";
import { UploadDialog, FileIcon } from "./upload-dialog";

export const dynamic = "force-dynamic";

const DOC_LABELS: Record<string, string> = {
  CPF: "CPF",
  RG: "RG",
  COMPROVANTE_RESIDENCIA: "Comprovante de Residência",
  HISTORICO_ESCOLAR: "Histórico Escolar",
  OUTRO: "Outro",
};

const DOC_VARIANTS: Record<string, "default" | "info" | "warning" | "success" | "neutral"> = {
  CPF: "info",
  RG: "info",
  COMPROVANTE_RESIDENCIA: "warning",
  HISTORICO_ESCOLAR: "success",
  OUTRO: "neutral",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function VendasDocumentosPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string;
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "VENDAS") {
    redirect("/");
  }

  const [documentsRaw, leads] = await Promise.all([
    prisma.document.findMany({
      where: role === "ADMIN" ? {} : { lead: { assignedToId: userId } },
      include: {
        lead: { select: { fullName: true, id: true } },
      },
      orderBy: { uploadedAt: "desc" },
      take: 100,
    }),
    prisma.lead.findMany({
      where: {
        status: { notIn: ["PERDIDA"] },
        ...(role === "ADMIN" ? {} : { assignedToId: userId }),
      },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  // Buscar nomes dos uploadedBy separadamente
  const uploadedByIds = Array.from(new Set(documentsRaw.map((d) => d.uploadedById)));
  const uploaders = await prisma.user.findMany({
    where: { id: { in: uploadedByIds } },
    select: { id: true, name: true },
  });
  const uploaderMap = new Map(uploaders.map((u) => [u.id, u.name]));

  const documents = documentsRaw.map((d) => ({
    ...d,
    uploaderName: uploaderMap.get(d.uploadedById) ?? "Desconhecido",
  }));

  const totalSize = documents.reduce((acc, d) => acc + d.size, 0);

  return (
    <div>
      <PageHeader
        title="Documentos"
        description="Upload e gestão de documentos por lead"
        icon={Upload}
        action={<UploadDialog leads={leads} />}
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{documents.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Espaço usado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatBytes(totalSize)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Leads com docs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600">
                {new Set(documents.map((d) => d.leadId)).size}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Documentos enviados</CardTitle>
            <CardDescription>
              Mostra os últimos 100 documentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="rounded-md border border-dashed p-12 text-center text-sm text-slate-500">
                <FileText className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                Nenhum documento enviado ainda.
                <br />
                <span className="text-xs">
                  Clique em "Enviar documento" pra começar.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 rounded-md border border-slate-100 bg-white p-3 hover:bg-slate-50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-100 text-slate-600">
                      <FileIcon type={doc.mimeType ?? ""} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800 truncate">
                          {doc.fileName}
                        </span>
                        <Badge variant={DOC_VARIANTS[doc.type]}>
                          {DOC_LABELS[doc.type]}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        <Link
                          href={`/vendas/leads/${doc.leadId}`}
                          className="font-medium text-slate-700 hover:underline"
                        >
                          {doc.lead.fullName}
                        </Link>
                        <span className="mx-1">·</span>
                        <span>{formatBytes(doc.size)}</span>
                        <span className="mx-1">·</span>
                        <span>enviado por {doc.uploaderName}</span>
                        <span className="mx-1">·</span>
                        <span>{formatDateTime(doc.uploadedAt)}</span>
                      </div>
                    </div>

                    <form
                      action={async () => {
                        "use server";
                        await deleteDocumentAction(doc.id);
                      }}
                    >
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        title="Excluir"
                      >
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          💡 <strong>Ambiente de produção:</strong> em deploy serverless (Vercel),
          os arquivos são guardados em storage local efêmero. Para uso definitivo,
          configure <strong>Vercel Blob</strong> ou S3 — instruções em{" "}
          <code>README_DEPLOY.md</code>.
        </div>
      </div>
    </div>
  );
}
