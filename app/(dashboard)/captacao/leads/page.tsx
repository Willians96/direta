import Link from "next/link";
import { UserPlus, Filter, Plus, ArrowUpDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatPhone, formatDate } from "@/lib/utils";

const LEADS = [
  { id: "1", nome: "Carlos Silva", telefone: "(11) 98765-4321", curso: "Eletricista Industrial", status: "EM_NEGOCIACAO", criadoEm: "2026-09-10" },
  { id: "2", nome: "Mariana Souza", telefone: "(11) 99876-5432", curso: "Mecânica Automotiva", status: "AGUARDANDO_ANALISE", criadoEm: "2026-09-09" },
  { id: "3", nome: "Roberto Lima", telefone: "(11) 97654-3210", curso: "NR-10", status: "DEVOLVIDA_AJUSTE", criadoEm: "2026-09-11" },
  { id: "4", nome: "Juliana Pereira", telefone: "(11) 96543-2109", curso: "Eletricista Industrial", status: "PROPOSTA_ENVIADA", criadoEm: "2026-09-08" },
  { id: "5", nome: "Felipe Santos", telefone: "(11) 95432-1098", curso: "Preparatório ENEM", status: "QUALIFICADO", criadoEm: "2026-09-11" },
  { id: "6", nome: "Beatriz Almeida", telefone: "(11) 94321-0987", curso: "NR-35", status: "NOVO", criadoEm: "2026-09-12" },
];

export default function LeadsPage() {
  return (
    <div>
      <PageHeader
        title="Leads"
        description="Todos os leads captados — atribua a um vendedor"
        icon={UserPlus}
        action={
          <Button asChild>
            <Link href="/captacao/leads/novo">
              <Plus className="mr-2 h-4 w-4" />
              Novo lead
            </Link>
          </Button>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        {/* Filtros */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
            <Input placeholder="Buscar por nome, telefone, e-mail..." className="md:max-w-sm" />
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Status
              </Button>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Curso
              </Button>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Período
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{LEADS.length} leads</CardTitle>
            <CardDescription>Ordenados por mais recentes</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-6 py-3">
                      <button className="inline-flex items-center gap-1">
                        Nome <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3">Telefone</th>
                    <th className="px-6 py-3">Curso</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Criado em</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {LEADS.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-xs font-semibold text-white">
                            {lead.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{lead.nome}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-slate-600">{formatPhone(lead.telefone)}</td>
                      <td className="px-6 py-3 text-slate-600">{lead.curso}</td>
                      <td className="px-6 py-3">
                        <StatusBadge status={lead.status as any} />
                      </td>
                      <td className="px-6 py-3 text-slate-500">{formatDate(lead.criadoEm)}</td>
                      <td className="px-6 py-3 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/captacao/leads/${lead.id}`}>Abrir</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
