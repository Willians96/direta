// Limpa estado de teste e valida o fluxo completo de matrícula.
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const lead = await p.lead.findFirst({
    where: { fullName: { contains: "Carlos" } },
    select: { id: true, fullName: true, status: true, salesStatus: true },
  });
  const vendedor = await p.user.findUnique({
    where: { email: "vendas@direta.com" },
    select: { id: true },
  });
  const curso = await p.course.findFirst({ select: { id: true, name: true, price: true } });
  const turma = await p.class.findFirst({
    where: { status: { in: ["ABERTA", "EM_ANDAMENTO"] } },
    select: { id: true, name: true },
  });

  // === LIMPEZA (estado deixado por execuções anteriores) ===
  await p.classStudent.deleteMany({ where: { leadId: lead.id } });
  await p.enrollment.deleteMany({ where: { leadId: lead.id } });
  await p.lead.update({
    where: { id: lead.id },
    data: { salesStatus: "OPORTUNIDADE_VENDAS", status: "EM_NEGOCIACAO" },
  });
  console.log("Cleanup ok");

  // === TESTE ===
  console.log(`Lead: ${lead.fullName} | Curso: ${curso.name} (R$ ${curso.price}) | Turma: ${turma?.name ?? "nenhuma"}`);

  const enrollment = await p.enrollment.create({
    data: {
      leadId: lead.id,
      courseId: curso.id,
      classId: turma?.id ?? null,
      fullName: lead.fullName,
      cpf: "123.456.789-00",
      phone: "11987654321",
      paymentMethod: "PIX",
      installments: 3,
      totalAmount: Number(curso.price),
      enrolledById: vendedor.id,
    },
  });

  await p.lead.update({
    where: { id: lead.id },
    data: { salesStatus: "MATRICULADO", status: "APROVADA" },
  });

  if (turma) {
    await p.classStudent.create({
      data: { classId: turma.id, leadId: lead.id, status: "ATIVA" },
    });
  }

  const check = await p.lead.findUnique({
    where: { id: lead.id },
    select: { salesStatus: true, status: true, enrollment: { select: { id: true } } },
  });
  const cs = await p.classStudent.count({ where: { leadId: lead.id } });
  const ok =
    !!check.enrollment &&
    check.salesStatus === "MATRICULADO" &&
    check.status === "APROVADA" &&
    (!turma || cs === 1);

  console.log(`RESULTADO -> enrollment=${check.enrollment ? "criado" : "ausente"} salesStatus=${check.salesStatus} status=${check.status} classStudent=${cs}`);
  console.log(ok ? "✅ FUNCIONA" : "❌ FALHOU");

  // === REVERTE ===
  await p.classStudent.deleteMany({ where: { leadId: lead.id } });
  await p.enrollment.deleteMany({ where: { id: enrollment.id } });
  await p.lead.update({
    where: { id: lead.id },
    data: { salesStatus: "OPORTUNIDADE_VENDAS", status: "EM_NEGOCIACAO" },
  });
  const after = await p.lead.findUnique({
    where: { id: lead.id },
    select: { salesStatus: true, status: true, enrollment: { select: { id: true } } },
  });
  console.log(`REVERTIDO -> salesStatus=${after.salesStatus} status=${after.status} enrollment=${after.enrollment ? "presente" : "removido"}`);

  await p.$disconnect();
})();
