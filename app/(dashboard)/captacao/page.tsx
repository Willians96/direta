import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Megaphone,
  UserPlus,
  PhoneCall,
  PauseCircle,
  Share2,
  Building2,
  GraduationCap,
  Target,
  CalendarDays,
  Info,
  Users,
  TrendingUp,
  ChevronRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import type { SalesStatus } from "@prisma/client";

/**
 * PAINEL DE CAPTAÇÃO — tela pedida pela cliente (PDF "4-dashboard CAPTAÇÃO"
 * e planilha SISTEMA WILLIAM / TELA CAPTAÇÃO).
 *
 * Blocos:
 *  1. TOTAL DIA — cadastrados / atendidos / sem atendimento
 *  2. VISÃO STATUS GERAL DAS VENDAS — matriz STATUS × VENDEDOR (+ TOTAL, MATR, % FECHA)
 *  3. FONTES PRIO — Indicação / Fachada / Ligação por vendedor (com MATR e % FECHA)
 *  4. FONTE (CONHECIMENTO) — clientes por forma de conhecimento
 *  5. ACIONADOS POR DIA — meta x entregue x falta por vendedor
 *  6. CLIENTES PARADOS POR DIA — quem está sem contato
 *  7. FICHA DA MATRÍCULA — REDE SOCIAL (seguidores) e EMPRESAS (cadastro)
 *  8. FECHAMENTO POR CURSO e POR VENDEDOR
 *  9. MÉTRICAS DE ANÚNCIO — investimento, clientes, matrículas e custo por cliente
 *
 * Os números do mês somam ao longo do mês; o relatório anual fica em
 * Administração > Relatórios.
 */

/** Linhas da matriz de status — mesma ordem da tela da cliente. */
const LINHAS_STATUS: { status: SalesStatus; label: string }[] = [
  { status: "NEGOCIANDO", label: "NEGOCIANDO" },
  { status: "MATRICULADO", label: "MATRICULADO" },
  { status: "RETORNAR", label: "RETORNAR" },
  { status: "BLOQUEIOU", label: "BLOQUEIOU" },
  { status: "FECHOU_CONCORRENTE", label: "FECHOU C/ CONCO" },
  { status: "FIN_SEM_RENDA", label: "FINANCEIRO S/ RENDA" },
  { status: "CIDADE_110KM", label: "CIDADE 110 KM" },
  { status: "OUTRA_UNIDADE", label: "OUTRA UNIDADE" },
  { status: "ADM_RESOLVER", label: "ADM RESOLVER" },
  { status: "DUPLICADO", label: "DUPLICADO" },
  { status: "OPORTUNIDADE_VENDAS", label: "OPORTUNIDADE VENDAS" },
  { status: "VISITA", label: "VISITA" },
];

/** Fontes com prioridade no acompanhamento da cliente. */
const FONTES_PRIO = [
  { rotulo: "INDICAÇÃO", nome: "Indicação" },
  { rotulo: "FACHADA", nome: "Fachada" },
  { rotulo: "LIGAÇÃO", nome: "Ligação" },
];

/** Status que encerram o ciclo — o lead não é considerado "parado". */
const STATUS_ENCERRADOS: SalesStatus[] = [
  "MATRICULADO",
  "BLOQUEIOU",
  "FECHOU_CONCORRENTE",
  "FIN_SEM_RENDA",
  "OUTRA_UNIDADE",
  "DUPLICADO",
];

