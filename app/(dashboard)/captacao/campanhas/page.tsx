import { redirect } from "next/navigation";
import { Megaphone, TrendingUp, DollarSign, Target } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toggleCampaignStatusAction } from "@/lib/actions/campaigns";
import { CampaignFormDialog } from "./campaign-form-dialog";
import { Instagram, Facebook, Globe, MessageCircle, Mail, UserPlus, AtSign } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const CANAL_ICONS: Record<string, LucideIcon> = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  GOOGLE_ADS: Globe,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  INDICACAO: UserPlus,
  OUTRO: AtSign,
};

const CANAL_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  GOOGLE_ADS: "Google Ads",
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  INDICACAO: "Indicação",
  OUTRO: "Outro",
};

const STATUS_VARIANTS: Record<string, "success" | "info" | "warning" | "neutral"> = {
  ATIVA: "success",
  PLANEJADA: "info",
  PAUSADA: "warning",
  ENCERRADA: "neutral",
};

export default async function CaptacaoCampanhasPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "CAPTACAO") {
    redirect("/");
  }

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { leads: true } },
    },
  });

  const totalAtivas = campaigns.filter((c) => c.status === "ATIVA").length;
  const investimentoTotal = campaigns.reduce(
    (acc, c) => acc + Number(c.budget ?? 0),
    0
  );
  const totalLeads = campaigns.reduce((acc, c) => acc + c._count.leads, 0);
  const custoPorLead =
    totalLeads > 0 ? investimentoTotal / totalLeads : 0;

  return (
    <div>
      <PageHeader
        title="Campanhas"
        description="Gestão de campanhas de marketing e geração de leads"
        icon={Megaphone}
        action={<CampaignFormDialog />}
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{campaigns.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600">{totalAtivas}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Investimento total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">
                {formatCurrency(investimentoTotal)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Custo por lead
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-direta-orange">
                {formatCurrency(custoPorLead)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500">
                      Nenhuma campanha cadastrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  campaigns.map((c) => {
                    const Icon = CANAL_ICONS[c.channel] ?? Megaphone;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="font-medium">{c.name}</div>
                          {c.description && (
                            <div className="text-xs text-slate-500 line-clamp-1">
                              {c.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-slate-500" />
                            <span className="text-sm">
                              {CANAL_LABELS[c.channel]}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {formatDate(c.startDate)}
                          {c.endDate ? ` → ${formatDate(c.endDate)}` : " → em aberto"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {c._count.leads}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {formatCurrency(Number(c.budget ?? 0))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[c.status]}>
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <CampaignFormDialog
                              campaign={{
                                id: c.id,
                                name: c.name,
                                channel: c.channel,
                                startDate: c.startDate,
                                endDate: c.endDate,
                                budget: c.budget,
                                description: c.description,
                                status: c.status,
                              }}
                            />
                            <form
                              action={async () => {
                                "use server";
                                await toggleCampaignStatusAction(c.id);
                              }}
                            >
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                title="Alternar status"
                              >
                                {c.status === "ATIVA" ? "⏸" : "▶"}
                              </Button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
