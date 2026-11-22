// Teste do motor de captação via WhatsApp (Sprint 22).
//   pnpm tsx scripts/test-whatsapp-flow.ts
//
// 1) Valida a normalização e a análise por REGRAS (não grava nada).
// 2) Mostra como a fila está no banco.

import { prisma } from "@/lib/prisma";
import { analisarPorRegras } from "../lib/whatsapp/rules";
import { normalizarTelefone, extrairNomeDoTexto } from "../lib/whatsapp/normalize";

const CURSOS = [
  {
    id: "c1",
    name: "NR-10 e NR-35",
    description: "Segurança do trabalho em instalações elétricas e trabalho em altura.",
  },
  { id: "c2", name: "Mecânica Automotiva", description: "Curso técnico de mecânica automotiva." },
  { id: "c3", name: "Eletricista Industrial", description: "Formação de eletricista industrial." },
];

const MENSAGENS = [
  "Olá! Vi o anúncio no Instagram. Quero saber quanto custa o curso de NR-35 e se tem turmas noturnas.",
  "Bom dia, meu nome é Juliana Reis. Gostaria de me matricular no NR-10, vocês atendem em Sorocaba?",
  "Oi! Sou Carlos Mendes, de Campinas. Posso visitar a escola pra conhecer? Quero fazer o curso de mecânica automotiva.",
  "Bom dia, recebi o boleto do curso de eletricista industrial, mas não consigo pagar hoje. Vocês conseguem gerar segunda via?",
  "oi, quero o curso de nr 35",
  "Bom dia, queria saber o valor do curso de nr 10",
];

async function main() {
  console.log("=== normalização de telefone ===");
  for (const t of ["5511987654321", "551198765432", "11987654321", "5534994443333"]) {
    console.log(`${t} -> ${normalizarTelefone(t)}`);
  }

  console.log("\n=== extração de nome ===");
  console.log(extrairNomeDoTexto("Bom dia, meu nome é Juliana Reis. Gostaria de me matricular"));
  console.log(extrairNomeDoTexto("Oi! Sou Carlos Mendes, de Campinas."));

  console.log("\n=== análise por regras ===");
  for (const msg of MENSAGENS) {
    const a = analisarPorRegras(msg, CURSOS);
    console.log(`\n"${msg.slice(0, 62)}…"`);
    console.log(`  nome: ${a.nome ?? "—"} | curso: ${a.courseName ?? "—"} | status: ${a.status}`);
    console.log(`  intencao: ${a.intent} | score: ${a.score} | tags: ${a.tags.join(", ") || "—"}`);
    console.log(`  resumo: ${a.resumo}`);
  }

  console.log("\n=== fila de WhatsApp no banco ===");
  const inbounds = await prisma.whatsappInbound.findMany({
    orderBy: { receivedAt: "desc" },
    take: 10,
    include: {
      lead: {
        select: {
          fullName: true,
          phone: true,
          source: true,
          aiSummary: true,
          aiScore: true,
          aiTags: true,
          aiStatus: true,
          aiModel: true,
          assignedTo: { select: { name: true } },
        },
      },
    },
  });

  for (const m of inbounds) {
    console.log(
      `${m.status.padEnd(9)} | ${(m.lead?.fullName ?? "—").padEnd(18)} | ${m.phone.padEnd(16)} | ` +
        `fonte: ${m.lead?.source ?? "—"} | score: ${m.lead?.aiScore ?? "—"} | ` +
        `tags: ${m.lead?.aiTags.join(",") ?? "—"} | vendedor: ${m.lead?.assignedTo?.name ?? "—"}`
    );
  }
  console.log(`total de inbounds: ${await prisma.whatsappInbound.count()}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
