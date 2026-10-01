const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const leads = await p.lead.findMany({
    where: { status: { notIn: ["PERDIDA", "APROVADA"] } },
    take: 3,
    orderBy: { updatedAt: "asc" },
    select: { id: true, fullName: true },
  });
  console.log(JSON.stringify(leads, null, 2));
  await p.$disconnect();
})();
