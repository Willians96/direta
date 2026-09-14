import { NextResponse } from "next/server";

// Rota TEMPORÁRIA para debug — remove após login funcionar
export const dynamic = "force-dynamic";

function mask(value: string | undefined, visible = 8): string {
  if (!value) return "(vazio)";
  if (value.length <= visible) return `${value.length} chars`;
  return `${value.length} chars: "${value.slice(0, visible)}…"`;
}

export async function GET() {
  const envReport = {
    timestamp: new Date().toISOString(),
    runtime: process.env.NODE_ENV,
    vars: {
      DATABASE_URL: {
        present: !!process.env.DATABASE_URL,
        preview: mask(process.env.DATABASE_URL, 40),
      },
      AUTH_SECRET: {
        present: !!process.env.AUTH_SECRET,
        preview: mask(process.env.AUTH_SECRET, 6),
      },
      AUTH_URL: {
        present: !!process.env.AUTH_URL,
        preview: mask(process.env.AUTH_URL, 30),
      },
      AUTH_TRUST_HOST: {
        present: !!process.env.AUTH_TRUST_HOST,
        value: process.env.AUTH_TRUST_HOST ?? "(vazio)",
      },
    },
  };
  return NextResponse.json(envReport);
}
