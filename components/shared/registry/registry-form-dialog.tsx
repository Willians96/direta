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

export type RegistryActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const registroSchema = z.object({
  description: z.string().min(2, "Informe a descrição").max(80),
  active: z.boolean(),
});

type RegistroFormData = z.infer<typeof registroSchema>;

interface RegistryFormDialogProps {
  /** Título quando é criação (ex.: "Nova forma de pagamento"). */
  createTitle: string;
  /** Título quando é edição (ex.: "Editar forma de pagamento"). */
  editTitle: string;
  /** Texto de apoio do dialog. */
  description: string;
  /** Texto do botão que abre o dialog de criação. */
  triggerLabel: string;
  /** Rótulo do campo principal. */
  fieldLabel: string;
  /** Exemplo exibido no campo. */
  placeholder: string;
  /** Item editado (undefined = criação). */
  item?: { id: string; description: string; active: boolean };
  createAction: (prev: RegistryActionState, formData: FormData) => Promise<RegistryActionState>;
  updateAction: (
    id: string,
    prev: RegistryActionState,
    formData: FormData
  ) => Promise<RegistryActionState>;
}

/**
 * Dialog genérico de cadastro (Descrição + Situação Ativo/Inativo).
 * Usado nos cadastros de Formas de Pagamento e Situações de Turma.
 */
export function RegistryFormDialog({
  createTitle,
  editTitle,
  description,
  triggerLabel,
  fieldLabel,
  placeholder,
  item,
  createAction,
  updateAction,
}: RegistryFormDialogProps) {
  const isEdit = !!item;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<RegistroFormData>({
    resolver: zodResolver(registroSchema),
    defaultValues: {
      description: item?.description ?? "",
      active: item?.active ?? true,
    },
  });

  const active = watch("active");

  useEffect(() => {
    if (!open) {
      reset({
        description: item?.description ?? "",
        active: item?.active ?? true,
      });
    }
  }, [open, reset, item]);

  const onSubmit = handleSubmit((data) => {
    const formData = new FormData();
    formData.append("description", data.description);
    formData.append("active", String(data.active));

    startTransition(async () => {
      const result = isEdit
        ? await updateAction(item!.id, {} as RegistryActionState, formData)
        : await createAction({} as RegistryActionState, formData);

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
          <Button variant="ghost" size="sm" title="Editar">
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? editTitle : createTitle}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">{fieldLabel} *</Label>
            <Input id="description" placeholder={placeholder} autoFocus {...register("description")} />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description.message}</p>
            )}
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
