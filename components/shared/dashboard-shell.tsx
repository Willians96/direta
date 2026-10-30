"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shared/sidebar";
import { Header } from "@/components/shared/header";
import type { UserRole } from "@prisma/client";

/**
 * Shell do dashboard (client) — controla o menu lateral em telas pequenas.
 * O sidebar é fixo em >= md e vira um drawer (drawer lateral) abaixo disso.
 */
export function DashboardShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: UserRole };
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  // Tópico do menu em aberto (acordeão: apenas um por vez).
  // null = nenhum tópico aberto.
  const [openArea, setOpenArea] = useState<string | null>(null);

  // Fecha o menu ao navegar (mobile)
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // O tópico correspondente à rota atual fica aberto
  useEffect(() => {
    const area = pathname.split("/")[1];
    if (area) setOpenArea(area);
  }, [pathname]);

  // Clicar num tópico abre só ele (fecha o que estiver aberto)
  const toggleArea = (area: string) =>
    setOpenArea((prev) => (prev === area ? null : area));

  // Bloqueia scroll do body quando o drawer está aberto
  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  return (
    // Sem overflow-x-hidden aqui: ele transformaria este elemento em
    // scroll container e quebraria o `sticky` do header.
    // O clip de overflow acontece no <main>.
    <div className="flex min-h-screen w-full bg-slate-50">
      {/* Sidebar desktop — fixo no topo, ocupando a altura da tela.
          `self-start` impede o flex de esticar o item, e `sticky` o mantém
          ancorado enquanto a página rola (sem "buraco" branco no fim). */}
      <div className="hidden md:sticky md:top-0 md:block md:h-screen md:shrink-0 md:self-start">
        <Sidebar role={user.role} openArea={openArea} onToggleArea={toggleArea} />
      </div>

      {/* Drawer mobile */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 md:hidden ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!navOpen}
      >
        <Sidebar
          role={user.role}
          onClose={() => setNavOpen(false)}
          openArea={openArea}
          onToggleArea={toggleArea}
        />
      </div>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={user} onMenuClick={() => setNavOpen(true)} />
        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
