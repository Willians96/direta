import Link from "next/link";
import { Construction, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import type { LucideIcon } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description: string;
  icon: LucideIcon;
  sprint: string;
  features: string[];
}

export function ComingSoon({
  title,
  description,
  icon: Icon,
  sprint,
  features,
}: ComingSoonProps) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        icon={Icon}
      />

      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-2xl rounded-xl border-2 border-dashed border-direta-orange/30 bg-gradient-to-br from-orange-50 via-white to-blue-50 p-12 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-direta-orange/10">
            <Construction className="h-10 w-10 text-direta-orange" />
          </div>

          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-direta-orange/10 px-3 py-1 text-xs font-semibold text-direta-orange-dark">
            <Sparkles className="h-3 w-3" />
            {sprint}
          </div>

          <h2 className="mt-4 text-2xl font-bold text-slate-900">
            Tela em construção
          </h2>

          <p className="mt-3 text-sm text-slate-600">
            Esta funcionalidade está prevista no roadmap da Fase 1 e será
            entregue nas próximas sprints.
          </p>

          {features.length > 0 && (
            <div className="mt-8 rounded-lg border border-slate-200 bg-white p-5 text-left">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
                O que esta tela vai entregar
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-direta-orange" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="default">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao dashboard
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link
                href="https://github.com/Willians96/direta/issues"
                target="_blank"
                rel="noopener noreferrer"
              >
                Acompanhar no GitHub
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
