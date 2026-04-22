# Migracao Snyper: Supabase -> EasyPanel / VPS

## Estado atual

Frontend:

- buildando com Vite
- typecheck limpo
- publicacao pronta via `Dockerfile`
- configuracao sensivel movida para variaveis de ambiente
- rotas com lazy loading para reduzir bundle inicial

Backend:

- ainda dependente de Supabase Auth, Edge Functions, KV e Storage

## Acoplamentos atuais com Supabase

### Autenticacao

Arquivos principais:

- `src/app/lib/auth-context.tsx`
- `src/app/AuthConfirm.tsx`
- `src/app/components/profile-page.tsx`

Uso atual:

- Magic Link
- sessao do usuario
- confirmacao de login
- atualizacao de dados do usuario autenticado

### API HTTP

Arquivo principal:

- `src/app/lib/supabase.ts`

Uso atual:

- `apiFetch`
- `apiFetchUpload`
- chamadas para finance, team, profiles, theme, admin, tickets, invoices e uploads

### Persistencia principal do SaaS

Arquivo principal:

- `supabase/functions/server/index.tsx`

Uso atual:

- dados financeiros
- tenants
- equipe
- temas
- cupons
- tickets
- notas fiscais
- upload de entregaveis

### KV / armazenamento operacional

Arquivo principal:

- `supabase/functions/server/kv_store.tsx`

Uso atual:

- persistencia simples multi-tenant via banco do Supabase

## Ordem correta da migracao

### Fase 1 - Publicacao estavel do frontend

Ja concluida nesta etapa.

### Fase 2 - Backend proprio no EasyPanel

Criar um servico backend dedicado com:

- Node.js
- API REST
- autenticacao
- banco relacional
- storage S3 compativel

Minha recomendacao tecnica atual:

- `PostgreSQL` para dados
- `MinIO` ou storage S3 compativel para arquivos
- backend Node com rotas separadas por dominio

### Fase 3 - Compatibilidade gradual

Trocar primeiro:

1. `apiFetch` e `apiFetchUpload` para apontar para backend proprio
2. modulos administrativos e financeiros
3. uploads
4. autenticacao

### Fase 4 - Corte final do Supabase

Somente depois de:

- login testado em producao
- uploads funcionando
- tenants funcionando
- dominio e SSL estaveis
- backup completo dos dados antigos

## Decisao estrategica

Para minimizar risco comercial, nao vamos desligar o Magic Link do Supabase logo no inicio.

Sequencia mais segura:

1. publicar frontend no EasyPanel
2. subir backend proprio em paralelo
3. migrar APIs e dados
4. migrar auth por ultimo

## Compatibilidade ja implementada

O frontend agora aceita `VITE_API_BASE_URL`.

Com essa variavel vazia:

- continua usando Supabase Functions

Com essa variavel preenchida:

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

passam a usar o backend proprio mantendo o token atual do Supabase.

## Proxima entrega tecnica

Criar a fundacao do backend proprio com:

- estrutura do servico
- healthcheck
- config por ambiente
- CORS
- banco PostgreSQL
- fechamento da camada de compatibilidade de uploads
- migracao gradual da autenticacao
