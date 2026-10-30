// ============================================================
// Validação da faixa de indicadores da tela de Captação de Leads
// (Sprint 21 — pedido da cliente).
//
//   node scripts/validate-leads-kpi.js
//
// Confere no banco os 8 indicadores do mês atual exatamente como a tela
// /captacao/leads calcula, além das contagens da tabela.
// ============================================================

const fs = require("fs");
const path = require("path");

function carregarEnv(arquivo) {
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

carregarEnv(path.join(__dirname, "..", ".env"));
carregarEnv(path.join(__dirname, "..", ".env.local"));

const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);
  const base = { createdAt: { gte: inicioMes, lte: fimMes } };

  const [total, semCtt, nego, matr, inativo, visita, followups, totalGeral] =
    await Promise.all([
      p.lead.count({ where: base }),
      p.lead.count({ where: { ...base, followups: { none: {} } } }),
      p.lead.count({ where: { ...base, salesStatus: "NEGOCIANDO" } }),
      p.lead.count({ where: { ...base, salesStatus: "MATRICULADO" } }),
      p.lead.count({ where: { ...base, status: "INATIVO" } }),
      p.lead.count({ where: { ...base, salesStatus: "VISITA" } }),
      p.followup.count({ where: { lead: { is: base } } }),
      p.lead.count(),
    ]);

  const fecha = total > 0 ? (matr / total) * 100 : 0;
  const media = total > 0 ? followups / total : 0;

  console.log(`\n=== Faixa de indicadores — ${agora.getMonth() + 1}/${agora.getFullYear()} ===`);
  console.log(`TOTAL      ${total}`);
  console.log(`SEM CTT    ${semCtt}`);
  console.log(`NEGO       ${nego}`);
  console.log(`MATR       ${matr}`);
  console.log(`FECHA      ${fecha.toFixed(1).replace(".", ",")}%`);
  console.log(`INATIVO    ${inativo}`);
  console.log(`MEDIA      ${media.toFixed(1).replace(".", ",")}`);
  console.log(`VISITA     ${visita}`);
  console.log(`\nLeads na tabela (todos): ${totalGeral}`);
  console.log(`Follow-ups do mês: ${followups}`);

  const visitaTotal = await p.lead.count({ where: { salesStatus: "VISITA" } });
  console.log(`Leads com status VISITA no total: ${visitaTotal}`);

  await p.$disconnect();
})().catch(async (e) => {
  console.error("ERRO:", e.message);
  await p.$disconnect();
  process.exit(1);
});
