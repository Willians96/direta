const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  // Pegar usuário vendas
  const vendas = await p.user.findUnique({
    where: { email: "vendas@direta.com" },
    select: { id: true, name: true, role: true },
  });
  console.log("Vendedor:", JSON.stringify(vendas));

  // Todos os leads atribuídos a ele
  const leads = await p.lead.findMany({
    where: { assignedToId: vendas.id },
    select: { id: true, fullName: true, status: true, assignedToId: true },
    take: 5,
  });
  console.log("Seus leads:");
  console.log(JSON.stringify(leads, null, 2));

  // Todos os leads do banco
  const total = await p.lead.count();
  console.log(`Total de leads no banco: ${total}`);

  // Lead de exemplo (Carlos Silva) — quem é o assignedTo?
  const carlos = await p.lead.findFirst({
    where: { fullName: { contains: "Carlos" } },
    select: { id: true, fullName: true, status: true, assignedToId: true },
  });
  console.log("Carlos:", JSON.stringify(carlos));

  await p.$disconnect();
})();
