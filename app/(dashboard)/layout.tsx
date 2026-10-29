import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import type { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = {
    name: session.user.name || "Usuário",
    email: session.user.email || "",
    role: (session.user as any).role as UserRole,
  };

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
