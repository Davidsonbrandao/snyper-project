# Deploy Snyper no EasyPanel / Hostinger

Este projeto ja esta pronto para subir como app frontend containerizado.

Arquitetura recomendada no EasyPanel:

- frontend em `app.snyper.com.br`
- backend em `api.snyper.com.br`

## O que usar

- Tipo de servico: `App`
- Fonte: repositorio Git ou upload com `Dockerfile`
- Porta interna da aplicacao: `80`
- Dominio esperado: `app.snyper.com.br`

## Variaveis de ambiente

Configure no EasyPanel:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUA_PELA_SUA_CHAVE
VITE_SERVER_FUNCTION_BASE=make-server-bd920daa
VITE_API_BASE_URL=
```

Use o arquivo `.env.example` como referencia.

## Passo a passo no EasyPanel

1. Crie um novo projeto.
2. Adicione um servico do tipo `App`.
3. Conecte o repositorio Git do projeto.
4. No build method, use o `Dockerfile` da raiz.
5. Em `Domains & Proxy`, configure `app.snyper.com.br`.
6. Em `Proxy Port`, informe `80`.
7. Em `Environment`, cole as variaveis acima.
8. Clique em `Deploy`.

## DNS

Antes de ativar o dominio, aponte o subdominio:

- Tipo: `A`
- Host: `app`
- Valor: IP publico da VPS

## SSL

Depois que o DNS propagar, o EasyPanel deve emitir o SSL automaticamente via Let's Encrypt ao publicar o dominio.

## Estado atual da migracao

Hoje o frontend ja pode rodar fora do Figma Make e ser publicado em container.

Se `VITE_API_BASE_URL` ficar vazio, o frontend continua usando o backend atual no Supabase.

Quando apontarmos para o backend proprio, preencha por exemplo:

```env
VITE_API_BASE_URL=https://api.snyper.com.br
```

Rotas ja compatibilizadas com o backend proprio:

- `/health`
- `/org`
- `/finance`
- `/team`
- `/profiles`
- `/theme`
- `/invoices`
- `/tickets`
- `/admin`
- `/upload`
- `/auth/profile`

Dependencias ainda ligadas ao Supabase:

- autenticacao por Magic Link
- storage de entregaveis em modo compativel
- atualizacao de perfil do usuario

## Proxima fase tecnica

Separar o backend em um servico proprio para EasyPanel, mantendo:

- auth
- API financeira
- upload de arquivos
- configuracoes multi-tenant

## DNS neste momento

Nao precisa trocar o DNS de `app.snyper.com.br` ainda.

Primeiro vamos:

1. subir frontend e backend novos na VPS
2. validar tudo por dominio tecnico ou URL temporaria
3. so depois trocar o apontamento oficial
