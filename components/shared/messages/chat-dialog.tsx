"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  MessageCircle,
  Send,
  Inbox,
  StickyNote,
  Phone,
  Mail,
  Calendar,
  User,
  MapPin,
  MoreHorizontal,
  ExternalLink,
} from "lucide-react";
import { MessageChannel, MessageDirection } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { logLeadMessageAction } from "@/lib/actions/messages";
import { formatDateTime } from "@/lib/utils";

const schema = z.object({
  channel: z.nativeEnum(MessageChannel),
  direction: z.nativeEnum(MessageDirection),
  content: z.string().min(1, "Conteúdo obrigatório").max(5000),
});

type FormData = z.infer<typeof schema>;

const CHANNEL_OPTIONS: { value: MessageChannel; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { value: "WHATSAPP", label: "WhatsApp", icon: MessageCircle, color: "bg-emerald-500" },
  { value: "LIGACAO", label: "Ligação", icon: Phone, color: "bg-blue-500" },
  { value: "EMAIL", label: "E-mail", icon: Mail, color: "bg-amber-500" },
  { value: "REUNIAO", label: "Reunião", icon: Calendar, color: "bg-purple-500" },
  { value: "PRESENCIAL", label: "Presencial", icon: MapPin, color: "bg-pink-500" },
  { value: "OUTRO", label: "Outro", icon: MoreHorizontal, color: "bg-slate-500" },
];

const DIRECTION_OPTIONS: { value: MessageDirection; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { value: "OUTBOUND", label: "Enviada", icon: Send, color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { value: "INBOUND", label: "Recebida", icon: Inbox, color: "bg-sky-100 text-sky-700 border-sky-300" },
  { value: "INTERNAL", label: "Nota interna", icon: StickyNote, color: "bg-slate-100 text-slate-700 border-slate-300" },
];

export type ChatMessage = {
  id: string;
  channel: MessageChannel;
  direction: MessageDirection;
  content: string;
  occurredAt: Date;
  user: { id: string; name: string; role: string };
};

export function ChatDialog({
  leadId,
  leadName,
  leadPhone,
  initialMessages,
  triggerLabel = "Abrir WhatsApp",
  triggerVariant = "default",
  triggerIconOnly = false,
}: {
  leadId: string;
  leadName: string;
  leadPhone: string;
  initialMessages: ChatMessage[];
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
  triggerIconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const scrollRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      channel: "WHATSAPP",
      direction: "OUTBOUND",
      content: "",
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const onSubmit = (data: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await logLeadMessageAction({
          leadId,
          channel: data.channel,
          direction: data.direction,
          content: data.content,
        });
        // Adiciona localmente para feedback imediato
        setMessages((prev) => [
          ...prev,
          {
            id: res.id,
            channel: data.channel,
            direction: data.direction,
            content: data.content,
            occurredAt: new Date(),
            user: { id: "me", name: "Você", role: "VENDAS" },
          },
        ]);
        form.reset({ channel: data.channel, direction: data.direction, content: "" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao registrar");
      }
    });
  };

  // Quick action: registrar mensagem pré-preenchida
  const quickLog = (channel: MessageChannel, direction: MessageDirection, content: string) => {
    form.setValue("channel", channel);
    form.setValue("direction", direction);
    form.setValue("content", content);
  };

  const waLink = `https://wa.me/55${leadPhone.replace(/\D/g, "")}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerIconOnly ? "icon" : "default"}>
          <MessageCircle className={triggerIconOnly ? "h-4 w-4" : "mr-2 h-4 w-4"} />
          {!triggerIconOnly && (triggerLabel || "Conversar")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            Conversa · {leadName}
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs">{leadPhone}</span>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-3 inline-flex items-center gap-1 text-emerald-600 hover:underline"
            >
              Abrir WhatsApp <ExternalLink className="h-3 w-3" />
            </a>
          </DialogDescription>
        </DialogHeader>

        {/* Timeline de mensagens */}
        <div
          ref={scrollRef}
          className="max-h-80 min-h-32 space-y-2 overflow-y-auto rounded-md border bg-slate-50 p-3"
        >
          {messages.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-slate-400">
              Nenhuma mensagem registrada. Use os botões rápidos abaixo para começar.
            </div>
          ) : (
            messages.map((m) => {
              const isOutbound = m.direction === "OUTBOUND";
              const isInternal = m.direction === "INTERNAL";
              const ch = CHANNEL_OPTIONS.find((c) => c.value === m.channel);
              const dir = DIRECTION_OPTIONS.find((d) => d.value === m.direction);
              const Icon = ch?.icon ?? MessageCircle;
              return (
                <div
                  key={m.id}
                  className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg border p-2 ${
                      isInternal
                        ? "border-slate-300 bg-slate-100"
                        : isOutbound
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-sky-200 bg-white"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2 text-[10px] text-slate-500">
                      <Icon className="h-3 w-3" />
                      <span className="font-medium">{ch?.label}</span>
                      <span>·</span>
                      <span>{dir?.label}</span>
                      <span>·</span>
                      <span>{formatDateTime(m.occurredAt)}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-slate-800">
                      {m.content}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">por {m.user.name}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick actions */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Ações rápidas
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => quickLog("WHATSAPP", "OUTBOUND", "Enviei mensagem via WhatsApp:")}
            >
              <Send className="mr-1 h-3 w-3" /> WhatsApp enviada
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => quickLog("WHATSAPP", "INBOUND", "Lead respondeu no WhatsApp:")}
            >
              <Inbox className="mr-1 h-3 w-3" /> WhatsApp recebida
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => quickLog("LIGACAO", "OUTBOUND", "Liguei para o lead. Resumo:")}
            >
              <Phone className="mr-1 h-3 w-3" /> Ligação feita
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => quickLog("LIGACAO", "INBOUND", "Lead me ligou. Assunto:")}
            >
              <Phone className="mr-1 h-3 w-3" /> Lead ligou
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => quickLog("OUTRO", "INTERNAL", "Anotação interna:")}
            >
              <StickyNote className="mr-1 h-3 w-3" /> Nota interna
            </Button>
          </div>
        </div>

        {/* Form de registro */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 border-t pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Canal</Label>
              <select
                {...form.register("channel")}
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
              >
                {CHANNEL_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Direção</Label>
              <select
                {...form.register("direction")}
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
              >
                {DIRECTION_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="content" className="text-xs">
              Conteúdo da mensagem
            </Label>
            <Textarea
              id="content"
              rows={3}
              placeholder="Descreva a mensagem ou o que foi conversado..."
              {...form.register("content")}
              className="mt-1"
            />
            {form.formState.errors.content && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.content.message}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Fechar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Registrar mensagem"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
