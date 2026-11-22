// Demonstração da captação via WhatsApp (Sprint 22).
//
//   pnpm tsx scripts/seed-whatsapp-demo.ts          cria a fila de demonstração
//   pnpm tsx scripts/seed-whatsapp-demo.ts --remove desfaz
//
// As mensagens entram pelo MESMO pipeline do webhook da Meta: cada uma cria
// um lead, grava a conversa no chat-log e roda a análise.

import { prisma } from "@/lib/prisma";
import { processarMensagemWhatsApp } from "@/lib/whatsapp/ingest";

const MARCA = "demo-whatsapp";

// Telefones na faixa 99900xx — reservada para a demo, para não colidir com
// nenhum lead real do banco.
const MENSAGENS = [
  {
    nome: "Marcos Oliveira",
    telefone: "551199900001",
    mensagem:
      "Olá! Vi o anúncio no Instagram. Quero saber quanto custa o curso de NR-35 e se tem turmas noturnas. Sou de Sorocaba.",
  },
  {
    nome: "Juliana Reis",
    telefone: "551199900002",
    mensagem:
      "Bom dia, meu nome é Juliana Reis. Gostaria de me matricular no NR-10, vocês atendem em Sorocaba? Aceito parcelar.",
  },
  {
    nome: "Carlos Mendes",
    telefone: "552199900003",
    mensagem:
      "Oi! Sou Carlos Mendes, de Campinas. Posso visitar a escola pra conhecer? Quero fazer o curso de mecânica automotiva.",
  },
  {
    nome: "Ana Beatriz",
    telefone: "553199900004",
    mensagem:
      "Bom dia, recebi o boleto do curso de eletricista industrial, mas não consigo pagar hoje. Vocês conseguem gerar segunda via?",
  },
  {
    nome: "Pedro Nunes",
    telefone: "553499900005",
    mensagem:
      "Olá, moro em Curitiba. Vocês têm curso de NR-10 à distância? Preciso saber o valor.",
  },
  {
    nome: "Rita",
    telefone: "551199900006",
    mensagem: "oi, quero o curso de nr 35",
  },
];

async function main() {
  const remover = process.argv.includes("--remove");

  if (remover) {
    const inbounds = await prisma.whatsappInbound.findMany({
      where: { wamid: { startsWith: MARCA } },
      select: { id: true, leadId: true },
    });
    const leadIds = inbounds.map((i) => i.leadId).filter((x): x is string => !!x);

    await prisma.leadMessage.deleteMany({
      where: { leadId: { in: leadIds }, channel: "WHATSAPP" },
    });
    await prisma.interaction.deleteMany({
      where: { leadId: { in: leadIds }, type: "WHATSAPP" },
    });
    await prisma.enrollmentAudit.deleteMany({
      where: { leadId: { in: leadIds }, action: "LEAD_CREATED" },
    });
    await prisma.whatsappInbound.deleteMany({ where: { wamid: { startsWith: MARCA } } });
    await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });

    console.log(`Removidos ${inbounds.length} inbound(s) e ${leadIds.length} lead(s) demo.`);
    await prisma.$disconnect();
    return;
  }

  for (const [i, m] of MENSAGENS.entries()) {
    const resultado = await processarMensagemWhatsApp({
      waId: m.telefone,
      nome: m.nome,
      tipo: "text",
      texto: m.mensagem,
      wamid: `${MARCA}-${Date.now()}-${i}`,
      raw: { demo: true },
    });

    if (!resultado.ok) {
      console.log(`✗ ${m.nome}: ${resultado.erro}`);
      continue;
    }

    const a = resultado.analise;
    console.log(
      `✓ ${(a?.nome || m.nome).padEnd(20)} | curso: ${(a?.courseName ?? "—").padEnd(22)} | ` +
        `status: ${(a?.status ?? "—").padEnd(12)} | score: ${a?.score ?? "—"} | ` +
        `análise: ${a?.model ?? "—"}`
    );
  }

  console.log("\nAbra /captacao/whatsapp para ver a fila.");
  console.log("Para desfazer: pnpm tsx scripts/seed-whatsapp-demo.ts --remove");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("ERRO:", e);
  await prisma.$disconnect();
  process.exit(1);
});
