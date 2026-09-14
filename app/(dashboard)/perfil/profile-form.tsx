"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Save, Lock, User } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  updateProfileAction,
  changePasswordAction,
  type ActionState,
} from "@/lib/actions/profile";

const profileSchema = z.object({
  fullName: z.string().min(3, "Mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual obrigatória"),
    newPassword: z.string().min(6, "Mínimo 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });

interface ProfileFormProps {
  user: {
    name: string;
    email: string;
    phone: string | null;
    role: string;
  };
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  CAPTACAO: "Captação",
  VENDAS: "Vendas",
  RECEPCAO: "Recepção",
};

export function ProfileForm({ user }: ProfileFormProps) {
  const [pendingProfile, startProfile] = useTransition();
  const [pendingPass, startPass] = useTransition();

  const {
    register: registerProfile,
    handleSubmit: handleProfile,
    formState: { errors: errorsProfile },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user.name,
      email: user.email,
      phone: user.phone ?? "",
    },
  });

  const {
    register: registerPass,
    handleSubmit: handlePass,
    reset: resetPass,
    formState: { errors: errorsPass },
  } = useForm({
    resolver: zodResolver(passwordSchema),
  });

  const onProfile = handleProfile((data) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
    });

    startProfile(async () => {
      const r = await updateProfileAction({} as ActionState, fd);
      if (r.ok) toast.success(r.message ?? "Salvo!");
      else toast.error(r.error ?? "Erro");
    });
  });

  const onPassword = handlePass((data) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => fd.append(k, String(v)));

    startPass(async () => {
      const r = await changePasswordAction({} as ActionState, fd);
      if (r.ok) {
        toast.success(r.message ?? "Senha trocada!");
        resetPass();
      } else toast.error(r.error ?? "Erro");
    });
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Dados pessoais
          </CardTitle>
          <CardDescription>
            Atualize seu nome, e-mail e telefone
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input id="fullName" {...registerProfile("fullName")} />
                {errorsProfile.fullName && (
                  <p className="text-xs text-red-500">
                    {String(errorsProfile.fullName.message ?? "")}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" {...registerProfile("email")} />
                {errorsProfile.email && (
                  <p className="text-xs text-red-500">
                    {String(errorsProfile.email.message ?? "")}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(15) 99999-9999"
                  {...registerProfile("phone")}
                />
              </div>
              <div className="space-y-2">
                <Label>Perfil</Label>
                <div className="flex h-10 items-center rounded-md border bg-slate-50 px-3 text-sm">
                  <BadgeDot role={user.role} />
                  <span className="ml-2">{ROLE_LABELS[user.role]}</span>
                  <span className="ml-auto text-xs text-slate-500">
                    (definido pelo admin)
                  </span>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={pendingProfile}>
                {pendingProfile && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Save className="mr-2 h-4 w-4" />
                Salvar alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Trocar senha
          </CardTitle>
          <CardDescription>
            Escolha uma senha forte (mínimo 6 caracteres)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Senha atual</Label>
              <Input
                id="currentPassword"
                type="password"
                {...registerPass("currentPassword")}
              />
              {errorsPass.currentPassword && (
                <p className="text-xs text-red-500">
                  {String(errorsPass.currentPassword.message ?? "")}
                </p>
              )}
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  {...registerPass("newPassword")}
                />
                {errorsPass.newPassword && (
                  <p className="text-xs text-red-500">
                    {String(errorsPass.newPassword.message ?? "")}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...registerPass("confirmPassword")}
                />
                {errorsPass.confirmPassword && (
                  <p className="text-xs text-red-500">
                    {String(errorsPass.confirmPassword.message ?? "")}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={pendingPass}>
                {pendingPass && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Lock className="mr-2 h-4 w-4" />
                Trocar senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function BadgeDot({ role }: { role: string }) {
  const colors: Record<string, string> = {
    ADMIN: "bg-red-500",
    CAPTACAO: "bg-blue-500",
    VENDAS: "bg-amber-500",
    RECEPCAO: "bg-emerald-500",
  };
  return (
    <span
      className={`h-2 w-2 rounded-full ${colors[role] ?? "bg-slate-400"}`}
    />
  );
}
