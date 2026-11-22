"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MessageCircle, RefreshCw, Send, Sparkles, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  liberarLeadWhatsAppAction,
  aplicarCursoWhatsAppAction,
  aplicarStatusWhatsAppAction,
  reanalisarWhatsAppAction,
  ignorarWhatsAppAction,
} from "@/lib/actions/whatsapp";
import { formatPhone } from "@/lib/utils";

export type LinhaWhatsApp = {
  id: string;
  body: string;
  type: string;
  pushname: string | null;
  phone: string;
  status: string;
  receivedAt: string;
  leadId: string | null;
  leadName: string | null;
  leadVendedor: string | null;
  resumo: string | null;
  tags: string[];
  score: number | null;
  intent: string | null;
  statusSugerido: string | null;
  cursoSugerido: string | null;
  cursoAtual: string | null;
  modelo: string | null;
  atencao: string[];
  pergunta: string | null;
};

function corDoScore(score: number | null) {
  if (score === null) return "neutral";
  if (score >= 70) return "success";
  if (score >= 40) return "warning";
  return "neutral";
}

export function WhatsappQueueRow({
  item,
  vendedores,
}: {
  item: LinhaWhatsApp;
  vendedores: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [vendedor, setVendedor] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const liberado = !!item.leadVendedor;

  const executar = (acao: () => Promise<{ ok: boolean } | void>) => {
    setErro(null);
    startTransition(async () => {
      try {
        await acao();
        router.refresh();
      } catch (e: any) {
        setErro(String(e?.message || e));
      }
    });
  };

  return (
    <div className="rounded-md border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900">
              {item.leadName || item.pushname || "Contato sem nome"}
            </span>
            <span className="text-xs text-slate-500">{formatPhone(item.phone)}</span>
            <Badge variant="neutral">{item.type}</Badge>
            {item.modelo === "llm" && (
              <Badge variant="info">
                <Sparkles className="mr-1 h-3 w-3" />
                IA
              </Badge>
            )}
            {item.modelo === "regras" && <Badge variant="neutral">regras</Badge>}
            {liberado && (
              <Badge variant="success">
                <UserCheck className="mr-1 h-3 w-3" />
                Liberado p/ {item.leadVendedor}
              </Badge>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.body}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-xs text-slate-400">{item.receivedAt}</span>
          {item.score !== null && (
            <Badge variant={corDoScore(item.score) as any}>
              interesse {item.score}
            </Badge>
          )}
        </div>
      </div>

      {/* Análise */}
      {item.resumo && (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Análise do contato
          </div>
          <p className="mt-1 text-sm text-slate-800">{item.resumo}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {item.cursoSugerido && (
              <Badge variant="info">curso: {item.cursoSugerido}</Badge>
            )}
            {item.statusSugerido && (
              <Badge variant="warning">status: {item.statusSugerido}</Badge>
            )}
            {item.intent && <Badge variant="neutral">{item.intent}</Badge>}
            {item.tags.map((t) => (
              <Badge key={t} variant="neutral">
                {t}
              </Badge>
            ))}
          </div>

          {item.pergunta && (
            <p className="mt-2 text-xs text-slate-600">
              <span className="font-medium">Perguntou:</span> {item.pergunta}
            </p>
          )}

          {item.atencao.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-xs text-amber-700">
              {item.atencao.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Ações */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!liberado ? (
          <>
            <select
              value={vendedor}
              onChange={(e) => setVendedor(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
              aria-label="Vendedor responsável"
            >
              <option value="">Escolher vendedor…</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!vendedor || pending}
              onClick={() =>
                executar(() =>
                  liberarLeadWhatsAppAction({
                    inboundId: item.id,
                    vendedorId: vendedor,
                    aplicarCurso: true,
                    aplicarStatus: true,
                  })
                )
              }
            >
              <Send className="mr-2 h-3.5 w-3.5" />
              Liberar para vendas
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/vendas/leads/${item.leadId}`}>Abrir lead</Link>
          </Button>
        )}

        {item.leadId && !liberado && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => executar(() => aplicarCursoWhatsAppAction({ inboundId: item.id }))}
            title={item.cursoSugerido ? `Aplicar ${item.cursoSugerido}` : "Sem curso sugerido"}
          >
            Aplicar curso
          </Button>
        )}

        {item.leadId && !liberado && item.statusSugerido && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => executar(() => aplicarStatusWhatsAppAction({ inboundId: item.id }))}
          >
            Aplicar status
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => executar(() => reanalisarWhatsAppAction({ inboundId: item.id }))}
          title="Reprocessar a análise"
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Reanalisar
        </Button>

        {item.status !== "IGNORADA" && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => executar(() => ignorarWhatsAppAction({ inboundId: item.id }))}
          >
            <X className="mr-2 h-3.5 w-3.5" />
            Ignorar
          </Button>
        )}

        {item.leadId && (
          <Button size="sm" variant="ghost" asChild>
            <a
              href={`https://wa.me/${item.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="mr-2 h-3.5 w-3.5" />
              Conversar
            </a>
          </Button>
        )}
      </div>

      {erro && <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">{erro}</div>}
    </div>
  );
}
