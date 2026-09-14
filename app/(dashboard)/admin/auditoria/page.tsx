import { redirect } from "next/navigation";
import { FileText, Activity, UserPlus, UserX, FileEdit, GraduationCap } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const ACTION_META: Record<string, { label: string; icon: LucideIcon; variant: any }> = {
  LEAD_CREATED: { label: "Lead criado", icon: UserPlus, variant: "info" },
  LEAD_ASSIGNED: { label: "Lead atribuído", icon: FileEdit, variant: "info" },
  LEAD_STATUS_CHANGED: { label: "Status do lead alterado", icon: FileEdit, variant: "info" },
  PRE_ENROLLMENT_SUBMITTED: { label: "Pré-matrícula enviada", icon: Activity, variant: "warning" },
  PRE_ENROLLMENT_APPROVED: { label: "Matrícula aprovada", icon: Activity, variant: "success" },
  PRE_ENROLLMENT_RETURNED: { label: "Matrícula devolvida", icon: Activity, variant: "danger" },
  USER_CREATED: { label: "Usuário/curso criado", icon: UserPlus, variant: "info" },
  USER_DEACTIVATED: { label: "Usuário desativado", icon: UserX, variant: "danger" },
};

export default async function AdminAuditoriaPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") {
    redirect("/");
  }

  const audits = await prisma.enrollmentAudit.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true, role: true } } },
  });

  // Stats rápidas
  const ultimas24h = audits.filter(
    (a) => Date.now() - a.createdAt.getTime() < 24 * 60 * 60 * 1000
  ).length;

  // Agrupa por dia
  const porDia = audits.reduce<Record<string, number>>((acc, a) => {
    const day = a.createdAt.toISOString().slice(0, 10);
    acc[day] = (acc[day] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Auditoria"
        description="Log cronológico de todas as ações do sistema"
        icon={FileText}
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Eventos registrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{audits.length}</p>
              <p className="text-xs text-slate-500">últimos 100</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Últimas 24h
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-direta-orange">
                {ultimas24h}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Dias ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600">
                {Object.keys(porDia).length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Timeline de eventos</CardTitle>
            <CardDescription>
              Ações mais recentes no sistema (audit log imutável)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {audits.length === 0 ? (
              <div className="rounded-md border border-dashed p-12 text-center text-sm text-slate-500">
                Nenhum evento registrado ainda.
                <br />
                <span className="text-xs">
                  A medida que usuários criarem leads, atualizarem status ou
                  cadastrarem cursos, os eventos aparecerão aqui.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {audits.map((audit) => {
                  const meta = ACTION_META[audit.action] ?? {
                    label: audit.action,
                    icon: FileText,
                    variant: "neutral",
                  };
                  const Icon = meta.icon;

                  return (
                    <div
                      key={audit.id}
                      className="flex items-start gap-3 rounded-md border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                        <Icon className="h-4 w-4 text-slate-600" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                          <span className="text-xs text-slate-500">
                            por{" "}
                            <span className="font-medium text-slate-700">
                              {audit.actor?.name ?? "Sistema"}
                            </span>
                            {audit.actor?.role && (
                              <span className="ml-1 text-slate-400">
                                ({audit.actor.role})
                              </span>
                            )}
                          </span>
                        </div>
                        {audit.details && (
                          <p className="mt-1 text-sm text-slate-700">
                            {audit.details}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">
                          <code className="rounded bg-slate-200 px-1.5 py-0.5">
                            {audit.targetType ?? "—"}#{audit.targetId?.slice(0, 8) ?? "—"}
                          </code>
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          {formatDateTime(audit.createdAt)}
                        </p>
                      </div>
                    </div>
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
