// Seed de demonstração: follow-ups de exemplo no lead "Carlos Silva"
// para validar/exibir o formato de tabela pedido pela cliente.
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const lead = await p.lead.findFirst({
    where: { fullName: { contains: "Carlos" } },
    select: { id: true, fullName: true },
  });
  if (!lead) {
    console.error("Lead demo não encontrado");
    await p.$disconnect();
    return;
  }

  const vendedor = await p.user.findUnique({
    where: { email: "vendas@direta.com" },
    select: { id: true, name: true },
  });

  const existing = await p.followup.count({ where: { leadId: lead.id } });
  if (existing > 0) {
    console.log(`Lead já tem ${existing} follow-ups — nada inserido`);
    await p.$disconnect();
    return;
  }

  const base = new Date("2026-10-29T12:00:00-03:00");
  const exemplos = [
    {
      type: "LIGACAO",
      outcome: "ATENDEU",
      salesStatus: "NEGOCIANDO",
      notes:
        "Cliente narrated que é da região de Sorocaba, trabalha com manutenção " +
        "industrial e quer se qualificar para conseguir promoção. Perguntei sobre " +
        "horário das aulas à noite e se o curso tinha certificado. Falei que as " +
        "turmas abrem em novembro e que o valor pode ser parcelado.",
      occurredAt: base,
    },
    {
      type: "WHATSAPP",
      outcome: "REAGENDOU",
      salesStatus: "RETORNAR",
      notes:
        "Enviei a tabela de preços e o link de inscrição por WhatsApp. Ele " +
        "visualizou mas respondeu que ia falar com a esposa e me chamar depois " +
        "do fim de semana. Combinamos de retornar na segunda-feira de manhã.",
      occurredAt: new Date(base.getTime() - 86400000),
    },
    {
      type: "WHATSAPP",
      outcome: "ATENDEU",
      salesStatus: "OPORTUNIDADE_VENDAS",
      notes:
        "Retornei conforme combinado. Confirmou que quer fazer o curso, disse " +
        "que o ideal é fazer no período noturno por causa do trabalho e pediu " +
        "para eu reservar a vaga até sexta. Mandei os documentos necessários " +
        "para matrícula.",
      occurredAt: new Date(base.getTime() - 2 * 86400000),
    },
  ];

  for (const e of exemplos) {
    await p.followup.create({
      data: {
        leadId: lead.id,
        userId: vendedor.id,
        type: e.type,
        outcome: e.outcome,
        salesStatus: e.salesStatus,
        notes: e.notes,
        occurredAt: e.occurredAt,
      },
    });
  }

  // Lead fica como OPORTUNIDADE_VENDAS (classificação do vendedor)
  await p.lead.update({
    where: { id: lead.id },
    data: { salesStatus: "OPORTUNIDADE_VENDAS", source: "Indicação" },
  });

  console.log(`3 follow-ups de exemplo criados em ${lead.fullName}`);
  await p.$disconnect();
})();
