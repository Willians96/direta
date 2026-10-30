// ============================================================
// Seed de demonstração — MÓDULO DE ALUNOS (Sprint 20).
//
// Cria turmas de exemplo, aloca os alunos de demonstração nelas e
// completa o cadastro (CPF, RG, nascimento, endereço, telefones).
//
//   node scripts/seed-alunos-demo.js            → cria os dados
//   node scripts/seed-alunos-demo.js --remove   → remove tudo que o script criou
//
// Tudo o que é criado fica marcado com "[demo-turmas]" (turmas) e usa os
// leads marcados com "[demo-relatorios]" (alunos) — nada toca dados reais.
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

const TAG_LEADS = "[demo-relatorios]";
const TAG_TURMAS = "[demo-turmas]";

const DIAS_AULA = ["SEG", "QUA", "SEX"];
const HORARIOS = {
  SEG: "19h-22h",
  QUA: "19h-22h",
  SEX: "19h-22h",
};

const RUAS = [
  "Rua Sete de Setembro",
  "Avenida Paulo Muwruz",
  "Rua Bárbara Sayão",
  "Avenida Itavuvu",
  "Rua Joaquim Silva",
  "Avenida General Zhang",
  "Rua Antônio Edson de Paula",
  "Avenida Engenheiro Carlos Reibold",
  "Rua Ataliba Leonel",
  "Rua Eduardo de Oliveira",
];

/** Gera um CPF com dígitos verificadores (para a demo ficar verossímil). */
function cpf(base) {
  const n = Array.from(String(base)).map(Number);
  while (n.length < 9) n.push(0);
  let d1 = n.slice(0, 9);
  for (let i = 0; i < 2; i++) {
    let s = 0;
    for (let j = 0; j < d1.length; j++) s += d1[j] * (10 - j);
    let r = (s * 10) % 11 % 10;
    d1.push(r);
  }
  let d2 = d1.slice(0, 10);
  for (let i = 0; i < 2; i++) {
    let s = 0;
    for (let j = 0; j < d2.length; j++) s += d2[j] * (11 - j);
    let r = (s * 10) % 11 % 10;
    d2.push(r);
  }
  const dig = d2.join("");
  return `${dig.slice(0, 3)}.${dig.slice(3, 6)}.${dig.slice(6, 9)}-${dig.slice(9)}`;
}

function nascimento(i) {
  const ano = 1985 + (i % 18);
  const mes = String((i % 12) + 1).padStart(2, "0");
  const dia = String(((i * 7) % 27) + 1).padStart(2, "0");
  return new Date(`${ano}-${mes}-${dia}T12:00:00Z`);
}

function data(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(12, 0, 0, 0);
  return d;
}

async function remover() {
  const turmas = await p.class.findMany({
    where: { notes: { contains: TAG_TURMAS } },
    select: { id: true },
  });
  for (const t of turmas) {
    await p.classStudent.deleteMany({ where: { classId: t.id } });
  }
  await p.class.deleteMany({ where: { notes: { contains: TAG_TURMAS } } });

  // devolve os alunos demo para "sem turma"
  const leads = await p.lead.findMany({
    where: { notes: { contains: TAG_LEADS } },
    select: { id: true },
  });
  const leadIds = leads.map((l) => l.id);
  await p.classStudent.deleteMany({ where: { leadId: { in: leadIds } } });
  await p.enrollment.updateMany({
    where: { leadId: { in: leadIds } },
    data: { classId: null },
  });

  console.log(
    `Removidas ${turmas.length} turmas de demonstração e desfeita a alocação dos alunos demo.`
  );
}

