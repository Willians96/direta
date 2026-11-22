"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

/**
 * Campo de configuração reutilizável (usado nas telas de Integrações).
 */

export type StatusCampo = {
  configurada: boolean;
  origem: "painel" | "servidor" | null;
  mascara: string | null;
  atualizadoEm: string | null;
  atualizadoPor: string | null;
};

export function SeloStatus({ status }: { status: StatusCampo }) {
  if (!status.configurada) {
    return <Badge variant="neutral">Não configurado</Badge>;
  }
  if (status.origem === "painel") {
    return <Badge variant="success">Salvo no painel</Badge>;
  }
  return <Badge variant="info">Vem do servidor</Badge>;
}

export function Campo({
  name,
  label,
  description,
  status,
  secret,
  placeholder,
  copiável,
  valorInicial,
}: {
  name: string;
  label: string;
  description: string;
  status: StatusCampo;
  secret?: boolean;
  placeholder?: string;
  copiável?: boolean;
  valorInicial?: string | null;
}) {
  const [visivel, setVisivel] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    if (!valorInicial) return;
    try {
      await navigator.clipboard.writeText(valorInicial);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard bloqueado — o campo segue visível para copiar à mão
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={name} className="text-sm font-semibold text-slate-700">
          {label}
        </Label>
        <SeloStatus status={status} />
      </div>

      <p className="text-xs text-slate-500">{description}</p>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={name}
            name={name}
            type={secret && !visivel ? "password" : "text"}
            placeholder={
              placeholder ||
              (status.configurada ? "deixe em branco para manter o valor atual" : "não configurado")
            }
            autoComplete="off"
            className={secret ? "pr-10" : ""}
          />
          {secret && (
            <button
              type="button"
              onClick={() => setVisivel((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={visivel ? "Ocultar" : "Mostrar"}
              title={visivel ? "Ocultar" : "Mostrar"}
            >
              {visivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>

        {copiável && valorInicial && (
          <Button type="button" variant="outline" size="icon" onClick={copiar} title="Copiar">
            {copiado ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {status.configurada && (
        <p className="text-[11px] text-slate-500">
          Valor atual: <code className="rounded bg-slate-100 px-1">{status.mascara}</code>
          {status.atualizadoEm && (
            <>
              {" · "}
              {status.origem === "painel"
                ? `salvo em ${status.atualizadoEm}${
                    status.atualizadoPor ? ` por ${status.atualizadoPor}` : ""
                  }`
                : "definido no servidor (variável de ambiente)"}
            </>
          )}
        </p>
      )}
    </div>
  );
}
