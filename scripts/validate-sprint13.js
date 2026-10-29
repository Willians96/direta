// Validador Sprint 13 — ChatDialog + /admin/conversas
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const BASE = "https://direta-ten.vercel.app";
const LEAD_ID = "cmu0gc5ao000f43awk1nk009u"; // Carlos Silva (do vendedor)

function curl(args) {
  const res = spawnSync("curl.exe", args, { encoding: "utf8" });
  return res.stdout || "";
}

async function login(email, password) {
  const cookieJar = path.join(os.tmpdir(), `cookie-${Date.now()}.txt`);
  fs.writeFileSync(cookieJar, "");
  const csrfJson = curl(["-s", "-c", cookieJar, `${BASE}/api/auth/csrf`]);
  const csrf = JSON.parse(csrfJson).csrfToken;
  curl([
    "-s",
    "-b", cookieJar,
    "-c", cookieJar,
    "-X", "POST",
    "-H", "Content-Type: application/x-www-form-urlencoded",
    "-d", `csrfToken=${csrf}&email=${encodeURIComponent(email)}&password=${password}&redirect=false&callbackUrl=/`,
    `${BASE}/api/auth/callback/credentials`,
  ]);
  return cookieJar;
}

async function get(jar, url) {
  const html = curl(["-s", "-b", jar, url]);
  const statusRes = spawnSync("curl.exe", ["-s", "-b", jar, "-o", "NUL", "-w", "%{http_code}", url], { encoding: "utf8" });
  return { html, status: statusRes.stdout.trim() };
}

(async () => {
  console.log("\n=== ADMIN ===");
  const adminJar = await login("admin@direta.com", "admin123");
  const sess = JSON.parse(curl(["-s", "-b", adminJar, `${BASE}/api/auth/session`]));
  console.log(`Sessão: ${sess.user?.email}`);

  // 1. /vendas/leads/[id] (admin pode ver qualquer lead)
  const leadPage = await get(adminJar, `${BASE}/vendas/leads/${LEAD_ID}`);
  console.log(`/vendas/leads/${LEAD_ID} -> ${leadPage.status} (${leadPage.html.length}b)`);
  const checks = [
    ["Botão Abrir Conversa", "Abrir Conversa"],
    ["Card Ações rápidas", "Ações rápidas"],
    ["Botão Ligar", "Ligar"],
    ["Botão antigo WhatsApp removido", null, leadPage.html.indexOf('target="_blank">\n                  Abrir WhatsApp') === -1],
  ];
  for (const [name, match, fallback] of checks) {
    const ok = fallback !== undefined ? fallback : leadPage.html.includes(match);
    console.log(`  ${ok ? "OK" : "MISS"} ${name}`);
  }

  // 2. /admin/conversas
  const conv = await get(adminJar, `${BASE}/admin/conversas`);
  console.log(`/admin/conversas -> ${conv.status} (${conv.html.length}b)`);
  const convChecks = [
    "Conversas da Equipe",
    "Leads com conversa",
    "Total de mensagens",
    "Nenhuma conversa registrada",
    'href="/admin/conversas"', // sidebar
  ];
  for (const m of convChecks) {
    console.log(`  ${conv.html.includes(m) ? "OK" : "MISS"} ${m}`);
  }

  console.log("\n=== VENDEDOR ===");
  const vendasJar = await login("vendas@direta.com", "vendas123");
  const sessV = JSON.parse(curl(["-s", "-b", vendasJar, `${BASE}/api/auth/session`]));
  console.log(`Sessão: ${sessV.user?.email}`);

  // 3. /vendas/leads/[id]
  const leadV = await get(vendasJar, `${BASE}/vendas/leads/${LEAD_ID}`);
  console.log(`/vendas/leads/${LEAD_ID} -> ${leadV.status} (${leadV.html.length}b)`);
  console.log(`  ${leadV.html.includes("Abrir Conversa") ? "OK" : "MISS"} Botão Abrir Conversa (vendedor)`);

  // 4. vendedor NÃO pode acessar /admin/conversas
  const convV = await get(vendasJar, `${BASE}/admin/conversas`);
  console.log(`/admin/conversas (vendedor) -> ${convV.status} (deve redirecionar 307)`);

  // Limpar cookies
  for (const f of fs.readdirSync(os.tmpdir())) {
    if (f.startsWith("cookie-") && f.endsWith(".txt")) {
      try { fs.unlinkSync(path.join(os.tmpdir(), f)); } catch {}
    }
  }
})();
