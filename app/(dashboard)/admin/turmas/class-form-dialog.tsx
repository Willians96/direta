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
  createClassAction,
  updateClassAction,
  type ActionState,
} from "@/lib/actions/classes";

const DAYS = [
  { value: "SEG", label: "Segunda" },
  { value: "TER", label: "Terça" },
  { value: "QUA", label: "Quarta" },
  { value: "QUI", label: "Quinta" },
  { value: "SEX", label: "Sexta" },
  { value: "SAB", label: "Sábado" },
  { value: "DOM", label: "Domingo" },
];

const classSchema = z.object({
  courseId: z.string().min(1, "Curso obrigatório"),
  name: z.string().min(2, "Nome obrigatório"),
  code: z.string().optional(),
  startDate: z.string().min(1, "Data de início obrigatória"),
  endDate: z.string().optional(),
  maxStudents: z.coerce.number().int().positive("Lotação > 0"),
  professorId: z.string().optional(),
  status: z.enum(["ABERTA", "EM_ANDAMENTO", "ENCERRADA", "CANCELADA"]),
  notes: z.string().max(500).optional(),
});

type FormData = z.infer<typeof classSchema>;

interface ClassFormDialogProps {
  courses: Array<{ id: string; name: string }>;
  professors: Array<{ id: string; name: string; role: string }>;
  cls?: {
    id: string;
    courseId: string;
    name: string;
    code: string | null;
    schedule: any;
    startDate: Date;
    endDate: Date | null;
    maxStudents: number;
    professorId: string | null;
    status: string;
    notes: string | null;
  };
}

export function ClassFormDialog({ courses, professors, cls }: ClassFormDialogProps) {
  const isEdit = !!cls;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedDays, setSelectedDays] = useState<string[]>(
    (cls?.schedule?.days as string[]) ?? []
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(classSchema),
    defaultValues: isEdit
      ? {
          courseId: cls!.courseId,
          name: cls!.name,
          code: cls!.code ?? "",
          startDate: cls!.startDate.toISOString().slice(0, 10),
          endDate: cls!.endDate?.toISOString().slice(0, 10) ?? "",
          maxStudents: cls!.maxStudents,
          professorId: cls!.professorId ?? "",
          status: cls!.status as any,
          notes: cls!.notes ?? "",
        }
      : {
          courseId: courses[0]?.id ?? "",
          name: "",
          code: "",
          startDate: "",
          endDate: "",
          maxStudents: 30,
          professorId: "",
          status: "ABERTA",
          notes: "",
        },
  });

  const courseId = watch("courseId");
  const status = watch("status");

  useEffect(() => {
    if (!open) {
      reset();
      setSelectedDays(cls?.schedule?.days ?? []);
    }
  }, [open, reset, cls]);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const onSubmit = handleSubmit((data) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
    });
    selectedDays.forEach((d) => fd.append("scheduleDays", d));
    if (data.courseId) {
      const scheduleTime = (document.getElementById("scheduleTime") as HTMLInputElement)
        ?.value;
      if (scheduleTime) fd.append("scheduleTime", scheduleTime);
    }

    startTransition(async () => {
      const action = isEdit
        ? updateClassAction(cls!.id, {} as ActionState, fd)
        : createClassAction({} as ActionState, fd);
      const result = await action;

      if (result.ok) {
        toast.success(result.message ?? "Salvo!");
        setOpen(false);
        reset();
        setSelectedDays([]);
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
            Nova turma
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar turma" : "Nova turma"}
          </DialogTitle>
          <DialogDescription>
            Cadastre uma turma com horários, professor e lotação.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Nome da turma</Label>
              <Input
                id="name"
                placeholder="Ex: Turma manhã - Outubro"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                placeholder="Ex: SOL-2026-1"
                {...register("code")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Curso</Label>
            <Select
              value={courseId}
              onValueChange={(v) => setValue("courseId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um curso" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.courseId && (
              <p className="text-xs text-red-500">{errors.courseId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Início</Label>
              <Input id="startDate" type="date" {...register("startDate")} />
              {errors.startDate && (
                <p className="text-xs text-red-500">{errors.startDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Fim (opcional)</Label>
              <Input id="endDate" type="date" {...register("endDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxStudents">Lotação (vagas)</Label>
              <Input
                id="maxStudents"
                type="number"
                min="1"
                {...register("maxStudents")}
              />
              {errors.maxStudents && (
                <p className="text-xs text-red-500">
                  {errors.maxStudents.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dias da semana</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const active = selectedDays.includes(day.value);
                return (
                  <button
                    type="button"
                    key={day.value}
                    onClick={() => toggleDay(day.value)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "border-direta-orange bg-direta-orange text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="scheduleTime">Horário</Label>
              <Input
                id="scheduleTime"
                placeholder="Ex: 19h-22h"
                defaultValue={(cls?.schedule?.time as string) ?? ""}
              />
              <p className="text-xs text-slate-500">Texto livre (ex: "19h às 22h")</p>
            </div>
            <div className="space-y-2">
              <Label>Professor</Label>
              <Select
                value={watch("professorId") || "_none"}
                onValueChange={(v) =>
                  setValue("professorId", v === "_none" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Sem professor —</SelectItem>
                  {professors.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                <SelectItem value="ABERTA">Aberta</SelectItem>
                <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                <SelectItem value="ENCERRADA">Encerrada</SelectItem>
                <SelectItem value="CANCELADA">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Criar turma"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
