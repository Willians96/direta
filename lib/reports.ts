import { prisma } from "@/lib/prisma";

/**
 * Relatórios da direção.
 *
 * Consolida o resultado do período (leads → matrículas → receita) e compara
 * com as metas cadastradas em `Goal`.
 *
 * Obs.: a receita vem de `Enrollment.totalAmount` (valor efetivamente
 * contratado na matrícula) — e não do preço do curso, que é só referência.
 */

export const PERIODOS = [
  { value: "mes", label: "Mês atual" },
  { value: "mes-anterior", label: "Mês anterior" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "ano", label: "Este ano" },
] as const;

export type ReportFilters = {
  periodo?: string;
  mes?: string;
  ano?: string;
  vendedorId?: string;
  courseId?: string;
  campaignId?: string;
};

export type Period = {
  from: Date;
  to: Date;
  label: string;
  /** Meses cobertos — usados para somar as metas do período. */
  months: { month: number; year: number }[];
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function monthLabel(month: number, year: number): string {
  return `${MESES[month - 1]}/${year}`;
}

function monthRange(month: number, year: number) {
  return {
    from: new Date(year, month - 1, 1, 0, 0, 0, 0),
    to: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

/** Meses (mês/ano) que o intervalo de datas atravessa. */
function monthsInRange(from: Date, to: Date) {
  const list: { month: number; year: number }[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end) {
    list.push({ month: cur.getMonth() + 1, year: cur.getFullYear() });
    cur.setMonth(cur.getMonth() + 1);
  }
  return list;
}

export function resolvePeriod(filters: ReportFilters): Period {
  const now = new Date();
  const periodo = filters.periodo || "mes";
  const mes = Number(filters.mes) || now.getMonth() + 1;
  const ano = Number(filters.ano) || now.getFullYear();

  if (periodo === "mes-anterior") {
    const d = new Date(ano, mes - 2, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const { from, to } = monthRange(m, y);
    return { from, to, label: monthLabel(m, y), months: [{ month: m, year: y }] };
  }

  if (periodo === "30d" || periodo === "90d") {
    const dias = periodo === "30d" ? 30 : 90;
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const from = new Date(now);
    from.setDate(from.getDate() - (dias - 1));
    from.setHours(0, 0, 0, 0);
    return {
      from,
      to,
      label: `Últimos ${dias} dias`,
      months: monthsInRange(from, to),
    };
  }

  if (periodo === "ano") {
    const from = new Date(ano, 0, 1, 0, 0, 0, 0);
    const to = new Date(ano, 11, 31, 23, 59, 59, 999);
    return {
      from,
      to,
      label: `Ano de ${ano}`,
      months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, year: ano })),
    };
  }

  const { from, to } = monthRange(mes, ano);
  return { from, to, label: monthLabel(mes, ano), months: [{ month: mes, year: ano }] };
}

// ------------------------------------------------------------------ tipos

export type VendedorRow = {
  id: string;
  nome: string;
  role: string;
  leads: number;
  matriculas: number;
  receita: number;
  followups: number;
  metaMatricula: number;
  metaFaturamento: number;
  metaFollowup: number;
  atingimentoMatricula: number;
  atingimentoFaturamento: number;
  atingimentoFollowup: number;
};

export type CursoRow = {
  id: string;
  nome: string;
  leads: number;
  matriculas: number;
  conversao: number;
  receita: number;
  ticket: number;
};

export type CampanhaRow = {
  id: string;
  nome: string;
  canal: string;
  status: string;
  orcamento: number;
  leads: number;
  matriculas: number;
  conversao: number;
  receita: number;
  custoPorMatricula: number | null;
};

export type OrigemRow = {
  fonte: string;
  leads: number;
  matriculas: number;
  conversao: number;
};

export type MesRow = {
  label: string;
  month: number;
  year: number;
  leads: number;
  matriculas: number;
  receita: number;
};

export type ReportData = {
  period: Period;
  kpis: {
    leads: number;
    matriculas: number;
    conversao: number;
    receita: number;
    ticketMedio: number;
    followups: number;
    tempoMedioFechamento: number | null;
    orcamentoCampanhas: number;
  };
  porVendedor: VendedorRow[];
  porCurso: CursoRow[];
  porCampanha: CampanhaRow[];
  porOrigem: OrigemRow[];
  serie: MesRow[];
};

// ------------------------------------------------------------------ consulta

export async function getReportData(filters: ReportFilters): Promise<ReportData> {
  const period = resolvePeriod(filters);

  const leadWhere = {
    createdAt: { gte: period.from, lte: period.to },
    ...(filters.vendedorId ? { assignedToId: filters.vendedorId } : {}),
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
  };

  const [leads, enrollments, followups, goals, campaigns, courses, users] =
    await Promise.all([
      prisma.lead.findMany({
        where: leadWhere,
        select: {
          id: true,
          assignedToId: true,
          courseId: true,
          campaignId: true,
          source: true,
          createdAt: true,
        },
      }),
      prisma.enrollment.findMany({
        where: {
          createdAt: { gte: period.from, lte: period.to },
          lead: { is: leadWhere },
        },
        select: {
          leadId: true,
          courseId: true,
          totalAmount: true,
          createdAt: true,
          paymentMethod: true,
        },
      }),
      prisma.followup.findMany({
        where: {
          occurredAt: { gte: period.from, lte: period.to },
          ...(filters.vendedorId ? { userId: filters.vendedorId } : {}),
          ...(filters.courseId ? { lead: { is: { courseId: filters.courseId } } } : {}),
          ...(filters.campaignId
            ? { lead: { is: { campaignId: filters.campaignId } } }
            : {}),
        },
        select: { userId: true, leadId: true },
      }),
      prisma.goal.findMany({
        where: {
          OR: period.months.map((m) => ({ month: m.month, year: m.year })),
        },
        select: {
          userId: true,
          month: true,
          year: true,
          metaMatricula: true,
          metaFaturamento: true,
          metaFollowup: true,
        },
      }),
      prisma.campaign.findMany({
        select: {
          id: true,
          name: true,
          channel: true,
          status: true,
          budget: true,
        },
      }),
      prisma.course.findMany({
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        where: { role: { in: ["VENDAS", "CAPTACAO", "ADMIN"] } },
        select: { id: true, name: true, role: true, email: true, status: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const matriculaPorLead = new Map(enrollments.map((e) => [e.leadId, e]));

  // ---------------------------------------------------------------- KPIs
  const leadsCount = leads.length;
  const matriculasCount = enrollments.length;
  const receita = enrollments.reduce((acc, e) => acc + Number(e.totalAmount ?? 0), 0);
  const followupsCount = followups.length;

  // tempo médio de fechamento (dias entre a criação do lead e a matrícula)
  const diasFechamento = enrollments
    .map((e) => {
      const lead = leadById.get(e.leadId);
      if (!lead) return null;
      const dias = (e.createdAt.getTime() - lead.createdAt.getTime()) / 86_400_000;
      return dias >= 0 ? dias : null;
    })
    .filter((d): d is number => d !== null);
  const tempoMedioFechamento = diasFechamento.length
    ? Math.round(
        diasFechamento.reduce((a, b) => a + b, 0) / diasFechamento.length
      )
    : null;

  const orcamentoCampanhas = campaigns
    .filter((c) => c.budget && leads.some((l) => l.campaignId === c.id))
    .reduce((acc, c) => acc + Number(c.budget ?? 0), 0);

  // ------------------------------------------------- meta x realizado (vendedor)
  const metaPorUsuario = new Map<string, { mat: number; fat: number; fol: number }>();
  for (const g of goals) {
    const atual = metaPorUsuario.get(g.userId) ?? { mat: 0, fat: 0, fol: 0 };
    atual.mat += g.metaMatricula;
    atual.fat += Number(g.metaFaturamento ?? 0);
    atual.fol += g.metaFollowup;
    metaPorUsuario.set(g.userId, atual);
  }

  const porVendedor: VendedorRow[] = users
    .filter((u) => !filters.vendedorId || u.id === filters.vendedorId)
    .map((u) => {
      const leadsUsuario = leads.filter((l) => l.assignedToId === u.id);
      const matriculasUsuario = enrollments.filter((e) => {
        const lead = leadById.get(e.leadId);
        return lead?.assignedToId === u.id;
      });
      const receitaUsuario = matriculasUsuario.reduce(
        (acc, e) => acc + Number(e.totalAmount ?? 0),
        0
      );
      const followupsUsuario = followups.filter((f) => f.userId === u.id).length;
      const meta = metaPorUsuario.get(u.id) ?? { mat: 0, fat: 0, fol: 0 };

      return {
        id: u.id,
        nome: u.name,
        role: u.role,
        leads: leadsUsuario.length,
        matriculas: matriculasUsuario.length,
        receita: receitaUsuario,
        followups: followupsUsuario,
        metaMatricula: meta.mat,
        metaFaturamento: meta.fat,
        metaFollowup: meta.fol,
        atingimentoMatricula: meta.mat ? (matriculasUsuario.length / meta.mat) * 100 : 0,
        atingimentoFaturamento: meta.fat ? (receitaUsuario / meta.fat) * 100 : 0,
        atingimentoFollowup: meta.fol ? (followupsUsuario / meta.fol) * 100 : 0,
      };
    })
    .filter((r) => r.leads > 0 || r.matriculas > 0 || r.followups > 0 || r.metaMatricula > 0)
    .sort((a, b) => b.receita - a.receita || b.matriculas - a.matriculas);

  // ------------------------------------------------------------- por curso
  const nomeCurso = new Map(courses.map((c) => [c.id, c.name]));
  const porCursoMap = new Map<string, CursoRow>();
  for (const l of leads) {
    const key = l.courseId ?? "sem-curso";
    if (!porCursoMap.has(key)) {
      porCursoMap.set(key, {
        id: key,
        nome: key === "sem-curso" ? "Sem curso definido" : nomeCurso.get(key) ?? "—",
        leads: 0,
        matriculas: 0,
        conversao: 0,
        receita: 0,
        ticket: 0,
      });
    }
    porCursoMap.get(key)!.leads++;
  }
  for (const e of enrollments) {
    const key = e.courseId ?? "sem-curso";
    if (!porCursoMap.has(key)) {
      porCursoMap.set(key, {
        id: key,
        nome: nomeCurso.get(key) ?? "—",
        leads: 0,
        matriculas: 0,
        conversao: 0,
        receita: 0,
        ticket: 0,
      });
    }
    const linha = porCursoMap.get(key)!;
    linha.matriculas++;
    linha.receita += Number(e.totalAmount ?? 0);
  }
  const porCurso = [...porCursoMap.values()]
    .map((c) => ({
      ...c,
      conversao: c.leads ? (c.matriculas / c.leads) * 100 : 0,
      ticket: c.matriculas ? c.receita / c.matriculas : 0,
    }))
    .sort((a, b) => b.receita - a.receita || b.matriculas - a.matriculas);

  // ---------------------------------------------------------- por campanha
  const campanhaInfo = new Map(campaigns.map((c) => [c.id, c]));
  const porCampanhaMap = new Map<string, CampanhaRow>();
  for (const l of leads) {
    if (!l.campaignId) continue;
    if (!porCampanhaMap.has(l.campaignId)) {
      const info = campanhaInfo.get(l.campaignId);
      porCampanhaMap.set(l.campaignId, {
        id: l.campaignId,
        nome: info?.name ?? "—",
        canal: info?.channel ?? "—",
        status: info?.status ?? "—",
        orcamento: Number(info?.budget ?? 0),
        leads: 0,
        matriculas: 0,
        conversao: 0,
        receita: 0,
        custoPorMatricula: null,
      });
    }
    porCampanhaMap.get(l.campaignId)!.leads++;
  }
  for (const e of enrollments) {
    const lead = leadById.get(e.leadId);
    if (!lead?.campaignId) continue;
    const linha = porCampanhaMap.get(lead.campaignId);
    if (!linha) continue;
    linha.matriculas++;
    linha.receita += Number(e.totalAmount ?? 0);
  }
  const porCampanha = [...porCampanhaMap.values()]
    .map((c) => ({
      ...c,
      conversao: c.leads ? (c.matriculas / c.leads) * 100 : 0,
      custoPorMatricula:
        c.matriculas > 0 && c.orcamento > 0 ? c.orcamento / c.matriculas : null,
    }))
    .sort((a, b) => b.receita - a.receita || b.leads - a.leads);

  // ------------------------------------------------------------- por origem
  const origemMap = new Map<string, OrigemRow>();
  for (const l of leads) {
    const fonte = (l.source || "Não informado").trim();
    if (!origemMap.has(fonte)) {
      origemMap.set(fonte, { fonte, leads: 0, matriculas: 0, conversao: 0 });
    }
    origemMap.get(fonte)!.leads++;
  }
  for (const e of enrollments) {
    const lead = leadById.get(e.leadId);
    if (!lead) continue;
    const fonte = (lead.source || "Não informado").trim();
    const linha = origemMap.get(fonte);
    if (linha) linha.matriculas++;
  }
  const porOrigem = [...origemMap.values()]
    .map((o) => ({
      ...o,
      conversao: o.leads ? (o.matriculas / o.leads) * 100 : 0,
    }))
    .sort((a, b) => b.leads - a.leads);

  // ----------------------------------------------------------- série mensal
  const serieMap = new Map<string, MesRow>();
  for (const m of period.months) {
    const key = `${m.year}-${m.month}`;
    serieMap.set(key, {
      label: MESES[m.month - 1].slice(0, 3),
      month: m.month,
      year: m.year,
      leads: 0,
      matriculas: 0,
      receita: 0,
    });
  }
  for (const l of leads) {
    const key = `${l.createdAt.getFullYear()}-${l.createdAt.getMonth() + 1}`;
    const linha = serieMap.get(key);
    if (linha) linha.leads++;
  }
  for (const e of enrollments) {
    const key = `${e.createdAt.getFullYear()}-${e.createdAt.getMonth() + 1}`;
    const linha = serieMap.get(key);
    if (!linha) continue;
    linha.matriculas++;
    linha.receita += Number(e.totalAmount ?? 0);
  }

  return {
    period,
    kpis: {
      leads: leadsCount,
      matriculas: matriculasCount,
      conversao: leadsCount ? (matriculasCount / leadsCount) * 100 : 0,
      receita,
      ticketMedio: matriculasCount ? receita / matriculasCount : 0,
      followups: followupsCount,
      tempoMedioFechamento,
      orcamentoCampanhas,
    },
    porVendedor,
    porCurso,
    porCampanha,
    porOrigem,
    serie: [...serieMap.values()].sort((a, b) =>
      a.year === b.year ? a.month - b.month : a.year - b.year
    ),
  };
}

/** Opções para os filtros da tela. */
export async function getReportOptions() {
  const [users, courses, campaigns] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["VENDAS", "CAPTACAO", "ADMIN"] }, status: "ATIVO" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.course.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.campaign.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { users, courses, campaigns };
}
