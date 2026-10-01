"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Phone, MessageSquare, Mail, Calendar, User, MapPin, MoreHorizontal } from "lucide-react";
import { FollowupType, FollowupOutcome } from "@prisma/client";
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
import { registerFollowupAction } from "@/lib/actions/followups";

const schema = z.object({
  type: z.nativeEnum(FollowupType),
  outcome: z.nativeEnum(FollowupOutcome),
  notes: z.string().max(2000).optional(),
  occurredAt: z.string().optional(),
  nextAction: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TYPE_OPTIONS: { value: FollowupType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "LIGACAO", label: "Ligação", icon: Phone },
  { value: "WHATSAPP", label: "WhatsApp", icon: MessageSquare },
  { value: "EMAIL", label: "E-mail", icon: Mail },
  { value: "REUNIAO", label: "Reunião", icon: Calendar },
  { value: "VISITA", label: "Visita", icon: MapPin },
  { value: "OUTRO", label: "Outro", icon: MoreHorizontal },
];

const OUTCOME_OPTIONS: { value: FollowupOutcome; label: string; color: string }[] = [
  { value: "ATENDEU", label: "Atendeu", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { value: "REAGENDOU", label: "Reagendou", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "RECADO", label: "Recado", color: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "NAO_ATENDEU", label: "Não atendeu", color: "bg-slate-100 text-slate-700 border-slate-300" },
  { value: "SEM_RESPOSTA", label: "Sem resposta", color: "bg-slate-100 text-slate-700 border-slate-300" },
  { value: "DESISTIU", label: "Desistiu", color: "bg-red-100 text-red-700 border-red-300" },
];

export function RegisterFollowupDialog({
  leadId,
  leadName,
  triggerLabel = "Registrar Follow-up",
  triggerVariant = "default",
}: {
  leadId: string;
  leadName?: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const nowIso = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "LIGACAO",
      outcome: "ATENDEU",
      notes: "",
      occurredAt: nowIso,
      nextAction: "",
    },
  });

  const onSubmit = (data: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await registerFollowupAction({
          leadId,
          type: data.type,
          outcome: data.outcome,
          notes: data.notes || undefined,
          occurredAt: data.occurredAt ? new Date(data.occurredAt).toISOString() : undefined,
          nextAction: data.nextAction ? new Date(data.nextAction).toISOString() : undefined,
        });
        setOpen(false);
        form.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao registrar");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerLabel ? "default" : "icon"} title={triggerLabel || "Registrar Follow-up"}>
          <Phone className={triggerLabel ? "mr-2 h-4 w-4" : "h-4 w-4"} />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Follow-up</DialogTitle>
          <DialogDescription>
            {leadName ? `Lead: ${leadName}` : "Anotação de contato proativo"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Tipo */}
          <div>
            <Label>Canal de contato</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = form.watch("type") === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => form.setValue("type", opt.value)}
                    className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                      selected
                        ? "border-direta-orange bg-direta-orange/10 text-direta-orange"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Outcome */}
          <div>
            <Label>Resultado</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {OUTCOME_OPTIONS.map((opt) => {
                const selected = form.watch("outcome") === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => form.setValue("outcome", opt.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selected ? opt.color + " ring-2 ring-offset-1 ring-direta-orange" : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Data/hora do contato */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="occurredAt">Quando aconteceu</Label>
              <Input
                id="occurredAt"
                type="datetime-local"
                {...form.register("occurredAt")}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="nextAction">Próximo contato</Label>
              <Input
                id="nextAction"
                type="datetime-local"
                {...form.register("nextAction")}
                className="mt-1"
              />
              <p className="mt-1 text-[10px] text-slate-500">Opcional — gera alerta</p>
            </div>
          </div>

          {/* Notas */}
          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="O que foi conversado, próximos passos..."
              rows={3}
              {...form.register("notes")}
              className="mt-1"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
