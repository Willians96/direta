"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const updateProfileSchema = z.object({
  fullName: z.string().min(3, "Mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual obrigatória"),
    newPassword: z.string().min(6, "Nova senha: mínimo 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "Não autenticado." };

    const userId = (session.user as any).id as string;

    const data = {
      fullName: formData.get("fullName") as string,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || undefined,
    };

    const parsed = updateProfileSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }

    const exists = await prisma.user.findFirst({
      where: { email: parsed.data.email, NOT: { id: userId } },
    });
    if (exists) {
      return { ok: false, error: "E-mail já está em uso por outro usuário." };
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        name: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone,
      },
    });

    revalidatePath("/perfil");
    return { ok: true, message: "Perfil atualizado!" };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao atualizar perfil." };
  }
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "Não autenticado." };

    const userId = (session.user as any).id as string;

    const data = {
      currentPassword: formData.get("currentPassword") as string,
      newPassword: formData.get("newPassword") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const parsed = changePasswordSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { ok: false, error: "Usuário não encontrado." };

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return { ok: false, error: "Senha atual incorreta." };
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { ok: true, message: "Senha alterada com sucesso!" };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao trocar senha." };
  }
}
