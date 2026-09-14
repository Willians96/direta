import { Users } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export const dynamic = "force-dynamic";

export default function AdminUsuariosPage() {
  return (
    <ComingSoon
      title="Usuários"
      description="Gestão de funcionários e permissões de acesso"
      icon={Users}
      sprint="Sprint 2 · S2"
      features={[
        "CRUD completo de usuários (criar, editar, desativar)",
        "Atribuição de perfil (ADMIN, CAPTAÇÃO, VENDAS, RECEPÇÃO)",
        "Reset de senha pelo administrador",
        "Histórico de último login e status (ATIVO/INATIVO)",
        "Filtros por perfil, status e período de cadastro",
      ]}
    />
  );
}
