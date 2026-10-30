# 🎓 Direta Cursos · Gestão Escolar

> Sistema de gestão escolar — **Fase 1: Módulo de Vendas**
> Cliente: **DIRETA CURSOS INDUSTRIAIS E PREPARATORIOS LTDA - ME** (CNPJ 09.401.686/0002-88)

Sistema web para gestão do funil comercial: captação → vendas → análise documental → matrícula efetivada.

---

## ⚡ Stack

- **Next.js 14** (App Router) + **TypeScript**
- **PostgreSQL 16** + **Prisma ORM**
- **Auth.js v5** (NextAuth) com Credentials Provider
- **shadcn/ui** + **Tailwind CSS** + **Lucide Icons**
- **React Hook Form** + **Zod** + **TanStack Query**
- **Recharts** (gráficos)
- **PM2 + Nginx + Let's Encrypt** (deploy na VPS Hostinger)

---

## 🚀 Quick Start (Desenvolvimento Local)

```bash
# 1. Instalar dependências
pnpm install

# 2. Subir PostgreSQL via Docker
docker run -d --name postgres \
  -e POSTGRES_USER=gescola \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=gescola \
  -p 5432:5432 \
  postgres:16

# 3. Configurar .env
cp .env.example .env.local
# editar DATABASE_URL se necessário

# 4. Rodar migrations + seed
pnpm prisma migrate dev --name init
pnpm prisma db seed

# 5. Iniciar dev server
pnpm dev
# → http://localhost:3000
```

### 🔐 Credenciais de Demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| **Administrador** | admin@direta.com | admin123 |
| **Captação** | captacao@direta.com | captacao123 |
| **Vendas** | vendas@direta.com | vendas123 |
| **Recepção** | recepcao@direta.com | recepcao123 |

---

## 📁 Estrutura do Projeto

```
gescola/
├── app/
│   ├── (auth)/login/                 # Página de login
│   ├── (dashboard)/                  # Área autenticada
│   │   ├── admin/                    # Visão ADMIN
│   │   ├── captacao/                 # Visão CAPTAÇÃO
│   │   ├── vendas/                   # Visão VENDAS
│   │   └── recepcao/                 # Visão RECEPÇÃO
│   ├── api/
│   │   ├── auth/[...nextauth]/       # NextAuth
│   │   └── health/                   # Health check
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                           # Componentes shadcn (Button, Card, Input, Badge, Avatar...)
│   └── shared/                       # Sidebar, Header, StatCard, StatusBadge, PageHeader
├── lib/
│   ├── auth.ts                       # Config Auth.js
│   ├── prisma.ts                     # Singleton Prisma
│   ├── utils.ts                      # cn(), formatadores
│   └── validators/                   # Schemas Zod
├── prisma/
│   ├── schema.prisma                 # Modelo de dados
│   └── seed.ts                       # Dados iniciais (4 perfis)
├── scripts/
│   ├── setup-vps.sh                  # Setup inicial da VPS
│   ├── deploy.sh                     # Deploy manual
│   └── migrate-db-neon-to-vps.sh     # Migração de dados (Neon -> Postgres da VPS)
├── .github/workflows/
│   ├── ci.yml                        # CI em PRs
│   └── deploy.yml                    # Deploy automático
├── middleware.ts                     # RBAC + proteção de rotas
├── ecosystem.config.js               # PM2
├── tailwind.config.ts
└── package.json
```

---

## 🎨 Perfis de Acesso (RBAC)

A matriz de permissões é enforced em **3 camadas**:

1. **Middleware Next.js** (`middleware.ts`) — bloqueia rotas sem permissão
2. **Session JWT** (`lib/auth.ts`) — carrega `role` no token
3. **Queries Prisma** — filtra dados pelo `assignedToId` do usuário logado

| Área | ADMIN | CAPTAÇÃO | VENDAS | RECEPÇÃO |
|---|:---:|:---:|:---:|:---:|
| `/admin/*` | ✅ | ❌ | ❌ | ❌ |
| `/captacao/*` | ✅ | ✅ | ❌ | ❌ |
| `/vendas/*` | ✅ | ❌ | ✅ | ❌ |
| `/recepcao/*` | ✅ | ❌ | ❌ | ✅ |

---

## 🗄️ Modelo de Dados (resumo)

```
User ──┬──< Campaign ──< Lead ──┬──< Interaction
       │                         ├──< Document
       │                         ├──< PreEnrollment ──> Class ──> Course
       │                         └──< EnrollmentAudit
       └──< Session/Account (NextAuth)
```

**Status do Lead (workflow):**
```
NOVO → QUALIFICADO → PROPOSTA_ENVIADA → EM_NEGOCIACAO → AGUARDANDO_ANALISE
  ├─ APROVADA (matrícula efetivada)
  └─ DEVOLVIDA_AJUSTE → EM_NEGOCIACAO (loop)
        └─ PERDIDA
```

