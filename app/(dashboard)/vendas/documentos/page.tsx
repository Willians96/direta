import { Upload } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export const dynamic = "force-dynamic";

export default function VendasDocumentosPage() {
  return (
    <ComingSoon
      title="Documentos"
      description="Upload e gestão de documentos por lead"
      icon={Upload}
      sprint="Sprint 4 · S4"
      features={[
        "Upload de documentos (CPF, RG, comprovante, histórico)",
        "Preview de PDF e imagem direto no navegador",
        "Versionamento: substituir documento mantendo histórico",
        "Storage privado com URLs assinadas (Vercel Blob)",
        "Validação automática de tamanho e formato",
      ]}
    />
  );
}
