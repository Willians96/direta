import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStudents, SITUACAO_LABELS } from "@/lib/alunos";

export const dynamic = "force-dynamic";

/**
 * Exporta a lista de alunos em CSV (separador ";" — padrão do Excel em pt-BR).
 * Mesmos filtros da tela /alunos.
 */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }
  if (role !== "ADMIN" && role !== "RECEPCAO") {
    return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
  }

  const p = req.nextUrl.searchParams;
  const { rows, kpis } = await getStudents({
    q: p.get("q") || undefined,
    courseId: p.get("courseId") || undefined,
    classId: p.get("classId") || undefined,
    situacao: p.get("situacao") || undefined,
  });

  const linhas: string[] = [];
  linhas.push("CADASTRO DE ALUNOS - Direta Cursos");
  linhas.push(
    `Gerado em;${new Date().toLocaleString("pt-BR")}`
  );
  linhas.push(
    `Alunos;${kpis.total};Ativos;${kpis.ativos};Concluidos;${kpis.concluidos};Trancados;${kpis.trancados};Sem turma;${kpis.semTurma}`
  );
  linhas.push("");

  linhas.push(
    "Aluno;CPF;RG;Telefone;Telefone 2;E-mail;Curso;Turma;Situacao;Data da matricula;Forma de pagamento;Parcelas;Valor total (R$);Fonte;Atendente"
  );
  for (const a of rows) {
    linhas.push(
      [
        a.fullName,
        a.cpf,
        a.rg,
        a.phone,
        a.phone2,
        a.email,
        a.courseName,
        a.className,
        SITUACAO_LABELS[a.situacao],
        a.enrolledAt.toLocaleDateString("pt-BR"),
        a.paymentMethod,
        a.installments,
        a.totalAmount.toFixed(2),
        a.source,
        a.vendedor,
      ]
        .map(csvCell)
        .join(";")
    );
  }

  // BOM para o Excel pt-BR reconhecer o UTF-8
  const csv = "\uFEFF" + linhas.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="alunos-direta.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
