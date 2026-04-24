# Checklist de Go-Live no EasyPanel

Este e o roteiro mais seguro para publicar o Snyper no EasyPanel sem quebrar o dominio atual antes da hora.

## Ordem correta

1. Subir o backend em `api.snyper.com.br`
2. Validar a API nova
3. Subir o frontend no EasyPanel apontando para a API nova
4. Validar tudo por URL final
5. Trocar o DNS do `app.snyper.com.br`

## Antes de entrar no EasyPanel

Tenha em maos:

- IP publico da VPS na Hostinger
- acesso ao DNS do dominio na Hostinger/HostGator
- repositorio Git atualizado com este projeto

## Backend primeiro

Servico:

- tipo: `App`
- contexto: pasta `server/`
- Dockerfile: `server/Dockerfile`
- porta interna: `3001`

Variaveis minimas:

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

Persistencia:

- montar volume em `/data`

DNS:

- criar registro `A`
- host: `api`
- valor: IP da VPS

Validacao:

- `https://api.snyper.com.br/health` deve retornar `200`
- `https://api.snyper.com.br/auth/me` deve retornar `401` sem token

## Frontend depois

Servico:

- tipo: `App`
- contexto: raiz do projeto
- Dockerfile: `Dockerfile`
- porta interna: `80`

Variaveis minimas:

```env
VITE_APP_URL=https://app.snyper.com.br
VITE_API_BASE_URL=https://api.snyper.com.br
```

DNS:

- criar ou trocar registro `A`
- host: `app`
- valor: IP da VPS

Validacao:

- `https://app.snyper.com.br` deve abrir
- a tela de login deve carregar normal
- o login do admin bootstrap deve funcionar

## Teste rapido recomendado

Depois do deploy, rode:

```powershell
.\scripts\check-deploy.ps1
```

## Nao fazer antes da hora

- nao remover o apontamento antigo de `app.snyper.com.br` antes da API nova estar validada
- nao subir frontend apontando para URL errada da API
- nao publicar backend sem volume em `/data`

## Credencial inicial

Na primeira subida do backend, o admin bootstrap e criado automaticamente com:

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`

Depois do primeiro login, a gestao de equipe e convites passa a ser feita dentro do proprio Snyper.
