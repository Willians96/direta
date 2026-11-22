# 🚀 GESCOLA na VPS — Runbook de operação

> **Estado atual (nov/2026):** o sistema roda **na VPS `76.13.123.172`** (Ubuntu 24.04 LTS), em
> containers Docker, atrás do **Traefik** que já serve o FarmaVet. A URL pública depende do
> subdomínio configurado em `GESCOLA_DOMAIN`.
>
> A Vercel (`direta-ten.vercel.app`) continua no ar como **rede de segurança**, mas aponta para o
> Neon — a fonte de verdade do dia a dia é o PostgreSQL da VPS.

---

## 1. Por que a topologia é esta

A VPS **não é dedicada**: ela hospeda o **FarmaVet** (ERP + app da farmácia), que está em produção
em `farmaciafarmavet.com.br`. Por isso o gescola **não** usa o setup nativo (Nginx + PM2 +
Postgres do sistema) que está em `scripts/setup-vps.sh` — aquele setup assumes uma máquina
exclusiva e conflitaria com o que já está rodando.

| Recurso | Quem usa | Como o gescola ficou |
|---|---|---|
| Portas 80 / 443 | Traefik (FarmaVet) | O gescola entra como **container na rede do Traefik** e vira um router novo |
| Postgres 5432 | container `farmavet-postgres` | O gescola tem o **seu próprio** container `gescola-postgres` (PG18) |
| Postgres 5433 | container `farmavet-erp-postgres` | não tocado |
| Porta 8081 | `farmavet-pgadmin` | não tocado |
| UFW (22, 80, 443, 8081) | FarmaVet | **inalterado** — o gescola não abre porta nova |

Nenhum container do FarmaVet foi parado, recriado ou reconfigurado na migração.

---

## 2. Topologia atual

```
Internet ──▶ Traefik (farmavet-traefik) :80 → :443
                 │  Host(gescola.<dominio>)  ──▶ gescola-app  (container, :3000)
                 │  Host(farmaciafarmavet…) ──▶ farmavet-app (container, :3000)
                 ▼
          gescola-postgres (PG18, só rede interna)
          /opt/gescola/storage  (documentos — disco persistente)
```

| Container | Imagem | Rede | Observação |
|---|---|---|---|
| `gescola-app` | `gescola-app:latest` (build local) | `app_gescola-net` + `farmavet-net` | Node 22, saída Next.js *standalone*, porta 3000 |
| `gescola-postgres` | `postgres:18-alpine` | `app_gescola-net` | PG18 = mesma versão do Neon, semtranslation de dump |

Diretórios na VPS:

| Caminho | Conteúdo |
|---|---|
| `/opt/gescola/app` | clone do repositório (`git pull` para atualizar) |
| `/opt/gescola/app/.env.vps` | **segredos** (senha do banco, AUTH_SECRET, domínio) — permissão `600` |
| `/opt/gescola/db/pgdata` | dados do PostgreSQL 18 (**não versionar, não apagar**) |
| `/opt/gescola/storage` | documentos enviados pelos vendedores |
| `/opt/gescola/backups` | dumps do banco e dos documentos |

---

## 3. Publicar uma nova versão

```bash
cd /opt/gescola/app
bash scripts/deploy-vps-docker.sh
```

O script faz: `git pull` → build da imagem → `prisma migrate deploy` → recria o container do app
→ health check em `/api/health`. O container do **banco nunca é recriado** (os dados ficam em
`/opt/gescola/db/pgdata`).

Deploy manual equivalente:

```bash
cd /opt/gescola/app
docker compose -f docker-compose.vps.yml --env-file .env.vps build app
docker compose -f docker-compose.vps.yml --env-file .env.vps run --rm migrate
docker compose -f docker-compose.vps.yml --env-file .env.vps up -d app
docker exec gescola-app curl -fsS http://localhost:3000/api/health
```

> O `scripts/deploy.sh` (PM2 + Nginx) fica para uma VPS **exclusiva**. Aqui quem vale é o
> `scripts/deploy-vps-docker.sh`.

---

## 4. Domínio e SSL

O Traefik já tem o resolver **Let's Encrypt** configurado (`letsencrypt`, ACME HTTP challenge).
Para o gescola:

1. **DNS**: crie o registro **A** do subdomínio apontando para `76.13.123.172`
   (ex.: `gescola.seudominio.com.br → 76.13.123.172`)
2. **VPS**: ajuste o domínio no arquivo de ambiente e recrie o container

   ```bash
   cd /opt/gescola/app
   sed -i 's#^GESCOLA_DOMAIN=.*#GESCOLA_DOMAIN="gescola.seudominio.com.br"#' .env.vps
   docker compose -f docker-compose.vps.yml --env-file .env.vps up -d --force-recreate app
   ```

