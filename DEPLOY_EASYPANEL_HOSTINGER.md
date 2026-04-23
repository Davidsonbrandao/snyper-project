# Passo 1: Publicar o Frontend do Snyper no EasyPanel / Hostinger

Este e o primeiro passo seguro da migracao: publicar apenas o frontend no VPS e apontar ele para a API propria.

## Objetivo

- subir a interface do Snyper em `app.snyper.com.br`
- fazer o frontend falar com `api.snyper.com.br`
- manter o layout igual

## O que este passo usa

- servico `App` no EasyPanel
- `Dockerfile` da raiz do projeto
- porta interna `80`
- dominio `app.snyper.com.br`

## Antes de comecar

Confirme estes pontos no codigo:

- o build do frontend passa
- o backend proprio tambem passa
- `VITE_API_BASE_URL` aponta para `https://api.snyper.com.br`

## Variaveis de ambiente do frontend

Use estas variaveis no servico do frontend no EasyPanel:

```env
VITE_APP_URL=https://app.snyper.com.br
VITE_API_BASE_URL=https://api.snyper.com.br
```

## Passo a passo no EasyPanel

1. Entre no EasyPanel.
2. Crie um novo `Project`.
3. Adicione um servico do tipo `App`.
4. Conecte o repositorio `snyper-project` do GitHub.
5. Em `Build`, selecione o `Dockerfile` da raiz do projeto.
6. Em `Domains & Proxy`, adicione o dominio `app.snyper.com.br`.
7. Defina a `Proxy Port` como `80`.
8. Em `Environment`, cole as variaveis acima.
9. Clique em `Deploy`.

## DNS

No painel da Hostinger, crie o apontamento:

- Tipo: `A`
- Nome/Host: `app`
- Valor: IP publico da VPS

## SSL

Depois que o DNS propagar, o EasyPanel deve emitir o SSL automaticamente via Let's Encrypt.

## Como saber se deu certo

Abra no navegador:

- `https://app.snyper.com.br`

O esperado e:

- a pagina carregar sem quebrar o visual
- o login abrir normalmente
- as chamadas irem para a API do VPS

## Se ficar em `Waiting for service...`

O erro mais comum e o dominio estar apontando para a porta errada.

Para o frontend do Snyper, a porta certa e `80`.

Se o EasyPanel estiver com `3000`, troque para `80` e salve de novo.
O `Dockerfile` da raiz sobe o site com `nginx`, e o `nginx` escuta na porta `80`.

## O que nao fazer agora

- nao mexer no layout
- nao apontar o frontend para outro lugar
- nao misturar a porta do backend com a do frontend

## Proximo passo depois disso

Quando o frontend estiver no ar, suba o backend proprio em `api.snyper.com.br` usando o guia separado.

