"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Pencil } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createLeadSourceAction,
  updateLeadSourceAction,
  type ActionState,
} from "@/lib/actions/lead-sources";

const fonteSchema = z.object({
  description: z.string().min(2, "Informe a descrição").max(80),
  noCommission: z.boolean(),
  active: z.boolean(),
});

type FonteFormData = z.infer<typeof fonteSchema>;

interface LeadSourceFormDialogProps {
  fonte?: {
    id: string;
    description: string;
    noCommission: boolean;
    active: boolean;
  };
}

export function LeadSourceFormDialog({ fonte }: LeadSourceFormDialogProps) {
  const isEdit = !!fonte;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FonteFormData>({
    resolver: zodResolver(fonteSchema),
    defaultValues: {
      description: fonte?.description ?? "",
      noCommission: fonte?.noCommission ?? false,
      active: fonte?.active ?? true,
    },
  });

  const noCommission = watch("noCommission");
  const active = watch("active");

  useEffect(() => {
    if (!open) {
      reset({
        description: fonte?.description ?? "",
        noCommission: fonte?.noCommission ?? false,
        active: fonte?.active ?? true,
      });
    }
  }, [open, reset, fonte]);

  const onSubmit = handleSubmit((data) => {
    const formData = new FormData();
    formData.append("description", data.description);
    formData.append("noCommission", String(data.noCommission));
    formData.append("active", String(data.active));

    startTransition(async () => {
      const result = isEdit
        ? await updateLeadSourceAction(fonte!.id, {} as ActionState, formData)
        : await createLeadSourceAction({} as ActionState, formData);

      if (result.ok) {
        toast.success(result.message ?? "Salvo!");
        setOpen(false);
      } else {
        toast.error(result.error ?? "Erro ao salvar");
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm">
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova forma de conhecimento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar forma de conhecimento" : "Nova forma de conhecimento"}
          </DialogTitle>
          <DialogDescription>
            Como o cliente conheceu a escola. Essas formas alimentam o cadastro de lead
            e o painel de Captação.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Input
              id="description"
              placeholder="Ex: WhatsApp Direto"
              autoFocus
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <input
              id="noCommission"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-direta-orange"
              checked={noCommission}
              onChange={(e) => setValue("noCommission", e.target.checked)}
            />
            <Label htmlFor="noCommission" className="font-normal leading-snug">
              Não gerar comissão
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Situação</Label>
            <div className="flex gap-4 rounded-md border border-slate-200 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="situacao"
                  checked={active}
                  onChange={() => setValue("active", true)}
                  className="h-4 w-4"
                />
                Ativo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="situacao"
                  checked={!active}
                  onChange={() => setValue("active", false)}
                  className="h-4 w-4"
                />
                Inativo
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
