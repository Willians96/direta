"use client";

import { Bell, LogOut, Search, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { signOut } from "next-auth/react";
import type { UserRole } from "@prisma/client";

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  CAPTACAO: "Captação",
  VENDAS: "Vendas",
  RECEPCAO: "Recepção",
};

export function Header({
  user,
}: {
  user: { name: string; email: string; role: UserRole };
}) {
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white px-4 md:px-6">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Buscar leads, cursos, campanhas..."
          className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Notificações */}
        <button
          className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        {/* User menu */}
        <div className="flex items-center gap-3 border-l pl-3 ml-1">
          <div className="hidden sm:block text-right">
            <div className="text-sm font-medium leading-tight">{user.name}</div>
            <div className="text-[11px] text-slate-500 leading-tight">
              {ROLE_LABELS[user.role]}
            </div>
          </div>
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-sm">
              {initials || <UserIcon className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
