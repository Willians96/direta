import Link from "next/link";
import { redirect } from "next/navigation";
import {
  UsersRound,
  Download,
  UserPlus,
  Search,
  UserRound,
  GraduationCap,
  CalendarCheck,
  CircleCheck,
  CircleSlash,
  Wallet,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { auth } from "@/lib/auth";
import {
  getStudents,
  getStudentOptions,
  SITUACOES_ALUNO,
  SITUACAO_LABELS,
  SITUACAO_VARIANTS,
} from "@/lib/alunos";
import { formatCurrency, formatDate, formatPhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AlunosPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    courseId?: string;
    classId?: string;
    situacao?: string;
  };
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user) redirect("/login");
  if (role !== "ADMIN" && role !== "RECEPCAO") redirect(`/${role?.toLowerCase()}`);

  const filters = {
    q: searchParams.q,
    courseId: searchParams.courseId,
    classId: searchParams.classId,
    situacao: searchParams.situacao,
  };

  const [{ rows, kpis }, options] = await Promise.all([
    getStudents(filters),
    getStudentOptions(),
  ]);

  // querystring corrente para manter os filtros no link de exportação
  const qs = new URLSearchParams();
  if (searchParams.q) qs.set("q", searchParams.q);
  if (searchParams.courseId) qs.set("courseId", searchParams.courseId);
  if (searchParams.classId) qs.set("classId", searchParams.classId);
  if (searchParams.situacao) qs.set("situacao", searchParams.situacao);
  const exportHref = `/api/alunos/export?${qs.toString()}`;

  const temFiltro = Boolean(
    searchParams.q || searchParams.courseId || searchParams.classId || searchParams.situacao
  );

  return (
    <div>
      <PageHeader
        title="Alunos"
        description="Cadastro dos alunos matriculados e situação de cada um"
        icon={UsersRound}
        action={
          <>
            <Button asChild variant="outline">
              <a href={exportHref}>
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </a>
            </Button>
            <Button asChild>
              <Link href="/alunos/novo">
                <UserPlus className="mr-2 h-4 w-4" />
                Novo aluno
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <form className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1 space-y-1">
                <label className="text-xs font-medium text-slate-600">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    name="q"
                    defaultValue={searchParams.q ?? ""}
                    placeholder="Nome, CPF, telefone ou e-mail"
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Curso</label>
                <select
                  name="courseId"
                  defaultValue={searchParams.courseId ?? ""}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="">Todos</option>
                  {options.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Turma</label>
                <select
                  name="classId"
                  defaultValue={searchParams.classId ?? ""}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="">Todas</option>
                  {options.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Situação</label>
                <select
                  name="situacao"
                  defaultValue={searchParams.situacao ?? ""}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="">Todas</option>
                  {SITUACOES_ALUNO.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="h-9 rounded-md border border-slate-200 bg-slate-50 px-4 text-sm hover:bg-slate-100"
              >
                Aplicar
              </button>
              {temFiltro && (
                <Link
                  href="/alunos"
                  className="h-9 px-2 text-sm leading-9 text-direta-orange hover:underline"
                >
                  Limpar filtros
                </Link>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Indicadores */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            title="Alunos"
            value={kpis.total}
            description="Matrículas registradas"
            icon={UsersRound}
            variant="brand"
          />
          <StatCard
            title="Ativos"
            value={kpis.ativos}
            description="Cursando normalmente"
            icon={CircleCheck}
            variant="success"
          />
          <StatCard
            title="Concluídos"
            value={kpis.concluidos}
            description="Curso finalizado"
            icon={CalendarCheck}
            variant="info"
          />
          <StatCard
            title="Trancados"
            value={kpis.trancados}
            description="Matrícula pausada"
            icon={CircleSlash}
            variant="warning"
          />
          <StatCard
            title="Sem turma"
            value={kpis.semTurma}
            description="Aguardando alocação"
            icon={UserRound}
            variant="default"
          />
          <StatCard
            title="Receita"
            value={formatCurrency(kpis.receita)}
            description="Valor contratado"
            icon={Wallet}
            variant="success"
          />
        </div>

        {/* Lista */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Alunos matriculados ({rows.length})
            </CardTitle>
            <CardDescription>
              {kpis.ativos} ativos · {kpis.concluidos} concluídos · {kpis.trancados}{" "}
              trancados · {kpis.semTurma} sem turma
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="rounded-md border border-dashed p-12 text-center text-sm text-slate-500">
                Nenhum aluno encontrado com esses filtros.
                <br />
                <span className="text-xs">
                  Use o botão &quot;Novo aluno&quot; para cadastrar um aluno que chegou na
                  recepção.
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Curso / Turma</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Link
                            href={`/alunos/${a.id}`}
                            className="font-medium text-direta-orange hover:underline"
                          >
                            {a.fullName}
                          </Link>
                          {a.cpf && (
                            <div className="text-xs text-slate-500">CPF: {a.cpf}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          <div>{formatPhone(a.phone)}</div>
                          {a.email && <div className="text-xs">{a.email}</div>}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="font-medium">{a.courseName}</div>
                          <div className="text-xs text-slate-500">
                            {a.className ?? "Sem turma"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {formatDate(a.enrolledAt)}
                          <div className="text-xs text-slate-500">
                            {a.installments}x {formatCurrency(a.totalAmount)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={SITUACAO_VARIANTS[a.situacao]}>
                            {SITUACAO_LABELS[a.situacao]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatCurrency(a.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