async function criar() {
  const jaExiste = await p.class.count({ where: { notes: { contains: TAG_TURMAS } } });
  if (jaExiste > 0) {
    console.log(
      "Já existem turmas de demonstração — rode com --remove antes de recriar."
    );
    return;
  }

  const [admin, cursos, leads] = await Promise.all([
    p.user.findUnique({ where: { email: "admin@direta.com" } }),
    p.course.findMany({ where: { status: "ATIVO" }, orderBy: { name: "asc" } }),
    p.lead.findMany({
      where: { notes: { contains: TAG_LEADS } },
      include: { enrollment: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!admin || cursos.length === 0) {
    console.error(
      "Estrutura mínima ausente (admin ou cursos). Rode o seed principal antes."
    );
    return;
  }

  const alunos = leads.filter((l) => l.enrollment);
  if (alunos.length === 0) {
    console.error(
      "Nenhum aluno de demonstração encontrado. Rode antes: node scripts/seed-relatorios-demo.js"
    );
    return;
  }

  // 1) Uma turma por curso
  const turmas = [];
  for (const [i, curso] of cursos.entries()) {
    const sigla = curso.name
      .replace(/[^A-Za-zÀ-ÿ ]/g, "")
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0].toUpperCase())
      .join("")
      .slice(0, 3);
    const turma = await p.class.create({
      data: {
        courseId: curso.id,
        name: `${curso.name} — Turma ${String.fromCharCode(65 + i)}`,
        code: `${sigla}-2026-${i + 1}`,
        schedule: { days: DIAS_AULA, time: HORARIOS.SEG },
        startDate: data(-60),
        endDate: data(120),
        maxStudents: 30,
        professorId: admin.id,
        status: "EM_ANDAMENTO",
        notes: `${TAG_TURMAS} turma de demonstracao`,
      },
    });
    turmas.push(turma);
  }

  // 2) Aloca os alunos na turma do seu curso e completa o cadastro
  let alocados = 0;
  let atualizados = 0;
  for (const [i, lead] of alunos.entries()) {
    const enrollment = lead.enrollment;
    const turma = turmas.find((t) => t.courseId === enrollment.courseId);
    if (!turma) continue;

    await p.enrollment.update({
      where: { id: enrollment.id },
      data: {
        classId: turma.id,
        cpf: cpf(100000000 + i * 7919),
        rg: `${String(10 + (i % 80))}.${String(100000 + i * 137)}-${i % 10}`,
        birthDate: nascimento(i),
        phone: `15 9${String(8000 + i * 37).slice(0, 4)}-${String(1000 + i * 53).slice(0, 4)}`,
        phone2: `15 9${String(6000 + i * 29).slice(0, 4)}-${String(2000 + i * 41).slice(0, 4)}`,
        email: lead.email,
        addressStreet: RUAS[i % RUAS.length],
        addressNumber: String(100 + i * 13),
        addressComplement: i % 3 === 0 ? `Apto ${i + 1}` : null,
        addressCity: "Sorocaba",
        addressState: "SP",
        addressZip: `181${String(20000 + i * 17).slice(0, 5)}`,
      },
    });
    atualizados++;

    // situação variada para a tela mostrar todos os status
    const status = i % 5 === 1 ? "TRANCADA" : i % 5 === 3 ? "CONCLUIDA" : "ATIVA";
    const vinculo = await p.classStudent.findUnique({
      where: { classId_leadId: { classId: turma.id, leadId: lead.id } },
      select: { id: true },
    });
    if (vinculo) {
      await p.classStudent.update({
        where: { id: vinculo.id },
        data: { status, finishedAt: status === "CONCLUIDA" ? data(-10) : null },
      });
    } else {
      await p.classStudent.create({
        data: {
          classId: turma.id,
          leadId: lead.id,
          status,
          finishedAt: status === "CONCLUIDA" ? data(-10) : null,
        },
      });
    }
    alocados++;
  }

  console.log(
    `Demonstração de alunos criada: ${turmas.length} turmas, ${alocados} alunos alocados, ${atualizados} cadastros completados.`
  );
  console.log("Abra /alunos para ver a lista e a ficha de cada aluno.");
  console.log("Para desfazer: node scripts/seed-alunos-demo.js --remove");
}

(async () => {
  const removerFlag = process.argv.includes("--remove");
  try {
    if (removerFlag) await remover();
    else await criar();
  } catch (e) {
    console.error("Erro:", e?.message ?? e);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
