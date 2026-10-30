"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignLeadAction } from "@/lib/actions/leads";

type Vendedor = { id: string; name: string };

/**
 * Seletor compacto de "vendedor responsável" usado na coluna VENDE da tela de
 * Captação de Leads (Sprint 21). Atribui o lead sem sair da lista.
 */
export function AssignSellerSelect({
  leadId,
  currentId,
  vendedores,
}: {
  leadId: string;
  currentId: string | null;
  vendedores: Vendedor[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(currentId ?? "");

  function handleChange(novo: string) {
    setValue(novo);
    startTransition(async () => {
      try {
        await assignLeadAction({ assignedToId: novo });
      } finally {
        router.refresh();
      }
    });
  }

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Vendedor responsável"
      title="Atribuir vendedor responsável"
      className="h-7 w-full max-w-[150px] rounded border border-transparent bg-transparent px-1 text-xs text-slate-600 hover:border-slate-200 hover:bg-white focus:border-direta-orange focus:outline-none disabled:opacity-60"
    >
      <option value="" disabled>
        {currentId ? "" : "Não atribuído"}
      </option>
      {vendedores.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </select>
  );
}
