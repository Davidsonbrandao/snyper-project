# Deploy Backend Snyper no EasyPanel

Este guia cobre o backend proprio do Snyper que fica na pasta `server/`.

## Dominio recomendado

- API publica: `api.snyper.com.br`

Nao vamos trocar `app.snyper.com.br` agora.

O ideal e publicar a API primeiro, validar tudo, e so depois ativar o frontend novo apontando para ela.

## Tipo de servico

- Tipo: `App`
- Fonte: repositorio Git
- Dockerfile: `server/Dockerfile`
- Porta interna: `3001`

## Variaveis de ambiente obrigatorias

Use `server/.env.example` como base.

Minimo para o modo de compatibilidade inicial:

```env
NODE_ENV=production
PORT=3001
APP_NAME=Snyper API
APP_URL=https://app.snyper.com.br
ALLOWED_ORIGINS=https://app.snyper.com.br,http://localhost:5173
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=COLE_A_SERVICE_ROLE_KEY
SUPABASE_KV_TABLE=kv_store_bd920daa
```

## Passo a passo

1. Crie um novo servico `App` no EasyPanel.
2. Conecte o repositorio do projeto.
3. Configure o build usando `server/Dockerfile`.
4. Em `Domains & Proxy`, configure `api.snyper.com.br`.
5. Em `Proxy Port`, informe `3001`.
6. Em `Environment`, cole as variaveis acima.
7. Clique em `Deploy`.

## DNS

Quando chegar a hora, crie na Hostgator:

- Tipo: `A`
- Host: `api`
- Valor: IP publico da VPS

## Testes esperados apos deploy

- `https://api.snyper.com.br/health` deve responder `200`
- `https://api.snyper.com.br/org` deve responder `401` sem token
- `https://api.snyper.com.br/finance` deve responder `401` sem token

## Modulos ja suportados nesta fase

- `health`
- `org`
- `finance`
- `team`
- `profiles`
- `theme`
- `invoices`
- `tickets`
- `admin`
- `upload`
- `auth/profile`

## O que ainda continua no Supabase

- Magic Link
- confirmacao de autenticacao
- storage fisico dos entregaveis em modo compativel
- atualizacao direta de perfil autenticado
