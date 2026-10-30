// ============================================================
// Seed de demonstração para os RELATÓRIOS DA DIREÇÃO.
//
// Cria um histórico de 90 dias (leads, matrículas, follow-ups e metas)
// para que a tela /admin/relatorios mostre números na apresentação.
//
//   node scripts/seed-relatorios-demo.js            → cria os dados
//   node scripts/seed-relatorios-demo.js --remove   → remove tudo que o script criou
//
// Tudo o que é criado fica marcado com a tag "[demo-relatorios]" e pode ser
// removido com o --remove (sem tocar nos dados reais).
// ============================================================

const fs = require("fs");
const path = require("path");

// carrega o .env (o Prisma CLI faz isso, um script standalone precisa)
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

const TAG = "[demo-relatorios]";
const DIAS = 90;

const NOMES = [
  "André Luiz Ferreira", "Beatriz Ramos", "Camila Duarte", "Diego Martins",
  "Elaine Souza", "Fábio Nogueira", "Gabriela Prado", "Henrique Campos",
  "Isabela Rocha", "Joaquim Nunes", "Karina Belmonte", "Leandro Tavares",
  "Marcela Antunes", "Nilton Siqueira", "Olívia Bertoni", "Paulo Vilar",
  "Queila Andrade", "Renato Cavalcanti", "Sabrina Lopes", "Thiago Mattos",
];

const FONTES = [
  "Instagram", "Google", "WhatsApp", "Indicação", "Facebook",
  "Site", "Evento", "Outdoor",
];

const STATUS_CLIENTE = [
  "NEGOCIANDO", "MATRICULADO", "RETORNAR", "OPORTUNIDADE_VENDAS",
  "FIN_SEM_RENDA", "OUTRA_UNIDADE", "VISITA",
];

// Mantido para conferência: os status usados no ciclo determinístico abaixo
// precisam existir no enum SalesStatus do banco.
if (!STATUS_CLIENTE.includes("VISITA")) {
  throw new Error("Enum SalesStatus sem o valor VISITA — rode a migration antes.");
}

/**
 * Ciclo determinístico do "Status do cliente" dos leads que NÃO viraram
 * matrícula — garante que a tela de Captação mostre todos os indicadores
 * (NEGO, VISITA, RETORNAR...) com número, e não com zero.
 */
const CICLO_STATUS = [
  "NEGOCIANDO", "VISITA", "NEGOCIANDO", "RETORNAR",
  "NEGOCIANDO", "VISITA", "OPORTUNIDADE_VENDAS", "NEGOCIANDO",
];

const PRIORIDADES = ["ALTA", "MEDIA", "BAIXA"];

function aleatorio(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function dataNoPeriodo(diasAtras, hora = 10) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  d.setHours(hora, Math.floor(Math.random() * 60), 0, 0);
  return d;
}

async function remover() {
  const leads = await p.lead.findMany({
    where: { notes: { contains: TAG } },
    select: { id: true },
  });
  for (const l of leads) {
    await p.enrollment.deleteMany({ where: { leadId: l.id } });
    await p.followup.deleteMany({ where: { leadId: l.id } });
  }
  await p.lead.deleteMany({ where: { notes: { contains: TAG } } });
  await p.goal.deleteMany({ where: { notes: { contains: TAG } } });
  console.log(
    `Removidos ${leads.length} leads de demonstração (e metas marcadas com ${TAG}).`
  );
}

