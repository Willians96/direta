"use client";

import { useState, useTransition } from "react";
import { Pause, Play, Trash2 } from "lucide-react";
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
import {
  deleteLeadSourceAction,
  toggleLeadSourceAction,
  type ActionState,
} from "@/lib/actions/lead-sources";

/**
 * Ações da linha da lista de Formas de Conhecimento:
 * ativar/inativar e excluir (a exclusão só é liberada quando não há lead vinculado).
 */
export function LeadSourceRowActions({
  id,
  descricao,
  ativa,
  leads,
}: {
  id: string;
  descricao: string;
  ativa: boolean;
  leads: number;
}) {
  const [situacaoOpen, setSituacaoOpen] = useState(false);
  const [excluirOpen, setExcluirOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function alternarSituacao() {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("active", String(!ativa));
      const resultado = await toggleLeadSourceAction(id, {} as ActionState, formData);
      if (!resultado.ok) {
        toast.error("Não foi possível alterar a situação", {
          description: resultado.error ?? "Erro inesperado.",
        });
        return;
      }
      toast.success(resultado.message ?? "Situação alterada");
      setSituacaoOpen(false);
    });
  }

  function excluir() {
    startTransition(async () => {
      const resultado = await deleteLeadSourceAction(id, {} as ActionState, new FormData());
      if (!resultado.ok) {
        toast.error("Não foi possível excluir", {
          description: resultado.error ?? "Erro inesperado.",
        });
        return;
      }
      toast.success(resultado.message ?? "Excluída");
      setExcluirOpen(false);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        title={ativa ? "Inativar forma de conhecimento" : "Ativar forma de conhecimento"}
        onClick={() => setSituacaoOpen(true)}
      >
        {ativa ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        title="Excluir forma de conhecimento"
        onClick={() => setExcluirOpen(true)}
        disabled={leads > 0}
      >
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>

      {/* Situação */}
      <Dialog open={situacaoOpen} onOpenChange={setSituacaoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{ativa ? "Inativar" : "Ativar"} forma de conhecimento</DialogTitle>
            <DialogDescription>
              {ativa ? (
                <>
                  <strong>{descricao}</strong> deixará de aparecer no cadastro de lead. Os
                  leads já cadastrados continuam com a fonte preenchida.
                </>
              ) : (
                <>
                  <strong>{descricao}</strong> voltará a aparecer no cadastro de lead.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSituacaoOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={ativa ? "destructive" : "default"}
              onClick={alternarSituacao}
              disabled={isPending}
            >
              {isPending ? "Processando..." : ativa ? "Inativar" : "Ativar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exclusão */}
      <Dialog open={excluirOpen} onOpenChange={setExcluirOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir forma de conhecimento</DialogTitle>
            <DialogDescription>
              <strong>{descricao}</strong> será removida do cadastro. Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setExcluirOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={excluir} disabled={isPending}>
              {isPending ? "Processando..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
