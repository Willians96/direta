// Validador Sprint 14 — ajustes da cliente
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const BASE = "https://direta-ten.vercel.app";
const LEAD_ID = "cmu0gc5ao000f43awk1nk009u"; // Carlos Silva

function curl(args) {
  const res = spawnSync("curl.exe", args, { encoding: "utf8" });
  return res.stdout || "";
}

async function login(email, password) {
  const cookieJar = path.join(os.tmpdir(), `ck-${Date.now()}-${Math.random()}.txt`);
  fs.writeFileSync(cookieJar, "");
  const csrf = JSON.parse(curl(["-s", "-c", cookieJar, `${BASE}/api/auth/csrf`])).csrfToken;
  curl([
    "-s", "-b", cookieJar, "-c", cookieJar, "-X", "POST",
    "-H", "Content-Type: application/x-www-form-urlencoded",
    "-d", `csrfToken=${csrf}&email=${encodeURIComponent(email)}&password=${password}&redirect=false&callbackUrl=/`,
    `${BASE}/api/auth/callback/credentials`,
  ]);
  return cookieJar;
}

async function get(jar, url) {
  const html = curl(["-s", "-b", jar, url]);
  const st = spawnSync("curl.exe", ["-s", "-b", jar, "-o", "NUL", "-w", "%{http_code}", url], { encoding: "utf8" });
  return { html, status: st.stdout.trim() };
}

(async () => {
  const vendas = await login("vendas@direta.com", "vendas123");
  const cap = await login("captacao@direta.com", "captacao123");

  console.log("=== VENDEDOR ===");
  const lead = await get(vendas, `${BASE}/vendas/leads/${LEAD_ID}`);
  console.log(`/vendas/leads/[id] -> ${lead.status} (${lead.html.length}b)`);
  [
    ["Status de Venda (badge)", "Status de venda"],
    ["Botão Enviar Email", "Enviar Email"],
    ["Botão Realizar Matrícula", "Realizar Matrícula"],
    ["Histórico em tabela", "DT CTT"],
    ["Coluna Horário", "Horário"],
    ["Coluna Histórico", "Histórico"],
    ["Coluna Status (followup)", "Status"],
    ["Doc padrão Comprovante Endereço", "Comprovante de Endereço"],
    ["Doc padrão Comprovante Pagamento", "Comprovante de Pagamento"],
    ["Doc padrão Foto do Aluno", "Foto do Aluno"],
    ["Fonte exibida", "Fonte (como conheceu a escola)"],
  ].forEach(([n, m]) => console.log(`  ${lead.html.includes(m) ? "OK  " : "MISS"} ${n}`));

  // Lead inexistente -> 404 customizado
  const nf = await get(vendas, `${BASE}/vendas/leads/zzz999`);
  console.log(`/vendas/leads/inexistente -> ${nf.status} (404 customizado: ${nf.html.includes("não encontrado") ? "OK" : "MISS"})`);

  // Form de matrícula
  const mat = await get(vendas, `${BASE}/vendas/leads/${LEAD_ID}/matricula`);
  console.log(`/vendas/leads/[id]/matricula -> ${mat.status}`);
  ["Dados do aluno", "Curso e turma", "Endereço", "Pagamento", "Confirmar matrícula"].forEach((m) =>
    console.log(`  ${mat.html.includes(m) ? "OK  " : "MISS"} ${m}`),
  );

  // Lista de leads do vendedor
  const list = await get(vendas, `${BASE}/vendas/leads`);
  console.log(`/vendas/leads -> ${list.status} (${list.html.length}b)`);
  ["Status de venda", "Prioridade", "Carlos Silva", "Fonte"].forEach((m) =>
    console.log(`  ${list.html.includes(m) ? "OK  " : "MISS"} ${m}`),
  );

  console.log("\n=== CAPTAÇÃO ===");
  const novo = await get(cap, `${BASE}/captacao/leads/novo`);
  console.log(`/captacao/leads/novo -> ${novo.status} (${novo.html.length}b)`);
  [
    "Cadastro do Cliente",
    "Telefone principal",
    "2º telefone",
    "3º telefone",
    "Fonte (como conheceu a escola)",
    "Instagram",
    "Status de venda",
    "Vendedor responsável",
  ].forEach((m) => console.log(`  ${novo.html.includes(m) ? "OK  " : "MISS"} ${m}`));

  const capLeads = await get(cap, `${BASE}/captacao/leads`);
  console.log(`/captacao/leads -> ${capLeads.status}`);
  ["Status de venda", "Fonte"].forEach((m) =>
    console.log(`  ${capLeads.html.includes(m) ? "OK  " : "MISS"} ${m}`),
  );

  for (const f of fs.readdirSync(os.tmpdir())) {
    if (f.startsWith("ck-") && f.endsWith(".txt")) {
      try { fs.unlinkSync(path.join(os.tmpdir(), f)); } catch {}
    }
  }
})();
