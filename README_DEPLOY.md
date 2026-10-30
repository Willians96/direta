# 🚀 Deploy na Vercel — Guia Direta Cursos

> **Status do plano original:** O briefing previa VPS Hostinger (Postgres + Nginx + PM2).
> **Plano adaptado:** Como o cliente está usando Vercel, este guia cobre a stack equivalente serverless.
>
> **Migração para a VPS:** a preparação completa (scripts, runbook e checklist) está em
> **[README_VPS.md](README_VPS.md)**. Nenhuma infraestrutura é criada antes de a Direta decidir.

---

## ⚠️ Antes de apresentar: documentos na Vercel são efêmeros

O upload de documentos grava em `./storage` (filesystem local). Na Vercel esse disco é
**temporário**: o arquivo é perdido no próximo deploy da Vercel e o registro no banco continua lá
apontando para um arquivo inexistente. Na VPS (com `STORAGE_PATH=/var/app/storage`) o problema
desaparece — o disco é persistente.

**Enquanto o sistema rodar na Vercel:** faça o upload de documentos pouco antes da hora da
apresentação, ou suba a VPS antes.

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

> ✅ **Já implementado no código.** O app detecta a variável `BLOB_READ_WRITE_TOKEN` e passa a
> gravar/ler os documentos no Vercel Blob automaticamente. Sem essa variável, ele usa o filesystem
> local (que na Vercel é temporário — o arquivo se perde a cada deploy).

**Como ativar (2 minutos, no painel):**

1. No projeto Vercel → aba **Storage** → **Create** → **Blob store**
2. Nome sugerido: `gescola-docs` → **Connect** (vincula ao projeto)
3. A Vercel cria a variável **`BLOB_READ_WRITE_TOKEN`** no projeto — confirme que ela está marcada
   para **Production** (e **Preview**, se quiser testar em preview)
4. Salve a tela de environment variables. O próximo deploy passa a usar o Blob

**Como fica a partir daí:**

| Item | Com Blob | Sem Blob (filesystem) |
|---|---|---|
| Onde o arquivo fica | `leads/<leadId>/<uuid>.<ext>` no Blob | `/tmp/gescola-storage/...` (Vercel) ou `/var/app/storage/...` (VPS) |
| Sobrevive a deploy | ✅ | ❌ na Vercel |
| Acesso | Privado (somente via rota autenticada `/api/documents/[id]`) | idem |
| Aviso na tela | "Armazenamento em nuvem (Vercel Blob)" | "Armazenamento temporário" |

> Na **VPS** o filesystem local é o caminho natural (disco persistente em `/var/app/storage`) e
> funciona sem nenhum serviço extra — o Blob só é necessário enquanto o sistema roda na Vercel.

---

## 3.1 Storage de documentos — referência rápida

| Ambiente | `BLOB_READ_WRITE_TOKEN` | Onde grava | Persistência |
|---|---|---|---|
| Vercel (demo) | definido | Vercel Blob | total |
| Vercel (sem token) | vazio | `/tmp/gescola-storage` | some a cada deploy |
| VPS Hostinger | vazio | `/var/app/storage` | total (disco) |

A rota de leitura `/api/documents/[id]` valida perfil (ADMIN vê tudo; demais veem só os leads
atribuídos), serve PDF/imagem inline e **anexa** os demais tipos (HTML e SVG nunca são abertos
inline, para não virar XSS no mesmo domínio).

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