function pct(parte: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((parte / total) * 100)}%`;
}

function chaveMes(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Data no formato AAAA-MM-DD usando o fuso local do servidor. */
function dataKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default async function CaptacaoDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session?.user as any)?.role as string | undefined;
  if (role !== "ADMIN" && role !== "CAPTACAO") redirect("/");

  const params = await searchParams;
  const agora = new Date();

  // Mês de referência (YYYY-MM). Padrão: mês atual.
  let ano = agora.getFullYear();
  let mes = agora.getMonth() + 1;
  if (params.mes && /^\d{4}-\d{2}$/.test(params.mes)) {
    const [a, m] = params.mes.split("-").map(Number);
    ano = a;
    mes = m;
  }
  const inicioMes = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
  const fimMes = new Date(ano, mes, 0, 23, 59, 59, 999);
  const hoje = new Date();
  const inicioHoje = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate(),
    0,
    0,
    0,
    0
  );

  const [
    vendedores,
    leadsPipeline,
    leadsMes,
    matriculas,
    followupsMes,
    metas,
    fontes,
    campanhas,
    cursos,
    leadsDoMesPorFonte,
  ] = await Promise.all([
    // Vendedores (equipe de vendas)
    prisma.user.findMany({
      where: { role: "VENDAS" },
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    }),
    // Pipeline atual (todos os leads) — base da matriz de status
    prisma.lead.findMany({
      select: {
        id: true,
        fullName: true,
        phone: true,
        salesStatus: true,
        status: true,
        assignedToId: true,
        createdAt: true,
        updatedAt: true,
        followups: {
          select: { occurredAt: true },
          orderBy: { occurredAt: "desc" },
          take: 1,
        },
      },
    }),
    // Leads criados no mês (base das somas mensais)
    prisma.lead.findMany({
      where: { createdAt: { gte: inicioMes, lte: fimMes } },
      select: {
        id: true,
        fullName: true,
        salesStatus: true,
        status: true,
        source: true,
        sourceId: true,
        assignedToId: true,
        courseId: true,
        campaignId: true,
        createdAt: true,
      },
    }),
    // Matrículas (base dos blocos REDE SOCIAL / EMPRESAS e do fechamento)
    prisma.enrollment.findMany({
      select: {
        id: true,
        enrolledById: true,
        createdAt: true,
        courseId: true,
        socialNetwork: true,
        company: true,
        lead: { select: { source: true, assignedToId: true, campaignId: true } },
      },
    }),
    // Acionamentos (follow-ups) do mês
    prisma.followup.findMany({
      where: { occurredAt: { gte: inicioMes, lte: fimMes } },
      select: { id: true, userId: true, occurredAt: true, leadId: true },
    }),
    // Metas do mês por vendedor
    prisma.goal.findMany({
      where: { month: mes, year: ano },
      select: { userId: true, metaMatricula: true, metaFollowup: true },
    }),
    // Formas de conhecimento (cadastro oficial)
    prisma.leadSource.findMany({
      orderBy: [{ active: "desc" }, { description: "asc" }],
      select: {
        id: true,
        description: true,
        active: true,
        noCommission: true,
        _count: { select: { leads: true } },
      },
    }),
    // Campanhas (investimento em anúncio)
    prisma.campaign.findMany({
      select: {
        id: true,
        name: true,
        channel: true,
        budget: true,
        status: true,
        createdAt: true,
        _count: { select: { leads: true } },
      },
    }),
    // Cursos
    prisma.course.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Contagem por fonte no mês (texto da fonte)
    prisma.lead.groupBy({
      by: ["source"],
      where: { createdAt: { gte: inicioMes, lte: fimMes } },
      _count: { _all: true },
    }),
  ]);

  const idsVendedores = vendedores.map((v) => v.id);
  const nomePorVendedor = new Map(vendedores.map((v) => [v.id, v.name]));

  // ---------- 1. TOTAL DIA ----------
  const cadastradosHoje = leadsPipeline.filter(
    (l) => l.createdAt >= inicioHoje
  ).length;
  const atendidosHoje = followupsMes.filter(
    (f) => f.occurredAt >= inicioHoje
  ).length;
  const semAtendimentoHoje = leadsPipeline.filter(
    (l) =>
      !STATUS_ENCERRADOS.includes(l.salesStatus) &&
      (!l.followups[0] || l.followups[0].occurredAt < inicioHoje)
  ).length;

  // ---------- 2. MATRIZ STATUS × VENDEDOR (pipeline atual) ----------
  const statusPorVendedor = new Map<string, number>();
  const totalPorVendedor = new Map<string, number>();
  const inativosPorVendedor = new Map<string, number>();
  const quartoCttPorVendedor = new Map<string, number>();

  for (const lead of leadsPipeline) {
    const vendedor = lead.assignedToId ?? "__sem__";
    totalPorVendedor.set(
      vendedor,
      (totalPorVendedor.get(vendedor) ?? 0) + 1
    );
    const chave = `${vendedor}|${lead.salesStatus}`;
    statusPorVendedor.set(chave, (statusPorVendedor.get(chave) ?? 0) + 1);
    if (lead.status === "INATIVO") {
      inativosPorVendedor.set(
        vendedor,
        (inativosPorVendedor.get(vendedor) ?? 0) + 1
      );
    }
    if (lead.status === "QUARTO_CONTATO") {
      quartoCttPorVendedor.set(
        vendedor,
        (quartoCttPorVendedor.get(vendedor) ?? 0) + 1
      );
    }
  }

  const contagemStatus = (vendedor: string, status: SalesStatus) =>
    statusPorVendedor.get(`${vendedor}|${status}`) ?? 0;

  // Matrículas por vendedor (acumulado do sistema)
  const matrPorVendedor = new Map<string, number>();
  for (const m of matriculas) {
    matrPorVendedor.set(
      m.enrolledById,
      (matrPorVendedor.get(m.enrolledById) ?? 0) + 1
    );
  }

  // ---------- 3. FONTES PRIO ----------
  const fonteDeLead = (lead: { source?: string | null }) =>
    (lead.source ?? "").trim().toLowerCase();

  const blocoPrio = FONTES_PRIO.map((f) => {
    const leadsDaFonte = leadsMes.filter(
      (l) => fonteDeLead(l) === f.nome.toLowerCase()
    );
    const leadsPorVendedor = new Map<string, number>();
    for (const l of leadsDaFonte) {
      const v = l.assignedToId ?? "__sem__";
      leadsPorVendedor.set(v, (leadsPorVendedor.get(v) ?? 0) + 1);
    }
    const matrPorVendedorFonte = new Map<string, number>();
    for (const m of matriculas) {
      if (m.createdAt < inicioMes || m.createdAt > fimMes) continue;
      if (fonteDeLead(m.lead) !== f.nome.toLowerCase()) continue;
      matrPorVendedorFonte.set(
        m.enrolledById,
        (matrPorVendedorFonte.get(m.enrolledById) ?? 0) + 1
      );
    }
    return {
      ...f,
      leadsPorVendedor,
      matrPorVendedor: matrPorVendedorFonte,
      total: leadsDaFonte.length,
    };
  });

  // ---------- 4. FONTE (CONHECIMENTO) ----------
  const contagemFonteMes = new Map<string, number>();
  for (const g of leadsDoMesPorFonte) {
    const chave = (g.source ?? "").trim() || "Não informado";
    contagemFonteMes.set(
      chave,
      (contagemFonteMes.get(chave) ?? 0) + g._count._all
    );
  }
  const totalClientesMes = leadsMes.length;

  const linhasFonte = [
    ...fontes.map((f) => ({
      descricao: f.description,
      ativo: f.active,
      semComissao: f.noCommission,
      clientes: contagemFonteMes.get(f.description) ?? 0,
      totalGeral: f._count.leads,
    })),
    ...(() => {
      // Fontes antigas (texto livre) que não estão no cadastro
      const cadastradas = new Set(fontes.map((f) => f.description));
      const extras = [...contagemFonteMes.entries()].filter(
        ([desc]) => !cadastradas.has(desc)
      );
      return extras.map(([descricao, clientes]) => ({
        descricao,
        ativo: true,
        semComissao: false,
        clientes,
        totalGeral: clientes,
      }));
    })(),
  ].sort((a, b) => b.clientes - a.clientes || a.descricao.localeCompare(b.descricao));

  // ---------- 5. ACIONADOS POR DIA ----------
  const acionadosPorVendedor = new Map<string, number>();
  const acionadosPorDia = new Map<string, number>(); // chave: userId|data
  for (const f of followupsMes) {
    acionadosPorVendedor.set(
      f.userId,
      (acionadosPorVendedor.get(f.userId) ?? 0) + 1
    );
    const dia = dataKey(f.occurredAt);
    const chave = `${f.userId}|${dia}`;
    acionadosPorDia.set(chave, (acionadosPorDia.get(chave) ?? 0) + 1);
  }
  const metaFollowup = new Map(
    metas.map((m) => [m.userId, m.metaFollowup] as const)
  );

  // Grade dos últimos 10 dias do mês escolhido
  const gradeDias: { iso: string; rotulo: string }[] = [];
  const ultimoDia = fimMes.getDate();
  for (let i = 9; i >= 0; i--) {
    const diaNum = ultimoDia - i;
    if (diaNum < 1) continue;
    gradeDias.push({
      iso: `${ano}-${String(mes).padStart(2, "0")}-${String(diaNum).padStart(2, "0")}`,
      rotulo: `${String(diaNum).padStart(2, "0")}/${String(mes).padStart(2, "0")}`,
    });
  }

  // ---------- 6. CLIENTES PARADOS ----------
  // Lead "parado" = continua em aberto e está sem contato há mais de 2 dias.
  const DIAS_PARADO = 2;
  const paradosPorVendedor = new Map<string, number>();
  const leadsParadosDetalhe: { nome: string; vendedor: string; dias: number }[] = [];

  // Último contato de cada lead (com o dado já trazido na consulta)
  const ultimoContatoDe = new Map<string, Date>();
  for (const lead of leadsPipeline) {
    ultimoContatoDe.set(
      lead.id,
      lead.followups[0]?.occurredAt ?? lead.createdAt
    );
  }

  for (const lead of leadsPipeline) {
    if (STATUS_ENCERRADOS.includes(lead.salesStatus)) continue;
    const ultimoContato = ultimoContatoDe.get(lead.id)!;
    const diasParado = Math.floor(
      (hoje.getTime() - ultimoContato.getTime()) / (24 * 60 * 60 * 1000)
    );
    if (diasParado <= DIAS_PARADO) continue;
    const vendedor = lead.assignedToId ?? "__sem__";
    paradosPorVendedor.set(
      vendedor,
      (paradosPorVendedor.get(vendedor) ?? 0) + 1
    );
    leadsParadosDetalhe.push({
      nome: lead.fullName,
      vendedor: nomePorVendedor.get(vendedor) ?? "Sem vendedor",
      dias: diasParado,
    });
  }
  leadsParadosDetalhe.sort((a, b) => b.dias - a.dias);

  // Grade diária de parados: para cada dia, quem estava sem contato há
  // mais de 2 dias (mesma lógica da tela da cliente).
  const gradeParados = gradeDias.map((dia) => {
    const [a, m, d] = dia.iso.split("-").map(Number);
    const inicioDia = new Date(a, m - 1, d, 0, 0, 0, 0);
    const limite = inicioDia.getTime() - DIAS_PARADO * 24 * 60 * 60 * 1000;
    const porVendedor = new Map<string, number>();
    for (const lead of leadsPipeline) {
      if (STATUS_ENCERRADOS.includes(lead.salesStatus)) continue;
      if (lead.createdAt > inicioDia) continue;
      const ultimoContato = ultimoContatoDe.get(lead.id)!;
      if (ultimoContato.getTime() >= limite) continue;
      const vendedor = lead.assignedToId ?? "__sem__";
      porVendedor.set(vendedor, (porVendedor.get(vendedor) ?? 0) + 1);
    }
    return { ...dia, porVendedor };
  });

  // ---------- 7. REDE SOCIAL e EMPRESAS ----------
  const blocoMatricula = (rotulo: string, campo: "socialNetwork" | "company") => {
    const porVendedor = new Map<string, { matr: number; origem: number }>();
    let totalMatr = 0;
    let totalOrigem = 0;
    for (const m of matriculas) {
      if (m.createdAt < inicioMes || m.createdAt > fimMes) continue;
      const origem = (m[campo] ?? "").trim() ? 1 : 0;
      const atual = porVendedor.get(m.enrolledById) ?? { matr: 0, origem: 0 };
      atual.matr += 1;
      atual.origem += origem;
      porVendedor.set(m.enrolledById, atual);
      totalMatr += 1;
      totalOrigem += origem;
    }
    return { rotulo, porVendedor, totalMatr, totalOrigem };
  };

  const blocoRedeSocial = blocoMatricula("SEGUIDORES (rede social)", "socialNetwork");
  const blocoEmpresas = blocoMatricula("CADASTRO (empresa)", "company");

  // ---------- 8. FECHAMENTO POR CURSO ----------
  const fechamentoCurso = cursos.map((curso) => {
    const leadsDoCurso = leadsMes.filter((l) => l.courseId === curso.id);
    const matrDoCurso = matriculas.filter(
      (m) =>
        m.courseId === curso.id &&
        m.createdAt >= inicioMes &&
        m.createdAt <= fimMes
    ).length;
    const porStatus = (status: SalesStatus) =>
      leadsDoCurso.filter((l) => l.salesStatus === status).length;
    return {
      curso,
      total: leadsDoCurso.length,
      matr: matrDoCurso,
      status: {
        QUARTO_CONTATO: leadsDoCurso.filter(
          (l) => l.status === "QUARTO_CONTATO"
        ).length,
        ADM_RESOLVER: porStatus("ADM_RESOLVER"),
        BLOQUEIOU: porStatus("BLOQUEIOU"),
        FECHOU_CONCORRENTE: porStatus("FECHOU_CONCORRENTE"),
        FIN_SEM_RENDA: porStatus("FIN_SEM_RENDA"),
        NEGOCIANDO: porStatus("NEGOCIANDO"),
        OPORTUNIDADE_VENDAS: porStatus("OPORTUNIDADE_VENDAS"),
        DUPLICADO: porStatus("DUPLICADO"),
        INATIVO: leadsDoCurso.filter((l) => l.status === "INATIVO").length,
      },
    };
  });

  // ---------- 8b. FECHAMENTO POR VENDEDOR ----------
  const fechamentoVendedor = cursos.map((curso) => {
    const leadsDoCurso = leadsMes.filter((l) => l.courseId === curso.id);
    const leadsPorVendedor: Record<string, number> = {};
    for (const l of leadsDoCurso) {
      const v = l.assignedToId ?? "__sem__";
      leadsPorVendedor[v] = (leadsPorVendedor[v] ?? 0) + 1;
    }
    const matrPorVendedorCurso: Record<string, number> = {};
    for (const m of matriculas) {
      if (m.courseId !== curso.id) continue;
      if (m.createdAt < inicioMes || m.createdAt > fimMes) continue;
      matrPorVendedorCurso[m.enrolledById] =
        (matrPorVendedorCurso[m.enrolledById] ?? 0) + 1;
    }
    const matrTotal = Object.values(matrPorVendedorCurso).reduce(
      (a, b) => a + b,
      0
    );
    return {
      curso,
      total: leadsDoCurso.length,
      matr: matrTotal,
      leadsPorVendedor,
      matrPorVendedor: matrPorVendedorCurso,
    };
  });

  // ---------- 9. MÉTRICAS DE ANÚNCIO ----------
  const campanhasDoMes = campanhas.filter(
    (c) => c.createdAt >= inicioMes && c.createdAt <= fimMes
  );
  const investimentoTotal = campanhasDoMes.reduce(
    (acc, c) => acc + Number(c.budget ?? 0),
    0
  );
  const clientesAnuncios = campanhasDoMes.reduce(
    (acc, c) => acc + c._count.leads,
    0
  );
  const matrAnuncios = matriculas.filter(
    (m) =>
      m.createdAt >= inicioMes &&
      m.createdAt <= fimMes &&
      m.lead.campaignId &&
      campanhasDoMes.some((c) => c.id === m.lead.campaignId)
  ).length;

  // Meses disponíveis no seletor (últimos 12 meses + o atual)
  const mesesDisponiveis: { chave: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(ano, mes - 1 - i, 1);
    mesesDisponiveis.push({
      chave: chaveMes(d),
      label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    });
  }

  const rotuloMes = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const ehMesAtual = mes === agora.getMonth() + 1 && ano === agora.getFullYear();

  return (
    <div>
      <PageHeader
        title="Painel de Captação"
        description={`Visão geral das vendas · ${rotuloMes}`}
        icon={Megaphone}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/captacao/leads">
                <UserPlus className="mr-2 h-4 w-4" />
                Leads
              </Link>
            </Button>
            <Button asChild>
              <Link href="/captacao/leads/novo">
                <UserPlus className="mr-2 h-4 w-4" />
                Novo lead
              </Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* Seletor de mês */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <select
              name="mes"
              defaultValue={`${ano}-${String(mes).padStart(2, "0")}`}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
              aria-label="Mês de referência"
            >
              {mesesDisponiveis.map((m) => (
                <option key={m.chave} value={m.chave}>
                  {m.label}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="outline">
              Ver
            </Button>
          </form>
          <p className="text-[11px] text-slate-500">
            {ehMesAtual
              ? "Os números deste mês somam ao longo do mês — o acumulado do ano fica em Administração › Relatórios."
              : `Fechamento de ${rotuloMes}.`}
          </p>
        </div>

        {/* 1. TOTAL DIA */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Clientes cadastrados (hoje)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-800">{cadastradosHoje}</p>
              <p className="text-xs text-slate-500">
                {totalClientesMes} no mês · {leadsPipeline.length} no total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Clientes atendidos (hoje)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600">{atendidosHoje}</p>
              <p className="text-xs text-slate-500">
                {followupsMes.length} acionamentos no mês
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Clientes sem atendimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-600">
                {semAtendimentoHoje}
              </p>
              <p className="text-xs text-slate-500">
                Sem contato há mais de {DIAS_PARADO} dias
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 2. VISÃO STATUS GERAL DAS VENDAS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visão status geral das vendas</CardTitle>
            <CardDescription>
              Situação atual de cada cliente por vendedor — acompanha em tempo real quem
              precisa de contato.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Status de vendas</th>
                    {vendedores.map((v) => (
                      <th key={v.id} className="px-3 py-3 text-center">
                        {v.name}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {/* Total válido */}
                  <tr className="bg-slate-50/60 font-semibold">
                    <td className="px-3 py-2.5">TOTAL VÁLIDO</td>
                    {vendedores.map((v) => (
                      <td key={v.id} className="px-3 py-2.5 text-center">
                        {totalPorVendedor.get(v.id) ?? 0}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center">
                      {leadsPipeline.length}
                    </td>
                  </tr>

                  {/* Linhas por status */}
                  {LINHAS_STATUS.map((linha) => {
                    const totalLinha = vendedores.reduce(
                      (acc, v) => acc + contagemStatus(v.id, linha.status),
                      0
                    );
                    return (
                      <tr key={linha.status}>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                          {linha.label}
                        </td>
                        {vendedores.map((v) => (
                          <td key={v.id} className="px-3 py-2 text-center">
                            {contagemStatus(v.id, linha.status)}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center font-medium">
                          {totalLinha}
                        </td>
                      </tr>
                    );
                  })}

                  {/* 4º CTT / INATIVO */}
                  <tr>
                    <td className="px-3 py-2 text-slate-600">4º CTT - ATIVOS</td>
                    {vendedores.map((v) => (
                      <td key={v.id} className="px-3 py-2 text-center">
                        {quartoCttPorVendedor.get(v.id) ?? 0}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-medium">
                      {vendedores.reduce(
                        (acc, v) => acc + (quartoCttPorVendedor.get(v.id) ?? 0),
                        0
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-600">INATIVO GERAL</td>
                    {vendedores.map((v) => (
                      <td key={v.id} className="px-3 py-2 text-center">
                        {inativosPorVendedor.get(v.id) ?? 0}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-medium">
                      {vendedores.reduce(
                        (acc, v) => acc + (inativosPorVendedor.get(v.id) ?? 0),
                        0
                      )}
                    </td>
                  </tr>

                  {/* Matrículas e % de fechamento */}
                  <tr className="bg-emerald-50/60">
                    <td className="px-3 py-2.5 font-semibold text-emerald-800">
                      MATR RANKING
                    </td>
                    {vendedores.map((v) => (
                      <td key={v.id} className="px-3 py-2.5 text-center font-semibold text-emerald-800">
                        {matrPorVendedor.get(v.id) ?? 0}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center font-semibold text-emerald-800">
                      {matriculas.length}
                    </td>
                  </tr>
                  <tr className="bg-emerald-50/60">
                    <td className="px-3 py-2.5 font-semibold text-emerald-800">
                      % FECHA
                    </td>
                    {vendedores.map((v) => (
                      <td key={v.id} className="px-3 py-2.5 text-center text-emerald-800">
                        {pct(
                          matrPorVendedor.get(v.id) ?? 0,
                          totalPorVendedor.get(v.id) ?? 0
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center font-semibold text-emerald-800">
                      {pct(matriculas.length, leadsPipeline.length)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 3. FONTES PRIO */}
        <div className="grid gap-4 lg:grid-cols-3">
          {blocoPrio.map((bloco) => (
            <Card key={bloco.rotulo}>
              <CardHeader>
                <CardTitle className="text-base">{bloco.rotulo}</CardTitle>
                <CardDescription>
                  {bloco.total} cliente{bloco.total === 1 ? "" : "s"} no mês
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Vendedor</th>
                      <th className="px-3 py-2 text-center">Clientes</th>
                      <th className="px-3 py-2 text-center">Matr.</th>
                      <th className="px-3 py-2 text-center">% Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {vendedores.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-xs text-slate-500">
                          Nenhum vendedor cadastrado
                        </td>
                      </tr>
                    ) : (
                      <>
                        {vendedores.map((v) => {
                          const clientes = bloco.leadsPorVendedor.get(v.id) ?? 0;
                          const matr = bloco.matrPorVendedor.get(v.id) ?? 0;
                          return (
                            <tr key={v.id}>
                              <td className="px-3 py-2 text-slate-700">{v.name}</td>
                              <td className="px-3 py-2 text-center">{clientes}</td>
                              <td className="px-3 py-2 text-center">{matr}</td>
                              <td className="px-3 py-2 text-center text-slate-600">
                                {pct(matr, clientes)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-50 font-semibold">
                          <td className="px-3 py-2">TOTAL</td>
                          <td className="px-3 py-2 text-center">{bloco.total}</td>
                          <td className="px-3 py-2 text-center">
                            {[...bloco.matrPorVendedor.values()].reduce(
                              (a, b) => a + b,
                              0
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {pct(
                              [...bloco.matrPorVendedor.values()].reduce(
                                (a, b) => a + b,
                                0
                              ),
                              bloco.total
                            )}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 4. FONTE (CONHECIMENTO) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Fonte (conhecimento)</CardTitle>
              <CardDescription>
                Como o cliente conheceu a escola — {totalClientesMes} clientes no mês
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/captacao/fontes">
                Cadastrar fontes
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {linhasFonte.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">
                Nenhuma forma de conhecimento cadastrada ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3">Forma de conhecimento</th>
                      <th className="px-3 py-3 text-center">Clientes (mês)</th>
                      <th className="px-3 py-3 text-center">Total geral</th>
                      <th className="px-3 py-3 text-center">% do mês</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {linhasFonte.map((f) => (
                      <tr key={f.descricao} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">
                              {f.descricao}
                            </span>
                            {!f.ativo && (
                              <Badge variant="neutral">Inativa</Badge>
                            )}
                            {f.semComissao && (
                              <Badge variant="warning">Sem comissão</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center font-medium">
                          {f.clientes}
                        </td>
                        <td className="px-3 py-2.5 text-center text-slate-600">
                          {f.totalGeral}
                        </td>
                        <td className="px-3 py-2.5 text-center text-slate-600">
                          {pct(f.clientes, totalClientesMes)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-3 py-2.5">TOTAL</td>
                      <td className="px-3 py-2.5 text-center">
                        {linhasFonte.reduce((a, b) => a + b.clientes, 0)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {linhasFonte.reduce((a, b) => a + b.totalGeral, 0)}
                      </td>
                      <td className="px-3 py-2.5 text-center">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. ACIONADOS POR DIA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PhoneCall className="h-4 w-4 text-direta-orange" />
              Acionados por dia
            </CardTitle>
            <CardDescription>
              Meta de acionamentos do mês x o que a equipe já fez
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Equipe</th>
                    <th className="px-3 py-3 text-center">Meta</th>
                    <th className="px-3 py-3 text-center">Entregue</th>
                    <th className="px-3 py-3 text-center">Falta</th>
                    <th className="px-3 py-3 text-center">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {vendedores.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                        Nenhum vendedor cadastrado
                      </td>
                    </tr>
                  ) : (
                    <>
                      {vendedores.map((v) => {
                        const meta = metaFollowup.get(v.id) ?? 0;
                        const entregue = acionadosPorVendedor.get(v.id) ?? 0;
                        const falta = meta - entregue;
                        return (
                          <tr key={v.id}>
                            <td className="px-3 py-2.5 font-medium text-slate-800">
                              {v.name}
                            </td>
                            <td className="px-3 py-2.5 text-center">{meta}</td>
                            <td className="px-3 py-2.5 text-center font-medium text-emerald-700">
                              {entregue}
                            </td>
                            <td
                              className={`px-3 py-2.5 text-center font-medium ${
                                falta > 0 ? "text-red-600" : "text-slate-500"
                              }`}
                            >
                              {falta > 0 ? falta : 0}
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-600">
                              {pct(entregue, meta)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50 font-semibold">
                        <td className="px-3 py-2.5">TOTAL</td>
                        <td className="px-3 py-2.5 text-center">
                          {vendedores.reduce(
                            (acc, v) => acc + (metaFollowup.get(v.id) ?? 0),
                            0
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {followupsMes.length}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {vendedores.reduce(
                            (acc, v) =>
                              acc +
                              Math.max(
                                0,
                                (metaFollowup.get(v.id) ?? 0) -
                                  (acionadosPorVendedor.get(v.id) ?? 0)
                              ),
                            0
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {pct(
                            followupsMes.length,
                            vendedores.reduce(
                              (acc, v) => acc + (metaFollowup.get(v.id) ?? 0),
                              0
                            )
                          )}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Grade diária de acionamentos */}
            {gradeDias.length > 0 && (
              <div className="border-t">
                <p className="px-3 pt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Acionamentos por dia
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Dia</th>
                        {vendedores.map((v) => (
                          <th key={v.id} className="px-3 py-2 text-center">
                            {v.name}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {gradeDias.map((dia) => {
                        const total = vendedores.reduce(
                          (acc, v) =>
                            acc + (acionadosPorDia.get(`${v.id}|${dia.iso}`) ?? 0),
                          0
                        );
                        return (
                          <tr key={dia.iso}>
                            <td className="px-3 py-1.5 text-slate-600">
                              {dia.rotulo}
                            </td>
                            {vendedores.map((v) => (
                              <td key={v.id} className="px-3 py-1.5 text-center">
                                {acionadosPorDia.get(`${v.id}|${dia.iso}`) ?? 0}
                              </td>
                            ))}
                            <td className="px-3 py-1.5 text-center font-medium">
                              {total}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 6. CLIENTES PARADOS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PauseCircle className="h-4 w-4 text-amber-500" />
              Clientes parados
            </CardTitle>
            <CardDescription>
              Em aberto e sem contato há mais de {DIAS_PARADO} dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Grade diária de parados */}
            {gradeParados.length > 0 && (
              <div className="mb-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Dia</th>
                      {vendedores.map((v) => (
                        <th key={v.id} className="px-3 py-2 text-center">
                          {v.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {gradeParados.map((dia) => (
                      <tr key={dia.iso}>
                        <td className="px-3 py-1.5 text-slate-600">{dia.rotulo}</td>
                        {vendedores.map((v) => {
                          const qtd = dia.porVendedor.get(v.id) ?? 0;
                          return (
                            <td
                              key={v.id}
                              className={`px-3 py-1.5 text-center ${
                                qtd > 0 ? "font-medium text-amber-700" : "text-slate-400"
                              }`}
                            >
                              {qtd > 0 ? qtd : "OK"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {leadsParadosDetalhe.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">
                Nenhum cliente parado. Time em dia!
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  {vendedores.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-md border bg-white p-3"
                    >
                      <span className="text-sm font-medium text-slate-800">
                        {v.name}
                      </span>
                      <Badge
                        variant={
                          (paradosPorVendedor.get(v.id) ?? 0) > 0
                            ? "warning"
                            : "success"
                        }
                      >
                        {paradosPorVendedor.get(v.id) ?? 0} parados
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Sem contato há mais tempo
                  </p>
                  {leadsParadosDetalhe.slice(0, 8).map((l, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md border bg-white p-2"
                    >
                      <span className="truncate text-sm text-slate-700">{l.nome}</span>
                      <span className="ml-2 whitespace-nowrap text-xs text-slate-500">
                        {l.vendedor} · {l.dias}d
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 7. FICHA DA MATRÍCULA — REDE SOCIAL e EMPRESAS */}
        <div className="grid gap-4 lg:grid-cols-2">
          {[blocoRedeSocial, blocoEmpresas].map((bloco) => (
            <Card key={bloco.rotulo}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {bloco.rotulo.startsWith("SEGUIDORES") ? (
                    <Share2 className="h-4 w-4 text-direta-orange" />
                  ) : (
                    <Building2 className="h-4 w-4 text-direta-orange" />
                  )}
                  Ficha da matrícula — {bloco.rotulo}
                </CardTitle>
                <CardDescription>
                  Quantas matrículas do mês vieram por esta origem
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Vendedor</th>
                      <th className="px-3 py-2 text-center">Qtd matr.</th>
                      <th className="px-3 py-2 text-center">
                        {bloco.rotulo.startsWith("SEGUIDORES") ? "Seguidores" : "Cadastro"}
                      </th>
                      <th className="px-3 py-2 text-center">Não passou</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {vendedores.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-xs text-slate-500">
                          Nenhum vendedor cadastrado
                        </td>
                      </tr>
                    ) : (
                      <>
                        {vendedores.map((v) => {
                          const dados = bloco.porVendedor.get(v.id) ?? {
                            matr: 0,
                            origem: 0,
                          };
                          const naoPassou = dados.matr - dados.origem;
                          return (
                            <tr key={v.id}>
                              <td className="px-3 py-2 text-slate-700">{v.name}</td>
                              <td className="px-3 py-2 text-center">{dados.matr}</td>
                              <td className="px-3 py-2 text-center font-medium text-emerald-700">
                                {dados.origem}
                              </td>
                              <td
                                className={`px-3 py-2 text-center ${
                                  naoPassou > 0 ? "text-red-600" : "text-slate-500"
                                }`}
                              >
                                {naoPassou > 0 ? naoPassou : 0}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-50 font-semibold">
                          <td className="px-3 py-2">TOTAL</td>
                          <td className="px-3 py-2 text-center">{bloco.totalMatr}</td>
                          <td className="px-3 py-2 text-center text-emerald-700">
                            {bloco.totalOrigem}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {bloco.totalMatr - bloco.totalOrigem}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
                <div className="border-t px-3 py-2 text-right text-sm text-slate-600">
                  {pct(bloco.totalOrigem, bloco.totalMatr)} do total de matrículas
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 8. FECHAMENTO POR CURSO */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-4 w-4 text-direta-orange" />
              Fechamento por curso
            </CardTitle>
            <CardDescription>
              {rotuloMes} — leads do mês por curso e situação do cliente
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Curso</th>
                    <th className="px-3 py-3 text-center">Total</th>
                    <th className="px-3 py-3 text-center">Matr.</th>
                    <th className="px-3 py-3 text-center">% Fech.</th>
                    <th className="px-3 py-3 text-center">4º CTT</th>
                    <th className="px-3 py-3 text-center">ADM</th>
                    <th className="px-3 py-3 text-center">Bloq.</th>
                    <th className="px-3 py-3 text-center">Concor.</th>
                    <th className="px-3 py-3 text-center">S/Renda</th>
                    <th className="px-3 py-3 text-center">Neg.</th>
                    <th className="px-3 py-3 text-center">Oport.</th>
                    <th className="px-3 py-3 text-center">Inat.</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fechamentoCurso.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-3 py-6 text-center text-sm text-slate-500">
                        Nenhum curso cadastrado
                      </td>
                    </tr>
                  ) : (
                    fechamentoCurso.map((linha) => (
                      <tr key={linha.curso.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-medium text-slate-800">
                          {linha.curso.name}
                        </td>
                        <td className="px-3 py-2.5 text-center">{linha.total}</td>
                        <td className="px-3 py-2.5 text-center font-medium text-emerald-700">
                          {linha.matr}
                        </td>
                        <td className="px-3 py-2.5 text-center text-slate-600">
                          {pct(linha.matr, linha.total)}
                        </td>
                        <td className="px-3 py-2.5 text-center">{linha.status.QUARTO_CONTATO}</td>
                        <td className="px-3 py-2.5 text-center">{linha.status.ADM_RESOLVER}</td>
                        <td className="px-3 py-2.5 text-center">{linha.status.BLOQUEIOU}</td>
                        <td className="px-3 py-2.5 text-center">
                          {linha.status.FECHOU_CONCORRENTE}
                        </td>
                        <td className="px-3 py-2.5 text-center">{linha.status.FIN_SEM_RENDA}</td>
                        <td className="px-3 py-2.5 text-center">{linha.status.NEGOCIANDO}</td>
                        <td className="px-3 py-2.5 text-center">
                          {linha.status.OPORTUNIDADE_VENDAS}
                        </td>
                        <td className="px-3 py-2.5 text-center">{linha.status.INATIVO}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 8b. FECHAMENTO POR VENDEDOR */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-direta-orange" />
              Fechamento por vendedor
            </CardTitle>
            <CardDescription>
              Entradas (leads) e matrículas de cada vendedor por curso
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Curso</th>
                    <th className="px-3 py-3 text-center">Total</th>
                    <th className="px-3 py-3 text-center">Matr.</th>
                    <th className="px-3 py-3 text-center">% Fech.</th>
                    {vendedores.map((v) => (
                      <th key={v.id} className="px-3 py-3 text-center">
                        {v.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fechamentoVendedor.length === 0 ? (
                    <tr>
                      <td colSpan={4 + vendedores.length} className="px-3 py-6 text-center text-sm text-slate-500">
                        Nenhum curso cadastrado
                      </td>
                    </tr>
                  ) : (
                    fechamentoVendedor.map((linha) => (
                      <tr key={linha.curso.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-medium text-slate-800">
                          {linha.curso.name}
                        </td>
                        <td className="px-3 py-2.5 text-center">{linha.total}</td>
                        <td className="px-3 py-2.5 text-center font-medium text-emerald-700">
                          {linha.matr}
                        </td>
                        <td className="px-3 py-2.5 text-center text-slate-600">
                          {pct(linha.matr, linha.total)}
                        </td>
                        {vendedores.map((v) => {
                          const leads = linha.leadsPorVendedor[v.id] ?? 0;
                          const matr = linha.matrPorVendedor[v.id] ?? 0;
                          return (
                            <td key={v.id} className="px-3 py-2.5 text-center">
                              <span className="text-slate-700">{leads}</span>
                              <span className="mx-1 text-slate-300">/</span>
                              <span className="font-medium text-emerald-700">{matr}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 9. MÉTRICAS DE ANÚNCIO */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-direta-orange" />
              Métricas de anúncio
            </CardTitle>
            <CardDescription>
              Investimento em captação no mês, clientes alcançados e matrículas geradas
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Campanha</th>
                    <th className="px-3 py-3 text-center">Investimento</th>
                    <th className="px-3 py-3 text-center">Clientes</th>
                    <th className="px-3 py-3 text-center">Matr.</th>
                    <th className="px-3 py-3 text-center">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {campanhasDoMes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                        Nenhuma campanha criada neste mês
                      </td>
                    </tr>
                  ) : (
                    <>
                      {campanhasDoMes.map((c) => {
                        const matr = matriculas.filter(
                          (m) => m.lead.campaignId === c.id
                        ).length;
                        return (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5">
                              <span className="font-medium text-slate-800">{c.name}</span>
                              <span className="ml-2 text-xs text-slate-400">
                                {c.channel}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {formatCurrency(Number(c.budget ?? 0))}
                            </td>
                            <td className="px-3 py-2.5 text-center">{c._count.leads}</td>
                            <td className="px-3 py-2.5 text-center font-medium text-emerald-700">
                              {matr}
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-600">
                              {pct(matr, c._count.leads)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50 font-semibold">
                        <td className="px-3 py-2.5">TOTAL</td>
                        <td className="px-3 py-2.5 text-center">
                          {formatCurrency(investimentoTotal)}
                        </td>
                        <td className="px-3 py-2.5 text-center">{clientesAnuncios}</td>
                        <td className="px-3 py-2.5 text-center">{matrAnuncios}</td>
                        <td className="px-3 py-2.5 text-center">
                          {pct(matrAnuncios, clientesAnuncios)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3 text-sm">
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <Target className="h-4 w-4 text-slate-400" />
                Custo por cliente
              </span>
              <span className="font-semibold text-slate-800">
                {clientesAnuncios > 0
                  ? formatCurrency(investimentoTotal / clientesAnuncios)
                  : "R$ 0,00"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Rodapé de ajuda */}
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="flex items-start gap-3 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="text-xs text-slate-600">
              <p className="mb-1 font-medium text-slate-700">Como ler este painel</p>
              <ul className="list-disc space-y-0.5 pl-4">
                <li>
                  <strong>Visão status geral</strong> mostra a situação atual de todos os
                  clientes, por vendedor — é o painel do dia a dia.
                </li>
                <li>
                  <strong>Acionados</strong> compara a meta de follow-ups do mês com o que
                  já foi feito; <strong>Clientes parados</strong> lista quem está sem
                  contato há mais de 2 dias.
                </li>
                <li>
                  <strong>Rede social</strong> e <strong>Empresas</strong> vêm da ficha de
                  matrícula (campo “Origem do aluno” em Vendas › Matrícula).
                </li>
                <li>
                  As formas de conhecimento são mantidas em{" "}
                  <Link href="/captacao/fontes" className="underline">
                    Captação › Fontes
                  </Link>
                  .
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
