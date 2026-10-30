"use client";

import { useEffect, useMemo, useState } from "react";
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
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  MessageCircle,
  ChevronDown,
  X,
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
  { title: "Turmas", href: "/admin/turmas", icon: ClipboardList, roles: ["ADMIN"] },
  { title: "Metas", href: "/admin/metas", icon: TrendingUp, roles: ["ADMIN"] },
  { title: "Alertas", href: "/admin/alertas", icon: AlertTriangle, roles: ["ADMIN", "CAPTACAO"] },
  { title: "Conversas", href: "/admin/conversas", icon: MessageCircle, roles: ["ADMIN", "CAPTACAO"] },
  { title: "Auditoria", href: "/admin/auditoria", icon: ScrollText, roles: ["ADMIN"] },

  // Captação
  { title: "Dashboard", href: "/captacao", icon: LayoutDashboard, roles: ["ADMIN", "CAPTACAO"] },
  { title: "Leads", href: "/captacao/leads", icon: UserPlus, roles: ["ADMIN", "CAPTACAO"] },
  { title: "Campanhas", href: "/captacao/campanhas", icon: Megaphone, roles: ["ADMIN", "CAPTACAO"] },

  // Vendas
  { title: "Meu Funil", href: "/vendas", icon: Target, roles: ["ADMIN", "VENDAS"] },
  { title: "Leads Atribuídos", href: "/vendas/leads", icon: UserPlus, roles: ["ADMIN", "VENDAS"] },
  { title: "Meus Alertas", href: "/vendas/alertas", icon: AlertTriangle, roles: ["VENDAS"] },
  { title: "Documentos", href: "/vendas/documentos", icon: FileText, roles: ["ADMIN", "VENDAS"] },

  // Recepção
  { title: "Painel", href: "/recepcao", icon: LayoutDashboard, roles: ["ADMIN", "RECEPCAO"] },
  { title: "Fila de Análise", href: "/recepcao/fila", icon: CheckCircle2, roles: ["ADMIN", "RECEPCAO"] },
];

const AREA_LABELS: Record<string, string> = {
  admin: "Administração",
  captacao: "Captação",
  vendas: "Vendas",
  recepcao: "Recepção",
};

/** Chave de persistência dos tópicos recolhidos no localStorage. */
const STORAGE_KEY = "direta:sidebar-topicos";

export function Sidebar({
  role,
  onClose,
}: {
  role: UserRole;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const groupedItems = items.reduce<Record<string, NavItem[]>>((acc, item) => {
    const area = item.href.split("/")[1];
    if (!acc[area]) acc[area] = [];
    acc[area].push(item);
    return acc;
  }, {});

  // Áreas disponíveis para este perfil (estável entre renders)
  const allAreas = useMemo(() => Object.keys(groupedItems), [groupedItems]);

  // Tópicos abertos. null = nenhum ajuste manual (todos abertos por padrão).
  const [openAreas, setOpenAreas] = useState<string[] | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Restaura o estado salvo no navegador
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setOpenAreas(parsed as string[]);
      }
    } catch {
      /* localStorage indisponível */
    }
    setHydrated(true);
  }, []);

  // Persiste o estado
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(openAreas));
    } catch {
      /* localStorage indisponível */
    }
  }, [openAreas, hydrated]);

  // Ao navegar, garante que o tópico da rota atual fique aberto
  useEffect(() => {
    const area = pathname.split("/")[1];
    if (!area) return;
    setOpenAreas((prev) => {
      const current = prev === null ? allAreas : prev;
      if (current.includes(area)) return prev;
      return [...current, area];
    });
  }, [pathname, allAreas]);

  const isAreaOpen = (area: string) =>
    openAreas === null ? true : openAreas.includes(area);

  // Acordeão: abrir um tópico fecha os demais
  const toggleArea = (area: string) =>
    setOpenAreas((prev) => {
      const current = prev === null ? allAreas : prev;
      const isOnlyOpen = current.length === 1 && current[0] === area;
      // Clicar no único tópico aberto fecha tudo
      if (isOnlyOpen) return current.filter((a) => a !== area);
      // Clicar em qualquer outro abre só ele
      return [area];
    });

  return (
    <aside className="flex h-screen w-64 flex-col bg-slate-900 text-slate-100">
      {/* Logo + Brand */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 px-5">
        <Logo variant="full" theme="dark" size="md" href="/" />
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="scrollbar-hidden flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-3">
        {Object.entries(groupedItems).map(([area, areaItems]) => {
          const isOpen = isAreaOpen(area);

          return (
            <div key={area}>
              {/* Cabeçalho do tópico (retrátil) */}
              <button
                type="button"
                onClick={() => toggleArea(area)}
                aria-expanded={isOpen}
                aria-controls={`topico-${area}`}
                className="mb-1 flex w-full items-center justify-between rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-800/40 hover:text-slate-400"
              >
                <span className="truncate">{AREA_LABELS[area] || area}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                    !isOpen && "-rotate-90"
                  )}
                />
              </button>

              {/* Itens do tópico */}
              <div
                id={`topico-${area}`}
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
              >
                <div className="overflow-hidden">
                  <div className="space-y-1 pt-0.5">
                    {areaItems.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        pathname === item.href || pathname.startsWith(item.href + "/");
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors",
                            isActive
                              ? "bg-direta-orange/15 text-direta-orange font-medium border-l-2 border-direta-orange pl-[10px]"
                              : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-800 p-3">
        <Link
          href="/perfil"
          onClick={onClose}
          className="flex items-center gap-3 rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800/60 hover:text-white"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="truncate">Configurações</span>
        </Link>
        <div className="mt-2 px-3 text-[10px] text-slate-500">
          v0.1.0 · Fase 1
        </div>
      </div>
    </aside>
  );
}
