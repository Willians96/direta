"use client";

import { useState, useTransition } from "react";
import { Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toggleUserStatusAction } from "@/lib/actions/users";

/**
 * Botão de desativar/reativar usuário com confirmação.
 *
 * A confirmação mostra o nome da pessoa — evita desativar a conta errada
 * num clique (o botão ficava direto na lista, sem rede de proteção).
 */
export function UserStatusToggle({
  id,
  nome,
  status,
}: {
  id: string;
  nome: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ativando = status === "INATIVO";

  function confirmar() {
    startTransition(async () => {
      const resultado = await toggleUserStatusAction(id);
      if (!resultado.ok) {
        toast.error("Não foi possível alterar", {
          description: resultado.error ?? "Erro inesperado.",
        });
        return;
      }
      toast.success(ativando ? "Usuário reativado" : "Usuário desativado", {
        description: nome,
      });
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        title={ativando ? "Reativar usuário" : "Desativar usuário"}
        onClick={() => setOpen(true)}
      >
        {ativando ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{ativando ? "Reativar usuário" : "Desativar usuário"}</DialogTitle>
            <DialogDescription>
              {ativando ? (
                <>
                  <strong>{nome}</strong> voltará a conseguir entrar no sistema.
                </>
              ) : (
                <>
                  <strong>{nome}</strong> ficará sem acesso ao sistema. O histórico de leads e
                  mensagens é preservado. Você pode reativar depois.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant={ativando ? "default" : "destructive"}
              onClick={confirmar}
              disabled={isPending}
            >
              {isPending ? "Processando..." : ativando ? "Reativar" : "Desativar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
