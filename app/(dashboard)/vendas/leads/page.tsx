import Link from "next/link";
import { UserPlus, Plus, Filter, MessageSquare } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatPhone } from "@/lib/utils";

const LEADS = [
  { id: "1", nome: "Carlos Silva", telefone: "(11) 98765-4321", curso: "Eletricista Industrial", status: "EM_NEGOCIACAO", ultimoContato: "2026-09-11" },
  { id: "2", nome: "Mariana Souza", telefone: "(11) 99876-5432", curso: "Mecânica Automotiva", status: "AGUARDANDO_ANALISE", ultimoContato: "2026-09-10" },
  { id: "3", nome: "Roberto Lima", telefone: "(11) 97654-3210", curso: "NR-10", status: "DEVOLVIDA_AJUSTE", ultimoContato: "2026-09-12" },
  { id: "4", nome: "Juliana Pereira", telefone: "(11) 96543-2109", curso: "Eletricista Industrial", status: "PROPOSTA_ENVIADA", ultimoContato: "2026-09-09" },
];

export default function MeusLeadsPage() {
  return (
    <div>
      <PageHeader
        title="Meus Leads"
        description="Leads atribuídos a você — registre interações e avance o status"
        icon={UserPlus}
        action={
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{LEADS.length} leads atribuídos</CardTitle>
            <CardDescription>
              Clique em um lead para abrir a ficha completa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {LEADS.map((lead) => (
              <Link
                key={lead.id}
                href={`/vendas/leads/${lead.id}`}
                className="flex items-center gap-4 rounded-md border p-4 transition-all hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-sm"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-sm font-semibold text-white">
                  {lead.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{lead.nome}</span>
                    <StatusBadge status={lead.status as any} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-sm text-slate-500">
                    <span>{formatPhone(lead.telefone)}</span>
                    <span>·</span>
                    <span>{lead.curso}</span>
                  </div>
                </div>
                <div className="hidden text-right md:block">
                  <div className="text-xs text-slate-500">Último contato</div>
                  <div className="text-sm font-medium">{formatDate(lead.ultimoContato)}</div>
                </div>
                <Button variant="ghost" size="sm">
                  <MessageSquare className="mr-1 h-4 w-4" />
                  Abrir
                </Button>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
