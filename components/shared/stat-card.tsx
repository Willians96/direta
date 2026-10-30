import { Card, CardContent } from "@/components/ui/card";
import { cn, statValueSize } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: "default" | "success" | "warning" | "danger" | "info" | "brand";
}

const VARIANT_STYLES = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-sky-100 text-sky-700",
  brand: "bg-direta-orange/10 text-direta-orange-dark",
};

/**
 * Tamanho da fonte do valor conforme o comprimento do texto.
 * Valores monetários longos ("R$ 2.690,00") não cabem em text-3xl dentro do
 * card e estouravam a borda — a fonte se ajusta ao box.
 */
export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "brand",
}: StatCardProps) {
  const trendPositive = trend && trend.value >= 0;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p
              className={cn(
                "font-bold tracking-tight text-slate-900 tabular-nums break-words",
                statValueSize(value)
              )}
            >
              {value}
            </p>
            {description && (
              <p className="text-xs text-slate-500">{description}</p>
            )}
            {trend && (
              <p
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium",
                  trendPositive ? "text-emerald-600" : "text-red-600"
                )}
              >
                <span>{trendPositive ? "↑" : "↓"}</span>
                {Math.abs(trend.value)}% {trend.label}
              </p>
            )}
          </div>
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-lg",
              VARIANT_STYLES[variant]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
