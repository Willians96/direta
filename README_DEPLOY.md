# 🚀 Deploy na Vercel — Guia Direta Cursos

> **Status do plano original:** O briefing previa VPS Hostinger (Postgres + Nginx + PM2).
> **Plano adaptado:** Como o cliente está usando Vercel, este guia cobre a stack equivalente serverless.

---

## ⚙️ Stack na Vercel

| Serviço | Função |
|---|---|
| **Vercel** | Hosting (substitui Nginx + PM2) |
| **Vercel Postgres** | Banco PostgreSQL (substitui o Postgres local) |
| **Vercel Blob** | Storage de documentos (substitui o filesystem local — serverless não tem disco persistente) |
| **GitHub** | CI/CD nativo (push na `main` = deploy) |

---

## 1️⃣ Setup no Vercel

1. Importe o repositório GitHub em [vercel.com/new](https://vercel.com/new)
2. Framework detectado: **Next.js** (auto)
3. **Environment variables** (em Settings → Environment Variables):
   ```
   DATABASE_URL          → connection string do Vercel Postgres
   AUTH_SECRET           → openssl rand -base64 32
   AUTH_URL              → https://seu-app.vercel.app
   AUTH_TRUST_HOST       → true
   BLOB_READ_WRITE_TOKEN → token do Vercel Blob
   ```

---

## 2️⃣ Provisionar Vercel Postgres

1. No projeto Vercel → aba **Storage** → **Create Database** → **Postgres**
2. Aceite a integração (adiciona `POSTGRES_URL` etc. automaticamente)
3. Copie a string da variável **`POSTGRES_PRISMA_URL`** (ela já vem com `?sslmode=require` e `&pgbouncer=true` otimizados pro Prisma)
4. Cole como valor de **`DATABASE_URL`** nas env vars
5. **Deploy** — após subir, rode no console da Vercel:
   ```bash
   pnpm prisma migrate deploy
   pnpm prisma db seed
   ```

---

## 3️⃣ Provisionar Vercel Blob (storage de documentos)

1. No projeto Vercel → **Storage** → **Create** → **Blob**
2. Aceite a integração (cria a env var `BLOB_READ_WRITE_TOKEN` automaticamente)
3. O token é gerado com permissões de leitura/escrita

> **Importante:** o plano original previa filesystem em `/var/app/storage/` — serverless na Vercel **não tem disco persistente**, então **toda referência a `STORAGE_PATH` precisa migrar para o Vercel Blob**.
> Vamos ajustar isso nas próximas sprints (módulo de documentos).

---

## 4️⃣ Domínio personalizado

1. Vercel → Settings → **Domains** → adicione `app.diretacursos.com.br`
2. Configure o DNS no painel do Registro.br (Cloudflare opcional):
   - Tipo `CNAME` → `cname.vercel-dns.com`
3. SSL automático Let's Encrypt (sem precisar de certbot)

---

## 5️⃣ CI/CD

- **Já configurado**: `.github/workflows/deploy.yml` funciona com SSH na VPS
- **Adaptar pra Vercel**: simplesmente remova o job `deploy` — a própria Vercel escuta o GitHub e faz o build + deploy a cada push na `main`

> Sugestão: deletar o `.github/workflows/deploy.yml` antigo e manter só o `ci.yml` (typecheck + build).

---

## 6️⃣ Pós-deploy

- Primeiro acesso: use as credenciais seed (`admin@direta.com / admin123`)
- Trocar a senha do admin imediatamente
- Configurar Uptime Kuma free em outro host pra monitorar `https://app.diretacursos.com.br/api/health`

---

## 🆚 Diferenças vs. plano VPS original

| Item | Plano VPS | Plano Vercel |
|---|---|---|
| **Custo mensal** | R$30-80 (VPS) | Free tier até limites |
| **Domínio** | R$50/ano | R$50/ano |
| **Cold start** | Nenhum (PM2 keep-alive) | ~1s após inatividade (free) |
| **Storage de docs** | Disco VPS (privado) | Vercel Blob (privado, URLs assinadas) |
| **Backup do banco** | Cron + pg_dump local | Automático na Vercel (point-in-time recovery 7 dias) |
| **SSL** | Let's Encrypt manual | Automático |
| **Deploy** | GitHub Actions SSH | Push na `main` = deploy |

A stack Vercel é **mais simples e barata pra demo/MVP**, mas tem limite de execução de 10s (free) / 60s (pro). Pra Fase 1 com CRUDs simples, é mais que suficiente.
