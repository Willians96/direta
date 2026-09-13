"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Megaphone,
  UserPlus,
  Target,
  FileText,
  CheckCircle2,
  ScrollText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import type { UserRole } from "@prisma/client";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
};

const NAV_ITEMS: NavItem[] = [
  // Admin
  { title: "Visão Geral", href: "/admin", icon: LayoutDashboard, roles: ["ADMIN"] },
  { title: "Usuários", href: "/admin/usuarios", icon: Users, roles: ["ADMIN"] },
  { title: "Cursos", href: "/admin/cursos", icon: GraduationCap, roles: ["ADMIN"] },
  { title: "Auditoria", href: "/admin/auditoria", icon: ScrollText, roles: ["ADMIN"] },

  // Captação
  { title: "Dashboard", href: "/captacao", icon: LayoutDashboard, roles: ["ADMIN", "CAPTACAO"] },
  { title: "Leads", href: "/captacao/leads", icon: UserPlus, roles: ["ADMIN", "CAPTACAO"] },
  { title: "Campanhas", href: "/captacao/campanhas", icon: Megaphone, roles: ["ADMIN", "CAPTACAO"] },

  // Vendas
  { title: "Meu Funil", href: "/vendas", icon: Target, roles: ["ADMIN", "VENDAS"] },
  { title: "Leads Atribuídos", href: "/vendas/leads", icon: UserPlus, roles: ["ADMIN", "VENDAS"] },
  { title: "Documentos", href: "/vendas/documentos", icon: FileText, roles: ["ADMIN", "VENDAS"] },

  // Recepção
  { title: "Painel", href: "/recepcao", icon: LayoutDashboard, roles: ["ADMIN", "RECEPCAO"] },
  { title: "Fila de Análise", href: "/recepcao/fila", icon: CheckCircle2, roles: ["ADMIN", "RECEPCAO"] },
];

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const groupedItems = items.reduce<Record<string, NavItem[]>>((acc, item) => {
    const area = item.href.split("/")[1];
    if (!acc[area]) acc[area] = [];
    acc[area].push(item);
    return acc;
  }, {});

  const AREA_LABELS: Record<string, string> = {
    admin: "Administração",
    captacao: "Captação",
    vendas: "Vendas",
    recepcao: "Recepção",
  };

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-slate-900 text-slate-100">
      {/* Logo + Brand */}
      <div className="flex h-16 items-center border-b border-slate-800 px-5">
        <Logo variant="full" theme="dark" size="md" href="/" />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-6 overflow-y-auto p-4">
        {Object.entries(groupedItems).map(([area, areaItems]) => (
          <div key={area}>
            <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {AREA_LABELS[area] || area}
            </div>
            <div className="space-y-1">
              {areaItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-direta-orange/15 text-direta-orange font-medium border-l-2 border-direta-orange pl-[10px]"
                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 p-4">
        <Link
          href="/perfil"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60 hover:text-white"
        >
          <Settings className="h-4 w-4" />
          Configurações
        </Link>
        <div className="mt-3 px-3 text-[10px] text-slate-500">
          v0.1.0 · Fase 1
        </div>
      </div>
    </aside>
  );
}
