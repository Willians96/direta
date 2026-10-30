import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Mapa de permissões: rota → roles permitidas
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  "/admin": ["ADMIN"],
  "/captacao": ["ADMIN", "CAPTACAO"],
  "/vendas": ["ADMIN", "VENDAS"],
  "/recepcao": ["ADMIN", "RECEPCAO"],
  "/alunos": ["ADMIN", "RECEPCAO"],
};

// Arquivos estáticos (imagens, ícones, fontes) nunca devem passar pelo
// middleware. Sem esta exceção o otimizador do Next (/_next/image) e os
// arquivos de /public são respondidos com um redirect para /login —
// foi o que quebrou o logo na tela de login.
const STATIC_FILE = /\.(?:png|jpe?g|gif|webp|svg|ico|bmp|woff2?|ttf|eot|css|js|map)$/i;

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const pathname = nextUrl.pathname;

  // Rotas públicas
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname === "/" ||
    STATIC_FILE.test(pathname);

  if (isPublic) return NextResponse.next();

  // Não autenticado → /login
  if (!session?.user) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = (session.user as any).role as string;

  // Identifica a área (admin / captacao / vendas / recepcao)
  const area = Object.keys(ROUTE_PERMISSIONS).find((p) => pathname.startsWith(p));
  if (area) {
    const allowed = ROUTE_PERMISSIONS[area];
    if (!allowed.includes(role)) {
      // Redireciona para a área do próprio perfil
      return NextResponse.redirect(new URL(`/${role.toLowerCase()}`, nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|webp|svg|ico|bmp|woff2?|ttf|eot|css|js|map)$).*)",
  ],
};
