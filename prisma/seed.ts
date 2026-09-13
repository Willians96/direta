import { PrismaClient, UserRole, UserStatus, LeadStatus, CourseStatus, CampaignStatus, CampaignChannel, PreEnrollmentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Limpa tudo (cuidado em produção!)
  await prisma.enrollmentAudit.deleteMany();
  await prisma.document.deleteMany();
  await prisma.preEnrollment.deleteMany();
  await prisma.interaction.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.class.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.course.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  // === USERS ===
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: "admin@direta.com",
        name: "Administrador",
        passwordHash: await bcrypt.hash("admin123", 10),
        role: UserRole.ADMIN,
        status: UserStatus.ATIVO,
      },
    }),
    prisma.user.create({
      data: {
        email: "captacao@direta.com",
        name: "Pedro Captação",
        passwordHash: await bcrypt.hash("captacao123", 10),
        role: UserRole.CAPTACAO,
        status: UserStatus.ATIVO,
      },
    }),
    prisma.user.create({
      data: {
        email: "vendas@direta.com",
        name: "Ana Paula Vendas",
        passwordHash: await bcrypt.hash("vendas123", 10),
        role: UserRole.VENDAS,
        status: UserStatus.ATIVO,
      },
    }),
    prisma.user.create({
      data: {
        email: "recepcao@direta.com",
        name: "Lúcia Recepção",
        passwordHash: await bcrypt.hash("recepcao123", 10),
        role: UserRole.RECEPCAO,
        status: UserStatus.ATIVO,
      },
    }),
  ]);

  const [admin, captacao, vendas, recepcao] = users;

  // === COURSES ===
  const courses = await Promise.all([
    prisma.course.create({
      data: {
        name: "Eletricista Industrial",
        description: "Curso completo de instalações elétricas industriais com NR-10 e NR-35",
        workloadHours: 240,
        price: 2400.0,
        status: CourseStatus.ATIVO,
      },
    }),
    prisma.course.create({
      data: {
        name: "Mecânica Automotiva",
        description: "Formação técnica em mecânica de veículos leves e pesados",
        workloadHours: 180,
        price: 1800.0,
        status: CourseStatus.ATIVO,
      },
    }),
    prisma.course.create({
      data: {
        name: "NR-10 e NR-35",
        description: "Curso de normas regulamentadoras para trabalho em altura e eletricidade",
        workloadHours: 80,
        price: 890.0,
        status: CourseStatus.ATIVO,
      },
    }),
    prisma.course.create({
      data: {
        name: "Preparatório ENEM",
        description: "Preparação intensiva para o ENEM com foco em todas as áreas",
        workloadHours: 320,
        price: 1980.0,
        status: CourseStatus.ATIVO,
      },
    }),
  ]);

  // === CAMPAIGNS ===
  const campaigns = await Promise.all([
    prisma.campaign.create({
      data: {
        name: "Black Friday Cursos 2026",
        channel: CampaignChannel.INSTAGRAM,
        startDate: new Date("2026-09-01"),
        endDate: new Date("2026-11-30"),
        budget: 5000,
        status: CampaignStatus.ATIVA,
        createdById: captacao.id,
      },
    }),
    prisma.campaign.create({
      data: {
        name: "Indicação Alunos",
        channel: CampaignChannel.INDICACAO,
        startDate: new Date("2026-01-01"),
        budget: 0,
        status: CampaignStatus.ATIVA,
        createdById: captacao.id,
      },
    }),
    prisma.campaign.create({
      data: {
        name: "Google Ads — Cursos Industriais",
        channel: CampaignChannel.GOOGLE_ADS,
        startDate: new Date("2026-08-15"),
        budget: 8000,
        status: CampaignStatus.ATIVA,
        createdById: captacao.id,
      },
    }),
  ]);

  // === LEADS ===
  await prisma.lead.create({
    data: {
      fullName: "Carlos Silva",
      phone: "11987654321",
      email: "carlos@email.com",
      status: LeadStatus.EM_NEGOCIACAO,
      courseId: courses[0].id,
      campaignId: campaigns[0].id,
      assignedToId: vendas.id,
      createdById: captacao.id,
    },
  });

  await prisma.lead.create({
    data: {
      fullName: "Mariana Souza",
      phone: "11998765432",
      email: "mariana@email.com",
      status: LeadStatus.AGUARDANDO_ANALISE,
      courseId: courses[1].id,
      campaignId: campaigns[1].id,
      assignedToId: vendas.id,
      createdById: captacao.id,
    },
  });

  await prisma.lead.create({
    data: {
      fullName: "Roberto Lima",
      phone: "11976543210",
      email: "roberto@email.com",
      status: LeadStatus.DEVOLVIDA_AJUSTE,
      courseId: courses[2].id,
      assignedToId: vendas.id,
      createdById: captacao.id,
    },
  });

  console.log("✅ Seed concluído!");
  console.log("");
  console.log("📋 Credenciais de acesso:");
  console.log("   admin@direta.com / admin123");
  console.log("   captacao@direta.com / captacao123");
  console.log("   vendas@direta.com / vendas123");
  console.log("   recepcao@direta.com / recepcao123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
