import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getReportData, type ReportFilters } from "@/lib/reports";

export const dynamic = "force-dynamic";

/**
 * Exporta o relatório da direção em CSV (separador ";" — padrão do Excel
 * em pt-BR). Mesmos filtros da tela /admin/relatorios.
 */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function section(titulo: string, cabecalho: string[], linhas: (string | number | null)[][]) {
  const out: string[] = [];
  out.push(csvCell(titulo));
  out.push(cabecalho.map(csvCell).join(";"));
  for (const linha of linhas) out.push(linha.map(csvCell).join(";"));
  out.push("");
  return out;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
  }

  const p = req.nextUrl.searchParams;
  const filters: ReportFilters = {
    periodo: p.get("periodo") || undefined,
    mes: p.get("mes") || undefined,
    ano: p.get("ano") || undefined,
    vendedorId: p.get("vendedorId") || undefined,
    courseId: p.get("courseId") || undefined,
    campaignId: p.get("campaignId") || undefined,
  };

  const data = await getReportData(filters);
  const { kpis } = data;

  const linhas: string[] = [];
  linhas.push("RELATORIO DA DIRECAO - Direta Cursos");
  linhas.push(
    `Periodo;${data.period.from.toLocaleDateString("pt-BR")} a ${data.period.to.toLocaleDateString("pt-BR")}`
  );
  linhas.push(`Rotulo;${data.period.label}`);
  linhas.push("");

  linhas.push(
    ...section(
      "INDICADORES DO PERIODO",
      ["Indicador", "Valor"],
      [
        ["Leads no periodo", kpis.leads],
        ["Matriculas", kpis.matriculas],
        ["Conversao (%)", kpis.conversao.toFixed(2)],
        ["Receita (R$)", kpis.receita.toFixed(2)],
        ["Ticket medio (R$)", kpis.ticketMedio.toFixed(2)],
        ["Acionamentos", kpis.followups],
        [
          "Tempo medio de fechamento (dias)",
          kpis.tempoMedioFechamento ?? "",
        ],
        ["Investimento em campanhas (R$)", kpis.orcamentoCampanhas.toFixed(2)],
      ]
    )
  );

  linhas.push(
    ...section(
      "META X REALIZADO POR VENDEDOR",
      [
        "Vendedor",
        "Perfil",
        "Leads",
        "Matriculas",
        "Meta matriculas",
        "Atingimento matriculas (%)",
        "Faturamento (R$)",
        "Meta faturamento (R$)",
        "Atingimento faturamento (%)",
        "Acionamentos",
        "Meta acionamentos",
        "Atingimento acionamentos (%)",
      ],
      data.porVendedor.map((v) => [
        v.nome,
        v.role,
        v.leads,
        v.matriculas,
        v.metaMatricula,
        v.atingimentoMatricula.toFixed(1),
        v.receita.toFixed(2),
        v.metaFaturamento.toFixed(2),
        v.atingimentoFaturamento.toFixed(1),
        v.followups,
        v.metaFollowup,
        v.atingimentoFollowup.toFixed(1),
      ])
    )
  );

  linhas.push(
    ...section(
      "CAMPANHAS - INVESTIMENTO X RESULTADO",
      [
        "Campanha",
        "Canal",
        "Status",
        "Orcamento (R$)",
        "Leads",
        "Matriculas",
        "Conversao (%)",
        "Receita (R$)",
        "Custo por matricula (R$)",
      ],
      data.porCampanha.map((c) => [
        c.nome,
        c.canal,
        c.status,
        c.orcamento.toFixed(2),
        c.leads,
        c.matriculas,
        c.conversao.toFixed(1),
        c.receita.toFixed(2),
        c.custoPorMatricula !== null ? c.custoPorMatricula.toFixed(2) : "",
      ])
    )
  );

  linhas.push(
    ...section(
      "RESULTADO POR CURSO",
      ["Curso", "Leads", "Matriculas", "Conversao (%)", "Receita (R$)", "Ticket medio (R$)"],
      data.porCurso.map((c) => [
        c.nome,
        c.leads,
        c.matriculas,
        c.conversao.toFixed(1),
        c.receita.toFixed(2),
        c.ticket.toFixed(2),
      ])
    )
  );

  linhas.push(
    ...section(
      "ORIGEM DOS LEADS",
      ["Origem", "Leads", "Matriculas", "Conversao (%)"],
      data.porOrigem.map((o) => [o.fonte, o.leads, o.matriculas, o.conversao.toFixed(1)])
    )
  );

  linhas.push(
    ...section(
      "EVOLUCAO MENSAL",
      ["Mes", "Leads", "Matriculas", "Receita (R$)"],
      data.serie.map((m) => [
        `${m.label}/${m.year}`,
        m.leads,
        m.matriculas,
        m.receita.toFixed(2),
      ])
    )
  );

  // BOM para o Excel pt-BR reconhecer o UTF-8
  const csv = "\uFEFF" + linhas.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-direta-${data.period.label.replace(/\W+/g, "-")}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
