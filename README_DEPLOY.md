# Deploy na Vercel — descontinuado

> **Este guia está descontinuado.** O sistema **não roda mais na Vercel**.
>
> A produção é **`https://app.scioti.tech`**, na VPS própria (Docker + Traefik +
> PostgreSQL 18 dedicado). O runbook que vale é **[README_VPS.md](README_VPS.md)**.

## O que mudou

| | Antes | Agora |
|---|---|---|
| Hospedagem | Vercel (serverless) | VPS `76.13.123.172` (Docker + Traefik) |
| Banco | Neon (`ep-bitter-lab-...`) | PostgreSQL 18 em container na VPS |
| Domínio | `*.vercel.app` | `app.scioti.tech` (certificado Let's Encrypt) |
| Deploy | push na `main` → build da Vercel | `bash scripts/deploy-vps-docker.sh` (por SSH) |
| Documentos | disco temporário (efêmero) | volume persistente `/opt/gescola/storage` + backup diário |
| Configuração do WhatsApp | variável de ambiente no painel da Vercel | tela **Administração → Integrações** (vale na hora) |

## Por que a Vercel foi abandonada

- O cliente migrou para a infraestrutura própria do **Michel**, com domínio próprio.
- A Vercel é serverless: o filesystem é temporário (documentos perdidos a cada
  deploy) e o banco exigia um serviço externo (Neon).
- Na VPS o sistema fica **mais perto do cliente**, com backup diário, disco
  persistente e controle do ambiente.

## O que fazer com a Vercel (pendente no painel)

1. **Desconectar o repositório** — Vercel → projeto `direta` → *Settings → Git →
   Disconnect*. Isso encerra os deploys automáticos a cada push.
2. **Remover o domínio antigo** (`direta-ten.vercel.app`) — Vercel → *Settings →
   Domains*.
3. Opcionalmente **deletar o projeto** (`direta`) — Vercel → *Settings → General →
   Delete*.
4. **Neon**: o banco antigo continua existindo. Como a Vercel saiu, ele passa a
   ser só uma cópia de segurança dos dados (a VPS tem tudo e backup diário).
   - Mantendo: **gire a senha** no console do Neon — ela ficou exposta no log de
     uma migration antiga.
   - Descartando: pode deletar o projeto no Neon.

## Deploy atual (o que fazer)

```bash
ssh -i ~/.ssh/id_ed25519_direta_vps root@76.13.123.172 \
  "cd /opt/gescola/app && bash scripts/deploy-vps-docker.sh"
```

Detalhes, diagnóstico, backup e restauração: **[README_VPS.md](README_VPS.md)**.
