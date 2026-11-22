"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, PlugZap, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  removerIntegracaoAction,
  salvarWhatsappAction,
  testarWhatsappAction,
  type ActionState,
} from "@/lib/actions/integrations";
import { Campo, type StatusCampo } from "@/components/shared/integrations/config-field";

/**
 * Formulário de configuração do WhatsApp (Meta Cloud API).
 *
 * O que for salvo aqui passa a valer imediatamente — sem novo deploy.
 * Campo em branco mantém o valor atual.
 */

export function WhatsappConfigForm({
  status,
  verifyToken,
}: {
  status: {
    appSecret: StatusCampo;
    accessToken: StatusCampo;
    phoneNumberId: StatusCampo;
    verifyToken: StatusCampo;
  };
  verifyToken: string | null;
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
      const resultado = await salvarWhatsappAction(formData);
      setEstado(resultado);
      if (resultado.ok) router.refresh();
    });
  };

  const testar = () => {
    setTeste(null);
    startTestando(async () => {
      setTeste(await testarWhatsappAction());
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
          name="appSecret"
          label="App Secret"
          description="Em Configurações do App → Básico → App Secret (32 caracteres). É o que valida a assinatura das mensagens — sem ele o webhook recusa tudo."
          status={status.appSecret}
          secret
        />

        <Campo
          name="accessToken"
          label="Token de acesso permanente"
          description="Gerado em WhatsApp → Configuração → Tokens de acesso. Usado para enviar mensagens (Fase 3) e no botão de teste."
          status={status.accessToken}
          secret
        />

        <Campo
          name="phoneNumberId"
          label="Phone Number ID"
          description="O identificador do número de WhatsApp (em WhatsApp → Configuração → Números de telefone). Não é secreto."
          status={status.phoneNumberId}
        />

        <Campo
          name="verifyToken"
          label="Token de verificação"
          description="O mesmo valor que você cadastra no painel da Meta. Se trocar aqui, troque lá também — senão a Meta não consegue validar o webhook."
          status={status.verifyToken}
          secret
          copiável
          valorInicial={verifyToken}
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
                <PlugZap className="mr-2 h-4 w-4" />
                Testar conexão com a Meta
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
            { chave: "whatsapp_app_secret", rotulo: "App Secret" },
            { chave: "whatsapp_access_token", rotulo: "Token de acesso" },
            { chave: "whatsapp_phone_number_id", rotulo: "Phone Number ID" },
            { chave: "whatsapp_verify_token", rotulo: "Token de verificação" },
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
