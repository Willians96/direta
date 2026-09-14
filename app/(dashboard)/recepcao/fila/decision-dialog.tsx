"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  decideEnrollmentAction,
  type ActionState,
} from "@/lib/actions/enrollment";

interface DecisionDialogProps {
  leadId: string;
  leadName: string;
  decision: "APROVAR" | "DEVOLVER";
}

export function DecisionDialog({ leadId, leadName, decision }: DecisionDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const { register, handleSubmit, reset } = useForm<{ reason: string }>();

  const onSubmit = handleSubmit((data) => {
    const formData = new FormData();
    formData.append("leadId", leadId);
    formData.append("decision", decision);
    if (data.reason) formData.append("reason", data.reason);

    startTransition(async () => {
      const result = await decideEnrollmentAction({} as ActionState, formData);
      if (result.ok) {
        toast.success(result.message ?? "Decisão registrada!");
        setOpen(false);
        reset();
      } else {
        toast.error(result.error ?? "Erro");
      }
    });
  });

  const isApprove = decision === "APROVAR";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        variant={isApprove ? "default" : "outline"}
        onClick={() => setOpen(true)}
        className={
          isApprove
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "border-red-300 text-red-700 hover:bg-red-50"
        }
      >
        {isApprove ? (
          <>
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Aprovar
          </>
        ) : (
          <>
            <XCircle className="mr-1 h-3 w-3" />
            Devolver
          </>
        )}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isApprove ? "Aprovar matrícula" : "Devolver para vendas"}
          </DialogTitle>
          <DialogDescription>
            Lead: <span className="font-medium text-slate-800">{leadName}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">
              {isApprove ? "Observação (opcional)" : "Motivo da devolução *"}
            </Label>
            <Textarea
              id="reason"
              rows={3}
              placeholder={
                isApprove
                  ? "Ex: Documentação completa, matrícula confirmada."
                  : "Ex: Falta comprovante de residência atualizado."
              }
              {...register("reason")}
            />
            {!isApprove && (
              <p className="text-xs text-slate-500">
                O motivo será visível para a equipe de vendas.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={pending}
              variant={isApprove ? "default" : "destructive"}
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isApprove ? "Confirmar aprovação" : "Confirmar devolução"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
