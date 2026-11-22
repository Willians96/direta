"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FlaskConical, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { simularMensagemWhatsAppAction } from "@/lib/actions/whatsapp";

export type Cenario = {
  titulo: string;
  nome: string;
  telefone: string;
  mensagem: string;
};

export function WhatsappSimulator({ cenarios }: { cenarios: Cenario[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  function usarCenario(c: Cenario) {
    setNome(c.nome);
    setTelefone(c.telefone);
    setMensagem(c.mensagem);
    setResultado(null);
    setErro(null);
  }

  function enviar() {
    setErro(null);
    startTransition(async () => {
      try {
        const r = await simularMensagemWhatsAppAction({
          nome,
          telefone,
          mensagem,
        });
        setResultado(r);
        router.refresh();
      } catch (e: any) {
        setErro(String(e?.message || e));
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Cenários prontos */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          <FlaskConical className="h-3.5 w-3.5" />
          Cenários prontos (clique para carregar)
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {cenarios.map((c) => (
            <button
              key={c.titulo}
              type="button"
              onClick={() => usarCenario(c)}
              className="rounded-md border bg-white p-3 text-left transition-colors hover:border-direta-orange"
            >
              <div className="text-sm font-medium text-slate-800">{c.titulo}</div>
              <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{c.mensagem}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Formulário */}
      <div className="rounded-md border bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="nome">Nome no WhatsApp</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: João da Silva"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="telefone">Telefone (wa_id)</Label>
            <Input
              id="telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="5511987654321"
              className="mt-1"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Código do país + número, só dígitos (a Meta envia assim).
            </p>
          </div>
        </div>

        <div className="mt-3">
          <Label htmlFor="mensagem">Mensagem recebida</Label>
          <Textarea
            id="mensagem"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Olá, quero saber do curso de NR-35 e quanto custa"
            rows={4}
            className="mt-1"
          />
        </div>

        <Button className="mt-3" disabled={pending || !mensagem || !telefone} onClick={enviar}>
          <Send className="mr-2 h-4 w-4" />
          Processar mensagem
        </Button>

        {erro && (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</div>
        )}
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <Sparkles className="h-4 w-4" />
            {resultado.leadNovo ? "Lead criado" : "Lead atualizado"}
          </div>

          {resultado.analise && (
            <div className="mt-2 space-y-1 text-sm text-emerald-900">
              <p>{resultado.analise.resumo}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="rounded-full bg-white px-2 py-0.5 text-xs">
                  curso: {resultado.analise.courseName ?? "—"}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs">
                  status: {resultado.analise.status ?? "—"}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs">
                  interesse: {resultado.analise.score}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs">
                  análise: {resultado.analise.model === "llm" ? "IA" : "regras"}
                </span>
                {resultado.analise.tags.map((t: string) => (
                  <span key={t} className="rounded-full bg-white px-2 py-0.5 text-xs">
                    {t}
                  </span>
                ))}
              </div>
              {resultado.analise.erroIA && (
                <p className="text-xs text-amber-700">
                  A IA não respondeu ({resultado.analise.erroIA}) — usamos as regras.
                </p>
              )}
            </div>
          )}

          {resultado.leadId && (
            <Link
              href={`/vendas/leads/${resultado.leadId}`}
              className="mt-3 inline-block text-sm font-medium text-emerald-800 underline"
            >
              Abrir o lead gerado →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
