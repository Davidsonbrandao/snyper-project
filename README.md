# Snyper Project

Snyper e um SaaS/Micro SaaS em React + Vite com uma API propria em Hono para rodar totalmente no VPS.

## O que este repositorio entrega

- frontend atual sem mudanca visual
- autenticao local por convite ou senha
- armazenamento local da API no VPS
- backend pronto para EasyPanel e Hostinger

## Stack

- Frontend: React, Vite, TypeScript
- Backend: Node.js, Hono, TypeScript
- Auth e arquivos: API propria no VPS
- Deploy alvo: Hostinger VPS + EasyPanel

## Como rodar

1. Instale as dependencias na raiz e em `server/`.
2. Crie os arquivos `.env` a partir de [`.env.example`](./.env.example) e [`.env.example`](./server/.env.example).
3. Rode o frontend com `npm run dev`.
4. Rode o backend em `server/` com `npm run dev`.

## Validacao

Use `npm run verify` para conferir:

- typecheck do frontend
- build do frontend
- typecheck do backend
- build do backend

## Observacoes

- O layout nao deve ser alterado sem necessidade.
- O login usa a API local do VPS.
- Arquivos e dados precisam de volume persistente no deploy.

