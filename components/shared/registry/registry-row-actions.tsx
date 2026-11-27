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
import type { RegistryActionState } from "./registry-form-dialog";

interface RegistryRowActionsProps {
  id: string;
  descricao: string;
  ativa: boolean;
  /** Texto do item (ex.: "forma de pagamento") usado nas mensagens. */
  tipo: string;
  /** Quantos registros usam esta linha (se > 0, a exclusão é bloqueada). */
  usos: number;
  /** Frase que explica o que acontece ao inativar. */
  aoInativar: string;
  toggleAction: (id: string, prev: RegistryActionState, formData: FormData) => Promise<RegistryActionState>;
  deleteAction: (id: string, prev: RegistryActionState, formData: FormData) => Promise<RegistryActionState>;
}

/** Ações da linha: ativar/inativar e excluir. */
export function RegistryRowActions({
  id,
  descricao,
  ativa,
  tipo,
  usos,
  aoInativar,
  toggleAction,
  deleteAction,
}: RegistryRowActionsProps) {
  const [situacaoOpen, setSituacaoOpen] = useState(false);
  const [excluirOpen, setExcluirOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function alternarSituacao() {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("active", String(!ativa));
      const resultado = await toggleAction(id, {} as RegistryActionState, formData);
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
      const resultado = await deleteAction(id, {} as RegistryActionState, new FormData());
      if (!resultado.ok) {
        toast.error("Não foi possível excluir", {
          description: resultado.error ?? "Erro inesperado.",
        });
        return;
      }
      toast.success(resultado.message ?? "Excluído");
      setExcluirOpen(false);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        title={ativa ? `Inativar ${tipo}` : `Ativar ${tipo}`}
        onClick={() => setSituacaoOpen(true)}
      >
        {ativa ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        title={`Excluir ${tipo}`}
        onClick={() => setExcluirOpen(true)}
        disabled={usos > 0}
      >
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>

      {/* Situação */}
      <Dialog open={situacaoOpen} onOpenChange={setSituacaoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {ativa ? "Inativar" : "Ativar"} {tipo}
            </DialogTitle>
            <DialogDescription>
              {ativa ? (
                <>
                  <strong>{descricao}</strong> — {aoInativar}
                </>
              ) : (
                <>
                  <strong>{descricao}</strong> voltará a aparecer nos cadastros.
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
            <DialogTitle>Excluir {tipo}</DialogTitle>
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