---

## 🌐 Deploy na VPS Hostinger (preparado, ainda não ativo)

> **Estado:** o sistema está no ar na **Vercel** (https://direta-ten.vercel.app). A VPS Hostinger
> ainda **não foi contratada** — o que está no repositório é a preparação para o dia da migração.
> O guia passo a passo está em **[README_VPS.md](README_VPS.md)**.

### Pré-requisitos
- VPS Ubuntu 22.04+ (mínimo 4GB RAM, 2 vCPU, 40GB SSD)
- Domínio próprio com DNS apontado para a VPS (opcional na fase de teste por IP)
- Acesso SSH com chave

### Setup inicial (uma vez)
```bash
# Na VPS, como root:
chmod +x scripts/setup-vps.sh
sudo env DOMAIN="" ./scripts/setup-vps.sh
```

O script instala e configura:
- Node.js 20 LTS + pnpm 12 (via corepack) + PM2 com boot automático
- PostgreSQL 16 (tuning por RAM, escopo `localhost`, senha `scram-sha-256`) + swap se RAM < 4GB
- Nginx (proxy reverso, upload de 20 MB, cabeçalhos de segurança, gzip)
- UFW (firewall) + Fail2ban (anti-brute-force)
- Backup diário do banco **e** dos documentos (cron)

### Migração dos dados (Neon → Postgres da VPS)
```bash
export NEON_DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"
export DATABASE_URL="postgresql://gescola_app:SENHA@127.0.0.1:5432/gescola?schema=public"
bash scripts/migrate-db-neon-to-vps.sh
```
Faz dump → restore → **confere a contagem de linhas** de cada tabela principal entre origem e destino.

### Deploy
```bash
# Na VPS:
cd /var/app && bash scripts/deploy.sh
```
1. `git pull` da `main`
2. `pnpm install --frozen-lockfile` + `pnpm prisma migrate deploy`
3. `pnpm build`
4. `pm2 reload --update-env` + `pm2 save`
5. Health check em `/api/health`

**CI/CD:** o workflow `.github/workflows/deploy.yml` fica em **disparo manual**
(Actions → *Deploy to VPS* → *Run workflow*) enquanto não houver VPS — ele era disparado em
todo push na `main` e falhava. Secrets necessários quando for ativado:
- `VPS_HOST` — IP ou hostname da VPS
- `VPS_USER` — usuário SSH (ex: `deploy`)
- `VPS_SSH_KEY` — chave privada SSH
- `DOMAIN` — domínio da app (ex: `app.diretacursos.com.br`)
- `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` — para o build

---

## 🛠️ Scripts Úteis

```bash
# Dev
pnpm dev                              # Servidor de desenvolvimento
pnpm prisma:studio                    # GUI do banco (http://localhost:5555)

# Banco
pnpm prisma migrate dev --name X      # Criar migration
pnpm prisma migrate deploy            # Aplicar migrations em prod
pnpm prisma:seed                      # Popular banco com dados de demo

# Build
pnpm build                            # Build de produção
pnpm start                            # Rodar build de produção
pnpm typecheck                        # Verificar tipos TypeScript
pnpm lint                             # ESLint
```

---

## 📦 Funcionalidades Implementadas (Fase 1)

### ✅ Estrutura base
- [x] Setup Next.js 14 + TypeScript + Tailwind + shadcn/ui
- [x] Schema Prisma completo (12 models)
- [x] Auth.js v5 com Credentials + JWT
- [x] Middleware de RBAC (proteção de rotas por perfil)
- [x] 4 perfis com login e senha hasheada (bcrypt)

### ✅ UI/UX
- [x] Login page responsivo (split-screen com branding)
- [x] Sidebar com navegação condicional por role
- [x] Header com busca + notificações + user menu
- [x] 4 dashboards com KPIs, gráficos e tabelas
- [x] Listagem de leads (com filtros, status badges)
- [x] Detalhe do lead (timeline de interações, checklist de docs)
- [x] Componentes shadcn: Button, Card, Input, Label, Badge, Avatar

### 🚧 A implementar (Sprint 2-6)
- [ ] CRUDs completos (usuários, cursos, campanhas)
- [ ] Formulário de pré-matrícula
- [ ] Upload de documentos (multipart + URLs assinadas)
- [ ] Workflow de aprovação/devolução
- [ ] API routes REST internas
- [ ] Auditoria completa
- [ ] Notificações in-app (Sonner)

---

## 📝 Licença

Projeto proprietário — Direta Cursos Industriais e Preparatórios LTDA - ME
© 2026

---

## 🤝 Suporte

Em caso de dúvidas sobre o desenvolvimento, consulte o documento [`prompt-desenvolvimento-fase1.md`](../prompt-desenvolvimento-fase1.md) na raiz do projeto (briefing técnico completo).
