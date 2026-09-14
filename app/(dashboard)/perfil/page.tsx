import { User } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export const dynamic = "force-dynamic";

export default function PerfilPage() {
  return (
    <ComingSoon
      title="Meu Perfil"
      description="Configurações pessoais e preferências da conta"
      icon={User}
      sprint="Sprint 6 · S6"
      features={[
        "Editar nome, telefone e avatar",
        "Trocar senha atual por uma nova",
        "Preferências de notificação (e-mail, in-app)",
        "Histórico de sessões ativas e dispositivos",
        "Modo escuro (light/dark/auto)",
      ]}
    />
  );
}
