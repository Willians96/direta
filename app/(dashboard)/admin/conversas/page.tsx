import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

import {
  MessageCircle,
  ArrowLeft,
  ChevronRight,
  Phone,
  Mail,
  Calendar,
} from "lucide-react";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { auth } from "@/lib/auth";
import { getRecentConversations } from "@/lib/actions/messages";
import { formatDateTime } from "@/lib/utils";
import { MessageChannel } from "@prisma/client";

const CHANNEL_ICONS: Record<MessageChannel, any> = {
  WHATSAPP: MessageCircle,
  LIGACAO: Phone,
  EMAIL: Mail,
  REUNIAO: Calendar,
  PRESENCIAL: Calendar,
  OUTRO: MessageCircle,
};

const CHANNEL_COLORS: Record<MessageChannel, string> = {
  WHATSAPP: "bg-emerald-100 text-emerald-700",
  LIGACAO: "bg-blue-100 text-blue-700",
  EMAIL: "bg-amber-100 text-amber-700",
  REUNIAO: "bg-purple-100 text-purple-700",
  PRESENCIAL: "bg-pink-100 text-pink-700",
  OUTRO: "bg-slate-100 text-slate-700",
};

export default async function ConversasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "CAPTACAO") {
    redirect("/admin");
  }

  const conversas = await getRecentConversations(100);

  const totalMensagens = conversas.reduce((acc, c) => acc + c.totalMessages, 0);

  // KPIs por canal
  const porCanal = new Map<MessageChannel, number>();
  for (const c of conversas) {
    if (c.lastMessage) {
      const cur = porCanal.get(c.lastMessage.channel) ?? 0;
      porCanal.set(c.lastMessage.channel, cur + 1);
    }
  }

  return (
    <div>
      <PageHeader
        title="Conversas da Equipe"
        description="Auditoria de todas as mensagens registradas"
        icon={MessageCircle}
        action={
          <Button variant="outline" asChild>
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-xs uppercase text-slate-500">Leads com conversa</div>
              <div className="text-3xl font-bold text-direta-orange">{conversas.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-xs uppercase text-slate-500">Total de mensagens</div>
              <div className="text-3xl font-bold">{totalMensagens}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-xs uppercase text-slate-500">Média por lead</div>
              <div className="text-3xl font-bold">
                {conversas.length > 0 ? (totalMensagens / conversas.length).toFixed(1) : "0"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="mb-1 text-xs uppercase text-slate-500">Por canal (última msg)</div>
              <div className="flex flex-wrap gap-1">
                {Array.from(porCanal.entries()).map(([ch, count]) => (
                  <Badge key={ch} className={CHANNEL_COLORS[ch]}>
                    {ch === "WHATSAPP" && "WA"}
                    {ch === "LIGACAO" && "Tel"}
                    {ch === "EMAIL" && "@"}
                    {ch === "REUNIAO" && "Reun"}
                    {ch === "PRESENCIAL" && "Pres"}
                    {ch === "OUTRO" && "?"} · {count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de conversas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversas recentes</CardTitle>
            <CardDescription>
              Ordenadas pela última mensagem · clique para abrir o lead
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {conversas.length === 0 ? (
              <div className="rounded-md border border-dashed p-12 text-center text-sm text-slate-500">
                Nenhuma conversa registrada ainda. Vendedores podem registrar
                pelo botão "Abrir Conversa" na página do lead.
              </div>
            ) : (
              <div className="divide-y">
                {conversas.map((c) => {
                  const Icon = CHANNEL_ICONS[c.lastMessage!.channel];
                  const color = CHANNEL_COLORS[c.lastMessage!.channel];
                  return (
                    <Link
                      key={c.id}
                      href={`/vendas/leads/${c.id}`}
                      className="flex items-start gap-4 p-4 transition-colors hover:bg-slate-50"
                    >
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{c.fullName}</span>
                          <StatusBadge status={c.status} />
                          <Badge variant="neutral">
                            {c.totalMessages} msg
                          </Badge>
                        </div>
                        <div className="mt-1 truncate text-sm text-slate-600">
                          {c.lastMessage!.content}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {c.lastMessage!.user.name} · {c.lastMessage!.direction === "OUTBOUND" ? "enviada" : c.lastMessage!.direction === "INBOUND" ? "recebida" : "nota interna"} · {formatDateTime(c.lastMessage!.occurredAt)}
                          {" · "}{c.assignedTo?.name ?? "Sem vendedor"}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
