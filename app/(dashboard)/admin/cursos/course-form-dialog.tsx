"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, CreditCard, X } from "lucide-react";
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
  createCourseAction,
  updateCourseAction,
  type ActionState,
} from "@/lib/actions/courses";

const courseSchema = z.object({
  name: z.string().min(3, "Mínimo 3 caracteres"),
  description: z.string().optional(),
  workloadHours: z.coerce.number().int().positive("Carga horária > 0"),
  price: z.coerce.number().positive("Preço > 0"),
  syllabus: z.string().optional(),
  status: z.enum(["ATIVO", "INATIVO", "EM_BREVE"]),
});

type CourseFormData = z.infer<typeof courseSchema>;

interface PaymentMethod {
  method: string;
  details?: string | null;
}

interface CourseFormDialogProps {
  course?: {
    id: string;
    name: string;
    description: string | null;
    workloadHours: number;
    price: any;
    syllabus: string | null;
    status: string;
    paymentMethods?: PaymentMethod[];
  };
}

const PAYMENT_OPTIONS = [
  { value: "PIX", label: "PIX" },
  { value: "BOLETO", label: "Boleto" },
  { value: "CARTAO_CREDITO", label: "Cartão de Crédito" },
  { value: "CARTAO_DEBITO", label: "Cartão de Débito" },
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "TRANSFERENCIA", label: "Transferência" },
  { value: "PARCELADO_PROPRIO", label: "Parcelado Próprio" },
  { value: "OUTRO", label: "Outro" },
];

export function CourseFormDialog({ course }: CourseFormDialogProps) {
  const isEdit = !!course;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(
    course?.paymentMethods ?? []
  );
  const [newMethod, setNewMethod] = useState<string>("");
  const [newDetails, setNewDetails] = useState<string>("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: isEdit
      ? {
          name: course.name,
          description: course.description ?? "",
          workloadHours: course.workloadHours,
          price: Number(course.price),
          syllabus: course.syllabus ?? "",
          status: course.status as any,
        }
      : {
          name: "",
          description: "",
          workloadHours: 40,
          price: 500,
          syllabus: "",
          status: "ATIVO",
        },
  });

  const status = watch("status");

  useEffect(() => {
    if (!open) {
      reset();
      setPaymentMethods(course?.paymentMethods ?? []);
    }
  }, [open, reset, course]);

  const addPaymentMethod = () => {
    if (!newMethod) return;
    if (paymentMethods.some((p) => p.method === newMethod)) {
      toast.error("Forma de pagamento já adicionada");
      return;
    }
    setPaymentMethods([
      ...paymentMethods,
      { method: newMethod, details: newDetails || undefined },
    ]);
    setNewMethod("");
    setNewDetails("");
  };

  const removePaymentMethod = (method: string) => {
    setPaymentMethods(paymentMethods.filter((p) => p.method !== method));
  };

  const onSubmit = handleSubmit((data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") formData.append(k, String(v));
    });
    // Adiciona payment methods
    paymentMethods.forEach((p) => {
      formData.append("paymentMethod", p.method);
      if (p.details) formData.append("paymentDetails", p.details);
    });

    startTransition(async () => {
      const action = isEdit
        ? updateCourseAction(course!.id, {} as ActionState, formData)
        : createCourseAction({} as ActionState, formData);
      const result = await action;

      if (result.ok) {
        toast.success(result.message ?? "Salvo!");
        setOpen(false);
        reset();
        setPaymentMethods([]);
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
            Novo curso
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar curso" : "Novo curso"}</DialogTitle>
          <DialogDescription>
            Cadastre um curso com carga horária, preço e formas de pagamento.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do curso</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="Resumo do curso..."
              {...register("description")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="workloadHours">Carga horária (h)</Label>
              <Input
                id="workloadHours"
                type="number"
                {...register("workloadHours")}
              />
              {errors.workloadHours && (
                <p className="text-xs text-red-500">{errors.workloadHours.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                {...register("price")}
              />
              {errors.price && (
                <p className="text-xs text-red-500">{errors.price.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="syllabus">Ementa (opcional)</Label>
            <Textarea
              id="syllabus"
              rows={3}
              placeholder="Tópicos que serão abordados..."
              {...register("syllabus")}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setValue("status", v as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ATIVO">Ativo</SelectItem>
                <SelectItem value="EM_BREVE">Em breve</SelectItem>
                <SelectItem value="INATIVO">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* FORMAS DE PAGAMENTO */}
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <Label className="flex items-center gap-1.5">
              <CreditCard className="h-4 w-4" />
              Formas de pagamento
            </Label>

            {paymentMethods.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {paymentMethods.map((p) => {
                  const opt = PAYMENT_OPTIONS.find((o) => o.value === p.method);
                  return (
                    <div
                      key={p.method}
                      className="flex items-center gap-1.5 rounded-full border border-direta-orange/30 bg-direta-orange/10 px-3 py-1 text-xs"
                    >
                      <span className="font-medium text-direta-orange-dark">
                        {opt?.label ?? p.method}
                      </span>
                      {p.details && (
                        <span className="text-slate-600">· {p.details}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removePaymentMethod(p.method)}
                        className="ml-1 text-slate-400 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              <Select value={newMethod} onValueChange={setNewMethod}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Adicionar forma..." />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_OPTIONS.filter(
                    (o) => !paymentMethods.some((p) => p.method === o.value)
                  ).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Detalhe (ex: 3x sem juros)"
                value={newDetails}
                onChange={(e) => setNewDetails(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addPaymentMethod}
                disabled={!newMethod}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Criar curso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
