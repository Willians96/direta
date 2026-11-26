import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

const credentialsSchema = z.object({
  // A cliente pediu que o colaborador entre com "login e senha". Aceitamos
  // o e-mail OU o código do cadastro (ex.: 000879) — os dois funcionam.
  // O campo `email` continua sendo aceito porque é o que os scripts de
  // validação (curl) já enviam para /api/auth/callback/credentials.
  login: z.string().min(1).max(160).optional(),
  email: z.string().min(1).max(160).optional(),
  password: z.string().min(6),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Necessário em deploy serverless (Vercel) — sem isso, Auth.js bloqueia com UntrustedHost
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8h
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        login: { label: "E-mail ou código", type: "text" },
        email: { label: "E-mail", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { password } = parsed.data;
        const login = (parsed.data.login || parsed.data.email || "").trim();
        if (!login) return null;

        // Login por e-mail OU por código do colaborador.
        const user = await prisma.user.findFirst({
          where: { OR: [{ email: login }, { code: login }] },
        });
        if (!user || user.status !== "ATIVO") return null;

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) return null;

        // Atualiza último login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role as UserRole;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as UserRole;
      }
      return session;
    },
  },
});
