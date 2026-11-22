"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Endereço do webhook com botão de copiar — para colar no painel da Meta.
 */
export function WebhookUrl({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard bloqueado — a URL segue visível para copiar à mão
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="break-all rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
        {url}
      </code>
      <Button type="button" variant="outline" size="sm" onClick={copiar} title="Copiar endereço">
        {copiado ? (
          <>
            <Check className="mr-2 h-3.5 w-3.5 text-emerald-600" />
            Copiado
          </>
        ) : (
          <>
            <Copy className="mr-2 h-3.5 w-3.5" />
            Copiar
          </>
        )}
      </Button>
    </div>
  );
}
