import { Megaphone } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export const dynamic = "force-dynamic";

export default function CaptacaoCampanhasPage() {
  return (
    <ComingSoon
      title="Campanhas"
      description="Gestão de campanhas de marketing e captação"
      icon={Megaphone}
      sprint="Sprint 2 · S2"
      features={[
        "CRUD de campanhas (nome, canal, período, orçamento)",
        "Canais: Instagram, Facebook, Google Ads, WhatsApp, Indicação",
        "ROI automático: leads gerados vs investimento",
        "Status da campanha (PLANEJADA, ATIVA, PAUSADA, ENCORRADA)",
        "Relatório de performance por campanha",
      ]}
    />
  );
}
