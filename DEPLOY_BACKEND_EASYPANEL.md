# Passo 2: Deploy do Backend Snyper no EasyPanel

Este guia cobre a API propria do Snyper que fica na pasta `server/`.
Ela guarda login, perfis, equipe, arquivos e dados do sistema diretamente no VPS.

## Dominio recomendado

- API publica: `api.snyper.com.br`

## Tipo de servico

- Tipo: `App`
- Fonte: repositorio Git
- Dockerfile: `server/Dockerfile`
- Porta interna: `3001`

## Variaveis de ambiente obrigatorias

Use `server/.env.example` como base.

```env
NODE_ENV=production
PORT=3001
APP_NAME=Snyper API
APP_URL=https://app.snyper.com.br
API_URL=https://api.snyper.com.br
ALLOWED_ORIGINS=https://app.snyper.com.br
DATA_DIR=/data
UPLOAD_DIR=/data/uploads
BOOTSTRAP_ORG_ID=snyper
BOOTSTRAP_ADMIN_EMAIL=admin@snyper.com.br
BOOTSTRAP_ADMIN_PASSWORD=troque-por-uma-senha-forte
BOOTSTRAP_ADMIN_NAME=Administrador
SESSION_TTL_DAYS=30
INVITE_TTL_DAYS=7
```

## Passo a passo

1. Crie um novo servico `App` no EasyPanel.
2. Conecte o repositorio `snyper-project`.
3. Configure o build usando `server/Dockerfile`.
4. Em `Domains & Proxy`, configure `api.snyper.com.br`.
5. Em `Proxy Port`, informe `3001`.
6. Em `Environment`, cole as variaveis acima.
7. Monte um volume para `DATA_DIR` e `UPLOAD_DIR` se o painel pedir caminho persistente.
8. Clique em `Deploy`.

## DNS

Na Hostinger:

- Tipo: `A`
- Host: `api`
- Valor: IP publico da VPS

## Testes esperados apos deploy

- `https://api.snyper.com.br/health` deve responder `200`
- `https://api.snyper.com.br/auth/me` deve responder `401` sem token
- `https://api.snyper.com.br/org` deve responder `401` sem token

## Modulos ja suportados nesta fase

- `health`
- `auth`
- `org`
- `finance`
- `team`
- `profiles`
- `theme`
- `invoices`
- `tickets`
- `admin`
- `upload`

## O que precisa ficar persistente

- `DATA_DIR`
- `UPLOAD_DIR`

Se o container reiniciar sem volume, os dados locais somem. Por isso a persistencia e importante.

