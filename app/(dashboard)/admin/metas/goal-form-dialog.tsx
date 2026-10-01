"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Save, Target } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { upsertGoalAction, type ActionState } from "@/lib/actions/goals";

const goalSchema = z.object({
  userId: z.string().min(1, "Vendedor obrigatório"),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  metaMatricula: z.coerce.number().int().min(0),
  metaFaturamento: z.coerce.number().min(0),
  metaFollowup: z.coerce.number().int().min(0),
  metaIndicacao: z.coerce.number().int().min(0),
  notes: z.string().max(500).optional(),
});

type FormData = z.infer<typeof goalSchema>;

interface GoalFormDialogProps {
  sellers: Array<{ id: string; name: string; email: string; role: string }>;
  initial?: {
    userId: string;
    month: number;
    year: number;
    metaMatricula: number;
    metaFaturamento: number;
    metaFollowup: number;
    metaIndicacao: number;
    notes: string | null;
  };
  defaultMonth: number;
  defaultYear: number;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function GoalFormDialog({
  sellers,
  initial,
  defaultMonth,
  defaultYear,
}: GoalFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: initial
      ? {
          userId: initial.userId,
          month: initial.month,
          year: initial.year,
          metaMatricula: initial.metaMatricula,
          metaFaturamento: initial.metaFaturamento,
          metaFollowup: initial.metaFollowup,
          metaIndicacao: initial.metaIndicacao,
          notes: initial.notes ?? "",
        }
      : {
          userId: sellers[0]?.id ?? "",
          month: defaultMonth,
          year: defaultYear,
          metaMatricula: 0,
          metaFaturamento: 0,
          metaFollowup: 0,
          metaIndicacao: 0,
          notes: "",
        },
  });

  const userId = watch("userId");
  const month = watch("month");
  const year = watch("year");

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = handleSubmit((data) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
    });

    startTransition(async () => {
      const r = await upsertGoalAction({} as ActionState, fd);
      if (r.ok) {
        toast.success(r.message ?? "Meta salva!");
        setOpen(false);
        reset();
      } else toast.error(r.error ?? "Erro");
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {initial ? (
          <Button variant="ghost" size="sm">
            <Target className="h-3 w-3" />
          </Button>
        ) : (
          <Button>
            <Target className="mr-2 h-4 w-4" />
            Definir meta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Definir meta mensal</DialogTitle>
          <DialogDescription>
            {initial
              ? "Edite os valores da meta abaixo"
              : "Defina as metas para um vendedor em um mês específico"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 space-y-2 md:col-span-1">
              <Label>Vendedor</Label>
              <Select
                value={userId}
                onValueChange={(v) => setValue("userId", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sellers
                    .filter((s) => s.role === "VENDAS" || s.role === "CAPTACAO" || s.role === "ADMIN")
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {errors.userId && (
                <p className="text-xs text-red-500">{errors.userId.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select
                value={String(month)}
                onValueChange={(v) => setValue("month", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Input
                type="number"
                min="2020"
                max="2100"
                {...register("year")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="metaMatricula">Matrículas</Label>
              <Input
                id="metaMatricula"
                type="number"
                min="0"
                {...register("metaMatricula")}
              />
              <p className="text-xs text-slate-500">leads → APROVADA</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="metaFaturamento">Faturamento (R$)</Label>
              <Input
                id="metaFaturamento"
                type="number"
                min="0"
                step="0.01"
                {...register("metaFaturamento")}
              />
              <p className="text-xs text-slate-500">soma dos cursos</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="metaFollowup">Acionamentos</Label>
              <Input
                id="metaFollowup"
                type="number"
                min="0"
                {...register("metaFollowup")}
              />
              <p className="text-xs text-slate-500">interações/mês</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="metaIndicacao">Indicações</Label>
              <Input
                id="metaIndicacao"
                type="number"
                min="0"
                {...register("metaIndicacao")}
              />
              <p className="text-xs text-slate-500">leads por canal</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Anotações sobre a meta..."
              {...register("notes")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Salvar meta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