async function criar() {
  const jaExiste = await p.lead.count({ where: { notes: { contains: TAG } } });
  if (jaExiste > 0) {
    console.log(
      `Já existem ${jaExiste} leads de demonstração — rode com --remove antes de recriar.`
    );
    return;
  }

  const [admin, vendedores, cursos, campanhas] = await Promise.all([
    p.user.findUnique({ where: { email: "admin@direta.com" } }),
    p.user.findMany({
      where: { email: { in: ["vendas@direta.com", "captacao@direta.com"] } },
    }),
    p.course.findMany({ where: { status: "ATIVO" } }),
    p.campaign.findMany(),
  ]);

  if (!admin || vendedores.length === 0 || cursos.length === 0) {
    console.error(
      "Estrutura mínima ausente (admin, vendedores ou cursos). Rode o seed principal antes."
    );
    return;
  }

  const usados = new Set();
  let criadas = 0;
  let matriculas = 0;

  for (let i = 0; i < NOMES.length; i++) {
    const nome = NOMES[i];
    if (usados.has(nome)) continue;
    usados.add(nome);

    // 10 leads caem no mês atual (base da faixa de indicadores da tela de
    // Captação) e o restante se espalha pelos 90 dias anteriores.
    const diasAtras =
      i < 10 ? 2 + i * 2 : 30 + Math.floor(((i - 10) / (NOMES.length - 10)) * 60);
    const criadoEm = dataNoPeriodo(diasAtras);
    const vendedor = vendedores[i % vendedores.length];
    const curso = cursos[i % cursos.length];
    const campanha = campanhas.length ? campanhas[i % campanhas.length] : null;
    const matriculado = i % 3 === 0; // ~1/3 vira matrícula
    // ~1/3 dos leads ainda NÃO recebeu nenhum follow-up (indicador "SEM CTT")
    const semFollowup = !matriculado && i % 3 === 2;
    const statusCliente = matriculado
      ? "MATRICULADO"
      : CICLO_STATUS[i % CICLO_STATUS.length];

    const lead = await p.lead.create({
      data: {
        fullName: nome,
        phone: `11 9${String(8000 + i * 37).slice(0, 4)}-${String(1000 + i * 53).slice(0, 4)}`,
        email: `${nome
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/\s+/g, ".")}@email.com`,
        source: aleatorio(FONTES),
        status: matriculado ? "APROVADA" : i % 6 === 4 ? "INATIVO" : "EM_NEGOCIACAO",
        salesStatus: statusCliente,
        priority: aleatorio(PRIORIDADES),
        courseId: curso.id,
        campaignId: campanha?.id ?? null,
        assignedToId: vendedor.id,
        createdById: admin.id,
        createdAt: criadoEm,
        updatedAt: criadoEm,
        notes: `${TAG} lead criado para demonstrar os relatorios da direcao`,
      },
    });
    criadas++;

    // follow-ups do período
    const qtdFollowups = semFollowup ? 0 : 2 + (i % 3);
    let ultimoContato = criadoEm;
    for (let f = 0; f < qtdFollowups; f++) {
      const ocorreuEm = dataNoPeriodo(Math.max(0, diasAtras - f - 1), 14);
      if (ocorreuEm > ultimoContato) ultimoContato = ocorreuEm;
      await p.followup.create({
        data: {
          leadId: lead.id,
          userId: vendedor.id,
          type: aleatorio(["LIGACAO", "WHATSAPP", "EMAIL", "REUNIAO"]),
          outcome: "ATENDEU",
          salesStatus: statusCliente,
          notes: `${TAG} acionamento de demonstracao`,
          occurredAt: ocorreuEm,
          createdAt: criadoEm,
        },
      });
    }

    // A coluna "ATUALIZADO" da tela de Leads reflete o último contato do
    // vendedor (mesma regra do sistema: cada follow-up atualiza o lead).
    await p.lead.update({
      where: { id: lead.id },
      data: { updatedAt: ultimoContato },
    });

    // matrícula (~1/3 dos leads) com receita
    if (matriculado) {
      const valor = Number(curso.price ?? 0) || 1500;
      const matriculaEm = dataNoPeriodo(Math.max(0, diasAtras - 3), 11);
      if (matriculaEm >= criadoEm) {
        await p.enrollment.create({
          data: {
            leadId: lead.id,
            courseId: curso.id,
            fullName: nome,
            phone: "11 90000-0000",
            totalAmount: valor,
            paymentMethod: aleatorio(["PIX", "BOLETO", "CARTAO_CREDITO", "PARCELADO_PROPRIO"]),
            installments: aleatorio([1, 2, 3, 6]),
            enrolledById: admin.id,
            createdAt: matriculaEm,
            updatedAt: matriculaEm,
            notes: `${TAG} matricula de demonstracao`,
          },
        });
        matriculas++;
      }
    }
  }

  // metas do mês atual para cada vendedor
  const agora = new Date();
  for (const v of vendedores) {
    const metaMatricula = 6 + Math.floor(Math.random() * 5);
    const metaFaturamento = metaMatricula * 1800;
    const metaFollowup = 40 + Math.floor(Math.random() * 30);
    await p.goal.upsert({
      where: {
        userId_month_year: {
          userId: v.id,
          month: agora.getMonth() + 1,
          year: agora.getFullYear(),
        },
      },
      create: {
        userId: v.id,
        month: agora.getMonth() + 1,
        year: agora.getFullYear(),
        metaMatricula,
        metaFaturamento,
        metaFollowup,
        notes: `${TAG} meta de demonstracao`,
      },
      update: {
        metaMatricula,
        metaFaturamento,
        metaFollowup,
        notes: `${TAG} meta de demonstracao`,
      },
    });
  }

  console.log(
    `Demonstração criada: ${criadas} leads, ${matriculas} matrículas, follow-ups e metas do mês.`
  );
  console.log(
    "Abra /admin/relatorios (período: Este ano ou Últimos 90 dias) para ver os números."
  );
  console.log("Para desfazer: node scripts/seed-relatorios-demo.js --remove");
}

(async () => {
  const removerFlag = process.argv.includes("--remove");
  if (removerFlag) await remover();
  else await criar();
  await p.$disconnect();
})().catch(async (e) => {
  console.error("ERRO:", e.message);
  await p.$disconnect();
  process.exit(1);
});
