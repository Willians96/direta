/**
 * Valida os relatórios da direção contra o banco real.
 *
 * Uso:  node node_modules/tsx/dist/cli.mjs scripts/validate-reports.ts
 * (a partir da raiz do projeto)
 */

import fs from "fs";

// Carrega o .env antes de qualquer import que use o Prisma
function carregarEnv(arquivo: string) {
  if (!fs.existsSync(arquivo)) return;
  for (const linha of fs.readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

carregarEnv(".env");
carregarEnv(".env.local");

async function main() {
  const { getReportData, resolvePeriod } = await import("../lib/reports");

  const cenarios = [
    { nome: "mes atual", filtros: { periodo: "mes" } },
    { nome: "mes anterior", filtros: { periodo: "mes-anterior" } },
    { nome: "ultimos 30 dias", filtros: { periodo: "30d" } },
    { nome: "ultimos 90 dias", filtros: { periodo: "90d" } },
    { nome: "este ano", filtros: { periodo: "ano" } },
  ];

  for (const c of cenarios) {
    const data = await getReportData(c.filtros);
    const p = data.period;
    console.log(`\n=== ${c.nome} (${p.label}) ===`);
    console.log(
      `  leads=${data.kpis.leads} matriculas=${data.kpis.matriculas} ` +
        `conversao=${data.kpis.conversao.toFixed(1)}% receita=${data.kpis.receita} ` +
        `ticket=${data.kpis.ticketMedio.toFixed(2)} followups=${data.kpis.followups} ` +
        `fechamento=${data.kpis.tempoMedioFechamento ?? "-"}d ` +
        `orcamentoCampanhas=${data.kpis.orcamentoCampanhas}`
    );
    console.log(
      `  vendedores=${data.porVendedor.length} cursos=${data.porCurso.length} ` +
        `campanhas=${data.porCampanha.length} origens=${data.porOrigem.length} ` +
        `meses=${data.serie.length}`
    );
    for (const v of data.porVendedor.slice(0, 3)) {
      console.log(
        `    ${v.nome}: leads=${v.leads} mat=${v.matriculas}/${v.metaMatricula} ` +
          `receita=${v.receita}/${v.metaFaturamento} ating=${v.atingimentoMatricula.toFixed(0)}%`
      );
    }
    for (const cur of data.porCurso.slice(0, 3)) {
      console.log(
        `    curso ${cur.nome}: leads=${cur.leads} mat=${cur.matriculas} conv=${cur.conversao.toFixed(1)}% receita=${cur.receita}`
      );
    }
    for (const camp of data.porCampanha.slice(0, 3)) {
      console.log(
        `    campanha ${camp.nome}: orc=${camp.orcamento} leads=${camp.leads} mat=${camp.matriculas} ` +
          `custo/mat=${camp.custoPorMatricula ?? "-"}`
      );
    }
  }

  // Filtro por vendedor e por campanha
  const todos = await getReportData({ periodo: "ano" });
  const primeiro = todos.porVendedor[0];
  if (primeiro) {
    const filtrado = await getReportData({ periodo: "ano", vendedorId: primeiro.id });
    console.log(
      `\n=== filtro por vendedor (${primeiro.nome}) === leads=${filtrado.kpis.leads} ` +
        `matriculas=${filtrado.kpis.matriculas} receita=${filtrado.kpis.receita}`
    );
  }
  const primeiraCampanha = todos.porCampanha[0];
  if (primeiraCampanha) {
    const filtrado = await getReportData({
      periodo: "ano",
      campaignId: primeiraCampanha.id,
    });
    console.log(
      `=== filtro por campanha (${primeiraCampanha.nome}) === leads=${filtrado.kpis.leads} ` +
        `matriculas=${filtrado.kpis.matriculas}`
    );
  }

  const p = resolvePeriod({ periodo: "30d" });
  console.log(
    `\nresolvePeriod 30d: ${p.from.toISOString()} -> ${p.to.toISOString()} | meses=${p.months.length}`
  );

  console.log("\nOK: relatorios executaram sem erro.");
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
