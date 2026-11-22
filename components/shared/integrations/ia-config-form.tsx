"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Sparkles, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  removerIntegracaoAction,
  salvarIaAction,
  testarIaAction,
  type ActionState,
} from "@/lib/actions/integrations";
import { Campo, type StatusCampo } from "@/components/shared/integrations/config-field";

/**
 * Formulário da análise por IA (chave do provedor).
 *
 * Sem a chave, a captação continua funcionando — só a análise fica mais seca
 * (só regras). Com a chave, a IA qualifica cada mensagem recebida.
 */
export function IaConfigForm({
  status,
}: {
  status: {
    apiKey: StatusCampo;
    baseUrl: StatusCampo;
    model: StatusCampo;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isTestando, startTestando] = useTransition();
  const [estado, setEstado] = useState<ActionState | null>(null);
  const [teste, setTeste] = useState<{ ok: boolean; mensagem: string } | null>(null);

  const salvar = (formData: FormData) => {
    setEstado(null);
    setTeste(null);
    startTransition(async () => {
      const resultado = await salvarIaAction(formData);
      setEstado(resultado);
      if (resultado.ok) router.refresh();
    });
  };

  const testar = () => {
    setTeste(null);
    startTestando(async () => {
      setTeste(await testarIaAction());
    });
  };

  const limpar = (formData: FormData) => {
    setEstado(null);
    startTransition(async () => {
      const resultado = await removerIntegracaoAction(formData);
      setEstado(resultado);
      if (resultado.ok) router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          salvar(new FormData(e.currentTarget));
        }}
        className="space-y-3"
      >
        <Campo
          name="apiKey"
          label="Chave da API"
          description="A chave do provedor de IA (MiniMax, Anthropic ou outro compatível com o protocolo messages)."
          status={status.apiKey}
          secret
        />

        <Campo
          name="baseUrl"
          label="Base da API"
          description="Endereço base do provedor. Deixe em branco para usar o padrão do sistema."
          status={status.baseUrl}
          placeholder="https://agent.minimax.io/mavis/api/v1/llm/v1"
        />

        <Campo
          name="model"
          label="Modelo"
          description="Nome do modelo usado na análise. Deixe em branco para usar o padrão do sistema."
          status={status.model}
          placeholder="MiniMax-M3.1-Flash"
        />

        {estado && (
          <div
            className={`rounded-md p-3 text-sm ${
              estado.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {estado.ok ? estado.message : estado.error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar
              </>
            )}
          </Button>

          <Button type="button" variant="outline" onClick={testar} disabled={isTestando}>
            {isTestando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Testar conexão com a IA
              </>
            )}
          </Button>
        </div>
      </form>

      {teste && (
        <div
          className={`rounded-md p-3 text-sm ${
            teste.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
          }`}
        >
          {teste.ok ? "✓ " : "✗ "}
          {teste.mensagem}
        </div>
      )}

      <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-600">
          Remover valores salvos no painel
        </summary>
        <p className="mt-2 text-xs text-slate-500">
          Apaga o que está gravado aqui no sistema. Se o servidor tiver o mesmo valor em variável de
          ambiente, ele volta a valer.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { chave: "llm_api_key", rotulo: "Chave da API" },
            { chave: "llm_base_url", rotulo: "Base da API" },
            { chave: "llm_model", rotulo: "Modelo" },
          ].map((item) => (
            <form
              key={item.chave}
              onSubmit={(e) => {
                e.preventDefault();
                limpar(new FormData(e.currentTarget));
              }}
            >
              <input type="hidden" name="chave" value={item.chave} />
              <Button type="submit" variant="ghost" size="sm" disabled={isPending}>
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                {item.rotulo}
              </Button>
            </form>
          ))}
        </div>
      </details>
    </div>
  );
}
