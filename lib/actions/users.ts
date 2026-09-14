"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const createUserSchema = z.object({
  fullName: z.string().min(3, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  role: z.enum(["ADMIN", "CAPTACAO", "VENDAS", "RECEPCAO"]),
  phone: z.string().optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(3, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  role: z.enum(["ADMIN", "CAPTACAO", "VENDAS", "RECEPCAO"]),
  phone: z.string().optional(),
  status: z.enum(["ATIVO", "INATIVO"]),
});

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") {
    throw new Error("Acesso negado: apenas administradores.");
  }
  const adminId = (session?.user as any)?.id as string;
  return adminId;
}

export async function createUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const adminId = await requireAdmin();

    const data = {
      fullName: formData.get("fullName") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      role: formData.get("role") as string,
      phone: (formData.get("phone") as string) || undefined,
    };

    const parsed = createUserSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }

    const exists = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (exists) {
      return { ok: false, error: "E-mail já cadastrado." };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: parsed.data.fullName,
        email: parsed.data.email,
        passwordHash,
        role: parsed.data.role,
        phone: parsed.data.phone,
        status: "ATIVO",
      },
    });

    await prisma.enrollmentAudit.create({
      data: {
        action: "USER_CREATED",
        actorId: adminId,
        targetType: "User",
        targetId: user.id,
        details: `${user.name} (${user.role})`,
      },
    });

    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Usuário criado com sucesso!" };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao criar usuário." };
  }
}

export async function updateUserAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const adminId = await requireAdmin();

    const data = {
      fullName: formData.get("fullName") as string,
      email: formData.get("email") as string,
      role: formData.get("role") as string,
      phone: (formData.get("phone") as string) || undefined,
      status: formData.get("status") as string,
    };

    const parsed = updateUserSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }

    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) return { ok: false, error: "Usuário não encontrado." };

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.fullName,
        email: parsed.data.email,
        role: parsed.data.role,
        phone: parsed.data.phone,
        status: parsed.data.status,
      },
    });

    if (before.status === "ATIVO" && parsed.data.status === "INATIVO") {
      await prisma.enrollmentAudit.create({
        data: {
          action: "USER_DEACTIVATED",
          actorId: adminId,
          targetType: "User",
          targetId: user.id,
          details: user.name,
        },
      });
    } else {
      await prisma.enrollmentAudit.create({
        data: {
          action: "USER_UPDATED",
          actorId: adminId,
          targetType: "User",
          targetId: user.id,
          details: `Atualizou: ${user.name}`,
        },
      });
    }

    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Usuário atualizado!" };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro ao atualizar usuário." };
  }
}

export async function toggleUserStatusAction(id: string): Promise<void> {
  const adminId = await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return;

  const newStatus = user.status === "ATIVO" ? "INATIVO" : "ATIVO";
  await prisma.user.update({
    where: { id },
    data: { status: newStatus },
  });

  await prisma.enrollmentAudit.create({
    data: {
      action: newStatus === "INATIVO" ? "USER_DEACTIVATED" : "USER_UPDATED",
      actorId: adminId,
      targetType: "User",
      targetId: id,
      details: user.name,
    },
  });

  revalidatePath("/admin/usuarios");
}