3. O Traefik pede o certificado sozinho (o router novo usa `certresolver=letsencrypt`) e
   renova antes de expirar
4. Confira: `docker logs farmavet-traefik --tail 20 | grep -i gescola`

> Enquanto o DNS não aponta, o app responde **apenas internamente**. Para testar sem domínio:
> `curl -sk -H "Host: gescola.pendente.local" https://127.0.0.1/login` (na própria VPS).

---

## 5. WhatsApp (Sprint 22)

O webhook fica em:

```
https://<seu-subdominio>/api/whatsapp/webhook
```

| Item | Onde |
|---|---|
| Token de verificação | `WHATSAPP_VERIFY_TOKEN` no `.env.vps` (o mesmo da Vercel) |
| Assinatura | `WHATSAPP_APP_SECRET` — **ainda não cadastrado** (enquanto não houver, o POST responde 503) |
| Análise por IA | `LLM_API_KEY` — **ainda não cadastrado** (a análise roda só por regras) |

O passo a passo para criar a conta na Meta está em `GUIA_WHATSAPP_META.md`.
Depois de cadastrar uma variável nova na Vercel **e** na VPS, lembre-se: variável de ambiente
**só entra em vigor em novo deploy**.

---

## 6. Backup e restauração

Backup diário automático (cron do sistema, por volta das 03:00):

| Arquivo | Onde |
|---|---|
| banco | `/opt/gescola/backups/gescola-AAAAMMDD-HHMM.sql.gz` |
| documentos | `/opt/gescola/backups/storage-AAAAMMDD-HHMM.tar.gz` |
| log | `/var/log/gescola-backup.log` |

Rodar na mão:

```bash
/etc/cron.daily/backup-gescola
```

Restaurar o banco:

```bash
gunzip -c /opt/gescola/backups/gescola-AAAAMMDD-HHMM.sql.gz | \
  docker exec -i gescola-postgres psql -U gescola_app -d gescola --set ON_ERROR_STOP=1
```

> **Copie os backups para fora da VPS** (Drive, outra máquina, etc.). Backup que fica só no
> mesmo servidor não é backup.

---

## 7. Migração dos dados (Neon → VPS) — como foi feita

```bash
# 1. dump da origem (PostgreSQL 18 do Neon)
docker run --rm --env-file /root/.neon.env -v /opt/gescola/backups:/backups \
  postgres:18-alpine sh -c 'pg_dump --no-owner --no-acl --format=plain --no-comments | gzip > /backups/neon.sql.gz'

# 2. restore no banco da VPS
gunzip -c /opt/gescola/backups/neon.sql.gz | \
  docker exec -i gescola-postgres psql -U gescola_app -d gescola --set ON_ERROR_STOP=1
```

O dump inclui a tabela `_prisma_migrations`, então o `prisma migrate deploy` seguinte não repete
migration. A conferência de contagem de linhas (12 tabelas) deu **zero divergências**.

O Neon continua no ar como rede de segurança — **não apague** até a Fase 1 fechar.

---

## 8. Diagnóstico rápido

```bash
# status dos containers
docker ps --filter name=gescola --format '{{.Names}}: {{.Status}}'

# health do app
docker exec gescola-app curl -fsS http://localhost:3000/api/health

# logs do app
docker logs gescola-app --tail 50

# logs do Traefik (roteamento e certificado)
docker logs farmavet-traefik --tail 50 | grep -i gescola

# banco
docker exec gescola-postgres psql -U gescola_app -d gescola -c '\dt'
```

---

## 9. Checklist do que falta para fechar a Fase 1

- [x] Código na VPS (container, Traefik, PostgreSQL dedicado)
- [x] Dados migrados do Neon com conferência de contagem
- [x] Backup diário instalado e testado
- [ ] Subdomínio apontando para `76.13.123.172` (DNS)
- [ ] `GESCOLA_DOMAIN` ajustado + certificado emitido
- [ ] `WHATSAPP_APP_SECRET` cadastrado (destrava o webhook real da Meta)
- [ ] `LLM_API_KEY` cadastrado (liga a análise por IA)
- [ ] `AUTH_URL`/URL pública propagada para a Vercel (ou Vercel desligada)
- [ ] Upload de documento testado no volume `/opt/gescola/storage`
- [ ] Backup copiado para fora da VPS
- [ ] Senha do Neon rotacionada (o dump antigo ficou em disco)
