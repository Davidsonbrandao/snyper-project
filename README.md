# Snyper Project

Snyper é um SaaS/Micro SaaS em React + Vite com uma camada de backend em Hono para a migração gradual do legado Supabase para infraestrutura própria.

## O que este repositório entrega

- frontend atual sem mudança visual
- compatibilidade com o fluxo legado enquanto a migração acontece
- backend pronto para VPS/EasyPanel
- base organizada para GitHub, deploy e evolução do produto

## Stack

- Frontend: React, Vite, TypeScript
- Backend: Node.js, Hono, TypeScript
- Auth e storage: Supabase durante a transição
- Deploy alvo: Hostinger VPS + EasyPanel

## Como rodar

1. Instale as dependências na raiz.
2. Crie o arquivo `.env` a partir de [`.env.example`](./.env.example).
3. Rode o frontend com `npm run dev`.
4. Rode o backend em `server/` com `npm run dev`.

## Validação

Use `npm run verify` para conferir:

- typecheck do frontend
- build do frontend
- typecheck do backend
- build do backend

## Observações

- O layout não deve ser alterado sem necessidade.
- O objetivo aqui é deixar o sistema limpo, estável e pronto para publicação e deploy profissional.
- O login por e-mail usa `VITE_APP_URL` para funcionar em local, staging e produção.
