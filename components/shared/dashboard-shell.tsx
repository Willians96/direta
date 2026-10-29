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

  // Fecha o menu ao navegar (mobile)
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

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
      {/* Sidebar desktop */}
      <div className="hidden md:block md:shrink-0">
        <Sidebar role={user.role} />
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
        <Sidebar role={user.role} onClose={() => setNavOpen(false)} />
      </div>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={user} onMenuClick={() => setNavOpen(true)} />
        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
