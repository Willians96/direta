import { prisma } from "@/lib/prisma";
import type { ClassStudentStatus, Prisma } from "@prisma/client";

/**
 * Sprint 20 — Cadastro de Alunos.
 *
 * O "aluno" é a matrícula (`Enrollment`): o registro com os dados definitivos
 * do estudante (CPF, RG, endereço, contato) e o vínculo com curso/turma.
 *
 * A situação do aluno vem do vínculo com a turma (`ClassStudent`):
 * ATIVA / TRANCADA / CONCLUIDA / CANCELADA. Quem não tem turma é
 * "SEM_TURMA" — matrícula feita, mas ainda não alocado em uma classe.
 */

export type StudentStatus =
  | "ATIVA"
  | "TRANCADA"
  | "CONCLUIDA"
  | "CANCELADA"
  | "SEM_TURMA";

export const SITUACOES_ALUNO: { value: StudentStatus; label: string }[] = [
  { value: "ATIVA", label: "Ativo" },
  { value: "TRANCADA", label: "Trancado" },
  { value: "CONCLUIDA", label: "Concluído" },
  { value: "CANCELADA", label: "Cancelado" },
  { value: "SEM_TURMA", label: "Sem turma" },
];

export const SITUACAO_VARIANTS: Record<
  StudentStatus,
  "success" | "warning" | "info" | "neutral" | "outline"
> = {
  ATIVA: "success",
  TRANCADA: "warning",
  CONCLUIDA: "info",
  CANCELADA: "neutral",
  SEM_TURMA: "outline",
};

export const SITUACAO_LABELS: Record<StudentStatus, string> = {
  ATIVA: "Ativo",
  TRANCADA: "Trancado",
  CONCLUIDA: "Concluído",
  CANCELADA: "Cancelado",
  SEM_TURMA: "Sem turma",
};

export type StudentFilters = {
  /** Busca livre: nome, CPF, telefone ou e-mail. */
  q?: string;
  courseId?: string;
  classId?: string;
  situacao?: string;
};

export type StudentRow = {
  id: string;
  leadId: string;
  fullName: string;
  cpf: string | null;
  rg: string | null;
  phone: string;
  phone2: string | null;
  email: string | null;
  birthDate: Date | null;
  courseId: string;
  courseName: string;
  classId: string | null;
  className: string | null;
  classCode: string | null;
  enrolledAt: Date;
  totalAmount: number;
  installments: number;
  paymentMethod: string | null;
  situacao: StudentStatus;
  source: string | null;
  vendedor: string | null;
};

export type StudentKpis = {
  total: number;
  ativos: number;
  concluidos: number;
  trancados: number;
  semTurma: number;
  receita: number;
};

/** Situação do aluno derivada do vínculo com a turma. */
export function situacaoDoAluno(
  classId: string | null,
  classStudents: { classId: string; status: string }[]
): StudentStatus {
  if (!classId) return "SEM_TURMA";
  const vinculo = classStudents.find((c) => c.classId === classId);
  return (vinculo?.status as StudentStatus) ?? "ATIVA";
}

function montarWhere(filters: StudentFilters): Prisma.EnrollmentWhereInput {
  const where: Prisma.EnrollmentWhereInput = {};

  if (filters.courseId) where.courseId = filters.courseId;
  if (filters.classId) where.classId = filters.classId;

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { lead: { fullName: { contains: q, mode: "insensitive" } } },
      { cpf: { contains: q } },
      { phone: { contains: q } },
      { phone2: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const situacao = filters.situacao;
  if (situacao === "SEM_TURMA") {
    where.classId = null;
  } else if (situacao && SITUACOES_ALUNO.some((s) => s.value === situacao)) {
    where.lead = { classStudents: { some: { status: situacao as ClassStudentStatus } } };
  }

  return where;
}

/** Lista de alunos com os filtros aplicados + indicadores do resultado. */
export async function getStudents(filters: StudentFilters): Promise<{
  rows: StudentRow[];
  kpis: StudentKpis;
}> {
  const enrollments = await prisma.enrollment.findMany({
    where: montarWhere(filters),
    include: {
      course: { select: { id: true, name: true } },
      class: { select: { id: true, name: true, code: true } },
      lead: {
        select: {
          id: true,
          source: true,
          assignedTo: { select: { name: true } },
          classStudents: { select: { classId: true, status: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const rows: StudentRow[] = enrollments.map((e) => ({
    id: e.id,
    leadId: e.leadId,
    fullName: e.fullName,
    cpf: e.cpf,
    rg: e.rg,
    phone: e.phone,
    phone2: e.phone2,
    email: e.email,
    birthDate: e.birthDate,
    courseId: e.courseId,
    courseName: e.course.name,
    classId: e.classId,
    className: e.class?.name ?? null,
    classCode: e.class?.code ?? null,
    enrolledAt: e.createdAt,
    totalAmount: Number(e.totalAmount),
    installments: e.installments,
    paymentMethod: e.paymentMethod,
    situacao: situacaoDoAluno(e.classId, e.lead.classStudents),
    source: e.lead.source,
    vendedor: e.lead.assignedTo?.name ?? null,
  }));

  const kpis: StudentKpis = {
    total: rows.length,
    ativos: rows.filter((r) => r.situacao === "ATIVA").length,
    concluidos: rows.filter((r) => r.situacao === "CONCLUIDA").length,
    trancados: rows.filter((r) => r.situacao === "TRANCADA").length,
    semTurma: rows.filter((r) => r.situacao === "SEM_TURMA").length,
    receita: rows.reduce((acc, r) => acc + r.totalAmount, 0),
  };

  return { rows, kpis };
}

/** Opções dos filtros (cursos e turmas) + total de alunos. */
export async function getStudentOptions() {
  const [courses, classes, total] = await Promise.all([
    prisma.course.findMany({
      where: { status: "ATIVO" },
      select: { id: true, name: true, price: true },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({
      select: { id: true, name: true, code: true, course: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.enrollment.count(),
  ]);

  return { courses, classes, total };
}

/** Ficha completa do aluno (matrícula + lead de origem + documentos + histórico). */
export async function getStudentDetail(enrollmentId: string) {
  return prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      course: { select: { id: true, name: true, price: true } },
      class: {
        select: {
          id: true,
          name: true,
          code: true,
          startDate: true,
          endDate: true,
          schedule: true,
          professor: { select: { id: true, name: true } },
        },
      },
      lead: {
        select: {
          id: true,
          fullName: true,
          source: true,
          status: true,
          salesStatus: true,
          createdAt: true,
          assignedTo: { select: { id: true, name: true } },
          campaign: { select: { id: true, name: true } },
          classStudents: {
            select: { id: true, classId: true, status: true, enrolledAt: true, finishedAt: true },
          },
          documents: {
            select: {
              id: true,
              type: true,
              fileName: true,
              mimeType: true,
              size: true,
              uploadedAt: true,
            },
            orderBy: { uploadedAt: "desc" },
          },
          followups: {
            select: {
              id: true,
              type: true,
              outcome: true,
              occurredAt: true,
              notes: true,
              user: { select: { name: true } },
            },
            orderBy: { occurredAt: "desc" },
            take: 20,
          },
          audits: {
            select: {
              id: true,
              action: true,
              details: true,
              createdAt: true,
              actor: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      },
    },
  });
}
