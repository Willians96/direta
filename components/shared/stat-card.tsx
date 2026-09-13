import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-slate-900">
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
