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

interface CourseFormDialogProps {
  course?: {
    id: string;
    name: string;
    description: string | null;
    workloadHours: number;
    price: any;
    syllabus: string | null;
    status: string;
  };
}

export function CourseFormDialog({ course }: CourseFormDialogProps) {
  const isEdit = !!course;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

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
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = handleSubmit((data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null) formData.append(k, String(v));
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar curso" : "Novo curso"}</DialogTitle>
          <DialogDescription>
            Cadastre um curso no catálogo com carga horária e preço.
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
              onValueChange={(v) => setValue("status", v as "ATIVO" | "INATIVO" | "EM_BREVE")}
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
