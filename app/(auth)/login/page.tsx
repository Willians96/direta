"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shared/logo";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-direta-orange" />
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      toast.error("Credenciais inválidas", {
        description: "Verifique seu e-mail e senha.",
      });
      setLoading(false);
      return;
    }

    toast.success("Bem-vindo!");
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Lado esquerdo — branding Direta */}
      <div className="relative hidden flex-col justify-between p-10 text-white lg:flex overflow-hidden">
        {/* Fundo: laranja Direta com gradiente escuro industrial */}
        <div className="absolute inset-0 bg-gradient-to-br from-direta-orange via-direta-orange-dark to-direta-blue-dark" />
        {/* Padrão industrial sutil (linhas diagonais) */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(255,255,255,.3) 30px, rgba(255,255,255,.3) 31px)",
          }}
        />

        <div className="relative z-10">
          {/* Logo branco sobre fundo colorido */}
          <div className="bg-white/95 backdrop-blur p-4 rounded-xl inline-block">
            <Logo variant="full" theme="light" size="lg" />
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <blockquote className="space-y-2">
            <p className="text-2xl font-medium leading-tight">
              "O caminho mais rápido para ingressar no mercado de trabalho e dar um UP na sua carreira."
            </p>
            <footer className="text-sm text-white/80">
              +16.000 alunos qualificados · Sorocaba · Itapetininga · Jundiaí
            </footer>
          </blockquote>

          <div className="grid grid-cols-2 gap-3 pt-6">
            {[
              { label: "Captação", desc: "Leads qualificados" },
              { label: "Vendas", desc: "Funil e fechamento" },
              { label: "Recepção", desc: "Análise documental" },
              { label: "Admin", desc: "Visão consolidada" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-white/20 bg-white/10 backdrop-blur p-3"
              >
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="text-[11px] text-white/80">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-white/70">
          © {new Date().getFullYear()} Direta Cursos Industriais e Preparatórios LTDA
        </div>
      </div>

      {/* Lado direito — formulário */}
      <div className="flex items-center justify-center bg-white p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-6">
          {/* Logo mobile */}
          <div className="lg:hidden">
            <Logo variant="full" theme="light" size="md" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Acessar conta</h1>
            <p className="text-sm text-slate-500">
              Use suas credenciais corporativas para entrar no sistema.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <a
                  href="/forgot-password"
                  className="text-xs text-direta-orange hover:underline"
                >
                  Esqueceu?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="rounded-md border border-dashed border-direta-orange/30 bg-direta-orange/5 p-3 text-xs text-slate-700">
            <div className="font-semibold text-direta-orange-dark mb-1">
              🔐 Acesso de demonstração:
            </div>
            <ul className="space-y-0.5 font-mono">
              <li>admin@direta.com · admin123</li>
              <li>captacao@direta.com · captacao123</li>
              <li>vendas@direta.com · vendas123</li>
              <li>recepcao@direta.com · recepcao123</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
