"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Cadastro de colaboradores — tela pedida pela cliente com os campos do
 * sistema antigo (código, admissão, documentos, endereço, cargo,
 * observações e "aparecer para efetuar matrícula").
 */
const camposColaborador = {
  code: z.string().max(30).optional().or(z.literal("")),
  admissionDate: z.string().optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  cpf: z.string().max(20).optional().or(z.literal("")),
  rg: z.string().max(20).optional().or(z.literal("")),
  mobile: z.string().max(20).optional().or(z.literal("")),
  jobTitle: z.string().max(80).optional().or(z.literal("")),
  addressStreet: z.string().max(150).optional().or(z.literal("")),
  addressNumber: z.string().max(20).optional().or(z.literal("")),
  addressDistrict: z.string().max(80).optional().or(z.literal("")),
  addressCity: z.string().max(80).optional().or(z.literal("")),
  addressState: z.string().max(2).optional().or(z.literal("")),
  addressZip: z.string().max(12).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  showEnrollment: z.boolean(),
};

const createUserSchema = z.object({
  fullName: z.string().min(3, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  role: z.enum(["ADMIN", "CAPTACAO", "VENDAS", "RECEPCAO"]),
  phone: z.string().optional(),
  ...camposColaborador,
});

const updateUserSchema = z.object({
  fullName: z.string().min(3, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  role: z.enum(["ADMIN", "CAPTACAO", "VENDAS", "RECEPCAO"]),
  phone: z.string().optional(),
  status: z.enum(["ATIVO", "INATIVO"]),
  ...camposColaborador,
});

/** Lê os campos do colaborador do FormData e devolve o formato do Prisma. */
function dadosColaborador(formData: FormData) {
  const data = (campo: string) => {
    const valor = ((formData.get(campo) as string) || "").trim();
    return valor === "" ? null : valor;
  };
  const dataDate = (campo: string) => {
    const valor = ((formData.get(campo) as string) || "").trim();
    return valor ? new Date(valor) : null;
  };

  return {
    code: data("code"),
    admissionDate: dataDate("admissionDate"),
    birthDate: dataDate("birthDate"),
    cpf: data("cpf"),
    rg: data("rg"),
    mobile: data("mobile"),
    jobTitle: data("jobTitle"),
    addressStreet: data("addressStreet"),
    addressNumber: data("addressNumber"),
    addressDistrict: data("addressDistrict"),
    addressCity: data("addressCity"),
    addressState: data("addressState"),
    addressZip: data("addressZip"),
    notes: data("notes"),
    showEnrollment:
      formData.get("showEnrollment") === "on" ||
      formData.get("showEnrollment") === "true",
  };
}

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
      ...dadosColaborador(formData),
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

    // O código do colaborador é único.
    if (parsed.data.code) {
      const outroComMesmoCodigo = await prisma.user.findUnique({
        where: { code: parsed.data.code },
        select: { id: true },
      });
      if (outroComMesmoCodigo) {
        return { ok: false, error: "Já existe um colaborador com esse código." };
      }
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
        code: parsed.data.code || null,
        admissionDate: parsed.data.admissionDate
          ? new Date(parsed.data.admissionDate)
          : null,
        birthDate: parsed.data.birthDate
          ? new Date(parsed.data.birthDate)
          : null,
        cpf: parsed.data.cpf || null,
        rg: parsed.data.rg || null,
        mobile: parsed.data.mobile || null,
        jobTitle: parsed.data.jobTitle || null,
        addressStreet: parsed.data.addressStreet || null,
        addressNumber: parsed.data.addressNumber || null,
        addressDistrict: parsed.data.addressDistrict || null,
        addressCity: parsed.data.addressCity || null,
        addressState: parsed.data.addressState || null,
        addressZip: parsed.data.addressZip || null,
        notes: parsed.data.notes || null,
        showEnrollment: parsed.data.showEnrollment,
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
      ...dadosColaborador(formData),
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

    // Conta protegida (acesso do dono do sistema): fica fora da lista e
    // não aceita mudança de perfil nem de situação.
    if (
      before.protectedAccount &&
      (parsed.data.role !== before.role || parsed.data.status !== before.status)
    ) {
      return {
        ok: false,
        error: "Esta conta é protegida: o perfil e a situação não podem ser alterados.",
      };
    }

    // Não é possível mexer no perfil nem desativar a própria conta: é o
    // acesso de quem está operando — uma troca de senha/perfil errada
    // deixaria o sistema sem administrador.
    if (id === adminId && (parsed.data.role !== before.role || parsed.data.status !== before.status)) {
      return {
        ok: false,
        error: "Você não pode alterar o perfil ou a situação da própria conta.",
      };
    }

    // Não pode ficar sem administrador ativo no sistema.
    const perdeAdmin =
      before.role === "ADMIN" &&
      before.status === "ATIVO" &&
      (parsed.data.role !== "ADMIN" || parsed.data.status !== "ATIVO");
    if (perdeAdmin && !(await existeOutroAdminAtivo(id))) {
      return {
        ok: false,
        error: "Não é possível deixar o sistema sem nenhum administrador ativo.",
      };
    }

    // O código do colaborador é único.
    if (parsed.data.code) {
      const outroComMesmoCodigo = await prisma.user.findUnique({
        where: { code: parsed.data.code },
        select: { id: true },
      });
      if (outroComMesmoCodigo && outroComMesmoCodigo.id !== id) {
        return { ok: false, error: "Já existe um colaborador com esse código." };
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.fullName,
        email: parsed.data.email,
        role: parsed.data.role,
        phone: parsed.data.phone,
        status: parsed.data.status,
        code: parsed.data.code || null,
        admissionDate: parsed.data.admissionDate
          ? new Date(parsed.data.admissionDate)
          : null,
        birthDate: parsed.data.birthDate
          ? new Date(parsed.data.birthDate)
          : null,
        cpf: parsed.data.cpf || null,
        rg: parsed.data.rg || null,
        mobile: parsed.data.mobile || null,
        jobTitle: parsed.data.jobTitle || null,
        addressStreet: parsed.data.addressStreet || null,
        addressNumber: parsed.data.addressNumber || null,
        addressDistrict: parsed.data.addressDistrict || null,
        addressCity: parsed.data.addressCity || null,
        addressState: parsed.data.addressState || null,
        addressZip: parsed.data.addressZip || null,
        notes: parsed.data.notes || null,
        showEnrollment: parsed.data.showEnrollment,
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

/** Existe outro administrador ativo além deste? */
async function existeOutroAdminAtivo(ignorarId: string): Promise<boolean> {
  const outro = await prisma.user.findFirst({
    where: { role: "ADMIN", status: "ATIVO", NOT: { id: ignorarId } },
    select: { id: true },
  });
  return !!outro;
}

export async function toggleUserStatusAction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin();

    // A própria conta não pode ser desativada por engano.
    if (id === adminId) {
      return { ok: false, error: "Você não pode desativar a própria conta." };
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return { ok: false, error: "Usuário não encontrado." };

    // Conta protegida: nunca pode ser desativada nem reativada por engano.
    if (user.protectedAccount) {
      return {
        ok: false,
        error: "Esta conta é protegida e não pode ter a situação alterada.",
      };
    }

    const newStatus = user.status === "ATIVO" ? "INATIVO" : "ATIVO";

    // O sistema não pode ficar sem nenhum administrador ativo.
    if (newStatus === "INATIVO" && user.role === "ADMIN") {
      if (!(await existeOutroAdminAtivo(id))) {
        return {
          ok: false,
          error: "Não é possível deixar o sistema sem nenhum administrador ativo.",
        };
      }
    }

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
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
