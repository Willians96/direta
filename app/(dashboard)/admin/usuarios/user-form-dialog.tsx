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
  createUserAction,
  updateUserAction,
  type ActionState,
} from "@/lib/actions/users";

const createSchema = z.object({
  fullName: z.string().min(3, "Mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  role: z.enum(["ADMIN", "CAPTACAO", "VENDAS", "RECEPCAO"]),
  phone: z.string().optional(),
});

const updateSchema = z.object({
  fullName: z.string().min(3, "Mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  role: z.enum(["ADMIN", "CAPTACAO", "VENDAS", "RECEPCAO"]),
  phone: z.string().optional(),
  status: z.enum(["ATIVO", "INATIVO"]),
});

type UserFormData = z.infer<typeof createSchema> | z.infer<typeof updateSchema>;

interface UserFormDialogProps {
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    phone: string | null;
    status: string;
  };
}

export function UserFormDialog({ user }: UserFormDialogProps) {
  const isEdit = !!user;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(isEdit ? updateSchema : createSchema),
    defaultValues: isEdit
      ? {
          fullName: user.name,
          email: user.email,
          role: user.role as any,
          phone: user.phone ?? "",
          status: user.status as any,
        }
      : {
          fullName: "",
          email: "",
          password: "",
          role: "VENDAS",
          phone: "",
        },
  });

  const role = watch("role");
  const status = watch("status");

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const onSubmit = handleSubmit((data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null) formData.append(k, String(v));
    });

    startTransition(async () => {
      const action = isEdit
        ? updateUserAction(user!.id, {} as ActionState, formData)
        : createUserAction({} as ActionState, formData);
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
            Novo usuário
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados do usuário."
              : "Crie um novo usuário com acesso ao sistema."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" {...register("fullName")} />
            {errors.fullName && (
              <p className="text-xs text-red-500">{errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="password">Senha inicial</Label>
              <Input
                id="password"
                type="password"
                placeholder="mínimo 6 caracteres"
                {...register("password" as any)}
              />
              {(errors as any).password && (
                <p className="text-xs text-red-500">{(errors as any).password.message}</p>
              )}
              <p className="text-xs text-slate-500">
                O usuário poderá trocar depois no perfil.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select
                value={role}
                onValueChange={(v) => setValue("role", v as "ADMIN" | "CAPTACAO" | "VENDAS" | "RECEPCAO")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="CAPTACAO">Captação</SelectItem>
                  <SelectItem value="VENDAS">Vendas</SelectItem>
                  <SelectItem value="RECEPCAO">Recepção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isEdit && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setValue("status", v as "ATIVO" | "INATIVO")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="INATIVO">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone (opcional)</Label>
            <Input id="phone" placeholder="(15) 99999-9999" {...register("phone")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Criar usuário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
