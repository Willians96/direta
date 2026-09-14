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
import {
  createCampaignAction,
  updateCampaignAction,
  type ActionState,
} from "@/lib/actions/campaigns";

const campaignSchema = z.object({
  name: z.string().min(3, "Mínimo 3 caracteres"),
  channel: z.enum([
    "INSTAGRAM", "FACEBOOK", "GOOGLE_ADS", "WHATSAPP", "EMAIL", "INDICACAO", "OUTRO",
  ]),
  startDate: z.string().min(1, "Data de início obrigatória"),
  endDate: z.string().optional(),
  budget: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["PLANEJADA", "ATIVA", "PAUSADA", "ENCERRADA"]),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

interface CampaignFormDialogProps {
  campaign?: {
    id: string;
    name: string;
    channel: string;
    startDate: Date;
    endDate: Date | null;
    budget: any;
    description: string | null;
    status: string;
  };
}

export function CampaignFormDialog({ campaign }: CampaignFormDialogProps) {
  const isEdit = !!campaign;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: isEdit
      ? {
          name: campaign.name,
          channel: campaign.channel as any,
          startDate: campaign.startDate.toISOString().slice(0, 10),
          endDate: campaign.endDate?.toISOString().slice(0, 10) ?? "",
          budget: campaign.budget ? String(campaign.budget) : "",
          description: campaign.description ?? "",
          status: campaign.status as any,
        }
      : {
          name: "",
          channel: "INSTAGRAM",
          startDate: new Date().toISOString().slice(0, 10),
          endDate: "",
          budget: "",
          description: "",
          status: "PLANEJADA",
        },
  });

  const channel = watch("channel");
  const status = watch("status");

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = handleSubmit((data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") formData.append(k, String(v));
    });

    startTransition(async () => {
      const action = isEdit
        ? updateCampaignAction(campaign!.id, {} as ActionState, formData)
        : createCampaignAction({} as ActionState, formData);
      const result = await action;

      if (result.ok) {
        toast.success(result.message ?? "Salvo!");
        setOpen(false);
        reset();
      } else {
        toast.error(result.error ?? "Erro");
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
            Nova campanha
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar campanha" : "Nova campanha"}
          </DialogTitle>
          <DialogDescription>
            Cadastre uma campanha de marketing para geração de leads.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select
                value={channel}
                onValueChange={(v) => setValue("channel", v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                  <SelectItem value="FACEBOOK">Facebook</SelectItem>
                  <SelectItem value="GOOGLE_ADS">Google Ads</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="EMAIL">E-mail</SelectItem>
                  <SelectItem value="INDICACAO">Indicação</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) =>
                  setValue("status", v as "PLANEJADA" | "ATIVA" | "PAUSADA" | "ENCERRADA")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANEJADA">Planejada</SelectItem>
                  <SelectItem value="ATIVA">Ativa</SelectItem>
                  <SelectItem value="PAUSADA">Pausada</SelectItem>
                  <SelectItem value="ENCERRADA">Encerrada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Início</Label>
              <Input id="startDate" type="date" {...register("startDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Fim (opcional)</Label>
              <Input id="endDate" type="date" {...register("endDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Budget (R$)</Label>
              <Input id="budget" type="number" step="0.01" {...register("budget")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea id="description" rows={2} {...register("description")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar" : "Criar campanha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
