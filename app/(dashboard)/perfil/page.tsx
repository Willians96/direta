import { redirect } from "next/navigation";
import { User } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  if (!user) redirect("/login");

  return (
    <div>
      <PageHeader
        title="Meu Perfil"
        description="Atualize seus dados e senha"
        icon={User}
      />

      <div className="p-4 md:p-6 max-w-3xl">
        <ProfileForm user={user} />

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p>
            <span className="font-medium">Conta criada em:</span>{" "}
            {user.createdAt.toLocaleDateString("pt-BR")}
          </p>
          <p>
            <span className="font-medium">Último acesso:</span>{" "}
            {user.lastLoginAt
              ? user.lastLoginAt.toLocaleString("pt-BR")
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
