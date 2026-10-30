# 🚀 Migração para VPS Hostinger — Runbook

> **Estado atual (out/2026):** o sistema roda na **Vercel** (https://direta-ten.vercel.app) enquanto a
> Direta Cursos não fecha a Fase 1. A VPS **ainda não foi contratada** — este documento é a
> preparação: tudo que está aqui já está pronto no repositório e será executado no dia da migração.

---

## 1. Decisões já tomadas

| Tema | Decisão | Por quê |
|---|---|---|
| Hosting | **Nativo (PM2 + Nginx + PostgreSQL)** | Mais leve que Docker em VPS de 2–4 GB; sem dependência de Docker na Hostinger |
| Banco | **PostgreSQL na própria VPS** | Elimina custo e dependência do Neon; o dump do Neon vira o ponto de partida |
| Domínio | **Ainda não contratado** | Setup preparado para acesso por IP; SSL (certbot) fica para quando houver domínio |
| Deploy | `git pull` + `pnpm build` + `pm2 reload` | Mesmo repositório, mesmo fluxo de código |
| Persistência de documentos | Filesystem em `/var/app/storage` | Na Vercel o filesystem é efêmero (ver seção 6) |

---

## 2. Topologia alvo

```
Internet ──▶ Nginx :80 (:443 quando houver domínio)
                 │  proxy reverso + limites de upload
                 ▼
             Next.js :3000  (PM2, usuário "deploy", /var/app)
                 │
                 ├──▶ PostgreSQL 16 :5432  (localhost, senha scram-sha-256)
                 └──▶ /var/app/storage/leads/<leadId>/<uuid>.<ext>   (documentos)
```

Portas expostas na internet: **22 (SSH)** e **80 (HTTP)**. O PostgreSQL fica só em `127.0.0.1`.

---

## 3. Pré-requisitos da VPS

| Item | Mínimo | Observação |
|---|---|---|
| Sistema | Ubuntu 22.04 ou 24.04 LTS | Hostinger KVM entrega 22.04/24.04 |
| RAM | 2 GB (4 GB recomendado) | O setup cria 2 GB de swap se RAM < 4 GB |
| vCPU | 2 | — |
| Disco | 40 GB SSD | 20 GB bastam para app + banco + backups |
| Acesso | SSH com chave pública | Criar usuário `deploy` no setup |

---

## 4. Execução no dia da migração

### 4.1 Setup da VPS (uma vez, ~5 min)

```bash
# na VPS, como root, dentro do repo clonado
chmod +x scripts/setup-vps.sh
sudo env DOMAIN="" ./scripts/setup-vps.sh
```

O script instala e configura: Node 20 + pnpm 12 + PM2 (com boot automático), PostgreSQL 16
(tuning por RAM, escopo `localhost`, senha `scram-sha-256`), Nginx (proxy, upload de 20 MB,
cabeçalhos de segurança, gzip), UFW, Fail2ban, backup diário (banco + documentos) e um
`.env.production` modelo em `/var/app`.

> Guarde a senha do banco que ele imprimir — ela não existe em mais nenhum lugar.

### 4.2 Publicar o código

```bash
cd /var/app
git clone https://github.com/Willians96/direta.git .
corepack enable && pnpm install --frozen-lockfile
```

### 4.3 Ajustar o ambiente

Edite `/var/app/.env.production` (permissão `600`):

```bash
DATABASE_URL="postgresql://gescola_app:SENHA@127.0.0.1:5432/gescola?schema=public"
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_URL="http://IP_PUBLICO_DA_VPS"     # por enquanto sem TLS
AUTH_TRUST_HOST="true"
STORAGE_PATH="/var/app/storage"
NODE_ENV="production"
```

### 4.4 Migrar os dados do Neon para o Postgres da VPS

Rode **na VPS** (ela alcança o Neon pela internet):

```bash
export NEON_DATABASE_URL="postgresql://...@ep-xxx.aws.neon.tech/neondb?sslmode=require"
export DATABASE_URL="postgresql://gescola_app:SENHA@127.0.0.1:5432/gescola?schema=public"
bash scripts/migrate-db-neon-to-vps.sh
```

O script faz dump → restauração → **compara a contagem de linhas** de `User`, `Lead`, `Followup`,
`Enrollment`, `Goal`, `LeadMessage`, `EnrollmentAudit` e `Document` entre origem e destino, e
avisa se houver divergência (código de saída 2). O dump é mantido em `/var/backups/pg`.

> O dump inclui `_prisma_migrations`, então `prisma migrate deploy` não repete migrations.

### 4.5 Subir a aplicação

```bash
cd /var/app
pnpm prisma migrate deploy
pnpm build
pm2 start ecosystem.config.js --update-env && pm2 save
curl http://127.0.0.1:3000/api/health
```

Resposta esperada: `{"status":"ok","database":"connected",...}`

### 4.6 Conferir pelo navegador

- `http://IP_DA_VPS/login` — login com as credenciais de demonstração
- `http://IP_DA_VPS/api/health`
- `http://IP_DA_VPS/vendas/leads` — lista carregando (confere banco **e** build de produção)

---

## 5. Operação depois da migração

### Deploy de uma nova versão

```bash
cd /var/app && bash scripts/deploy.sh
```

ou, pelo GitHub Actions, disparo manual em **Actions → Deploy to VPS → Run workflow** (o
workflow só dispara por `workflow_dispatch` enquanto não houver VPS; ver seção 7).

Secrets no GitHub: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `DOMAIN`, `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`.
Variável do repositório: `VPS_ENABLED = true` (Settings → Secrets and variables → Actions → Variables) —
é ela que habilita o job, já que o contexto `secrets` não pode ser usado no `if` de um job.

### Backup e restauração

```bash
# backup manual
sudo /etc/cron.daily/backup-gescola

# restaurar
gunzip -c /var/backups/pg/gescola-AAAAMMDD-HHMM.sql.gz | \
  psql "postgresql://gescola_app:SENHA@127.0.0.1:5432/gescola" --set ON_ERROR_STOP=1
```

Backup diário automático (02:00-ish, pelo cron do sistema) em `/var/backups/pg` e
`/var/backups/storage`, com 30 dias de retenção. **Copie esses arquivos para fora da VPS**
(smartphone, Google Drive, outra máquina) — backup que fica só no mesmo servidor não é backup.

### Quando comprar o domínio

```bash
# 1. Aponte o DNS (A record) para o IP da VPS
# 2. Troque o server_name no Nginx
sudo sed -i "s/server_name _;/server_name app.seudominio.com.br;/" /etc/nginx/sites-available/gescola
sudo nginx -t && sudo systemctl reload nginx
# 3. Emita o certificado
sudo certbot --nginx -d app.seudominio.com.br
# 4. Atualize o AUTH_URL
sudo sed -i "s#^AUTH_URL=.*#AUTH_URL=\"https://app.seudominio.com.br\"#" /var/app/.env.production
cd /var/app && pm2 reload ecosystem.config.js --update-env
```

### Rollback

```bash
cd /var/app
git log --oneline -5            # escolher o commit anterior
git checkout <commit>
pnpm install --frozen-lockfile && pnpm build
pm2 reload ecosystem.config.js --update-env
```

Para o banco, o rollback é o `pg_restore` de um backup (seção 5).

---

## 6. Limitações conhecidas (e como a migração resolve)

| Limitação | Onde aparece | Solução na VPS |
|---|---|---|
| **Documentos somem na Vercel** | Upload grava em `./storage`, que é efêmero no serverless — o arquivo é perdido no próximo deploy da Vercel | `/var/app/storage` é disco persistente |
| Sem SSL | Today o domínio da Vercel tem TLS automático | `certbot` no Nginx (§5) |
| Cold start | ~1 s de delay na Vercel free tier | PM2 keep-alive, resposta imediata |
| Limite de execução | 10 s (free) / 60 s (pro) na Vercel | Sem limite relevante no Node da VPS |
| Sem SSH | Vercel não expõe shell | Acesso SSH completo para dumps, logs e manutenção |

> **Atenção ao uso do protótipo na Vercel:** documentos enviados hoje **não sobrevivem a um
> redeploy**. Para a demonstração comercial, faça o upload de documentos perto da hora da
> apresentação, ou suba a VPS antes.

---

## 7. O que mudou no repositório para suportar a VPS

| Arquivo | Mudança |
|---|---|
| `scripts/setup-vps.sh` | Reescrito: pnpm via corepack, PM2 com boot automático, swap por RAM, tuning do Postgres por RAM, Nginx pronto para IP, backup de banco **e** documentos, modelo de `.env.production` |
| `scripts/deploy.sh` | Reescrito: corepack, `migrate deploy`, `pm2 reload --update-env`, `pm2 save`, health check com espera e logs em caso de falha |
| `scripts/migrate-db-neon-to-vps.sh` | **Novo**: dump do Neon → restore na VPS com verificação de contagem de linhas |
| `ecosystem.config.js` | Limite de memória conforme RAM da VPS, `kill_timeout`, `time` |
| `.env.example` | Seção da VPS (URL local, `STORAGE_PATH` absoluto, `AUTH_URL` por IP) |
| `.github/workflows/deploy.yml` | Passou a ser **manual** (`workflow_dispatch`) — antes disparava em todo push na `main` e falhava por não existir VPS |
| `pnpm-workspace.yaml` + `package.json` | `allowBuilds` explícito e `packageManager` fixado em pnpm 12.4.1 — installs limpos (CI e VPS) passam a behave igual ao local |

---

## 8. Checklist "dia da migração"

- [ ] VPS Hostinger contratada (Ubuntu 22.04/24.04, 2 vCPU, 4 GB RAM)
- [ ] Chave SSH configurada e `deploy` acessível
- [ ] `sudo env DOMAIN="" ./scripts/setup-vps.sh` executado sem erro
- [ ] Senha do banco anotada em local seguro
- [ ] Código publicado em `/var/app` (`git clone`)
- [ ] `.env.production` ajustado (`AUTH_SECRET`, `AUTH_URL` com o IP público)
- [ ] `bash scripts/migrate-db-neon-to-vps.sh` sem divergências
- [ ] `pnpm build` + `pm2 start` + `pm2 save`
- [ ] `/api/health` respondendo `ok`
- [ ] Login e navegação testados no navegador pelo IP
- [ ] Upload de documento testado (grava e lê do disco)
- [ ] Backup manual disparado e **copiado para fora da VPS**
- [ ] DNS + certbot (quando houver domínio)
- [ ] Neon mantido como rede de segurança por 7 dias, depois desligado
