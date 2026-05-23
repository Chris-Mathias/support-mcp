# Support MVP

Assistente de suporte técnico orientado a projeto. Cada projeto tem sua própria base de documentos e histórico de chat. O LLM usa ferramentas MCP para consultar arquivos do GitLab e documentos PDF anexados.

## Stack

- **Web:** React 19, Vite, Tailwind CSS 4
- **API:** Fastify 5, Prisma, PostgreSQL
- **MCP:** `@modelcontextprotocol/sdk`, ferramentas próprias para documentos e repositório

## Estrutura

```text
.
├── apps/
│   ├── api/                     # API Fastify
│   ├── mcp-server/              # Servidor MCP
│   └── web/                     # Frontend React/Vite
├── docker-compose.coolify.yml   # Deploy via Coolify
├── infra/
│   ├── compose/                 # local-db.yml (dev)
│   └── docker/                  # Dockerfiles, entrypoint.sh, nginx.conf
└── prisma/                      # Schema e migrations
```

## Modelo de Dados

- `Project` → `ChatSession` → `ChatMessage`
- `Project` → `GitlabIntegration`
- `Project` → `ProjectDocument` → `ProjectDocumentChunk`

---

## Dev local

**Pré-requisitos:** Node 20+, npm 10+, Docker

**1. Suba o banco**

```bash
docker compose -f infra/compose/local-db.yml up -d
```

Postgres 16 disponível em `localhost:5433`.

**2. Configure o ambiente**

```bash
cp .env.example .env
```

Edite `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/support_mvp
PORT=3333
ALLOWED_ORIGINS=http://localhost:5173
LLM_API_KEY=           # obrigatório
LLM_MODEL=             # obrigatório (ex: gpt-5.4-nano)
LLM_TITLE_MODEL=       # opcional (ex: gpt-5-nano)
SESSION_SECRET=        # chave para assinatura da sessão
ENCRYPTION_KEY=        # chave para criptografia de tokens GitLab
APP_PASSWORD=          # senha de acesso à aplicação

# Opcionais (defaults abaixo)
SESSION_RETENTION_DAYS=30
RATE_LIMIT_GLOBAL=60
RATE_LIMIT_LLM=15
RATE_LIMIT_UPLOAD=5
RATE_LIMIT_WINDOW=1m
```

*OBS: Gere `SESSION_SECRET` e `ENCRYPTION_KEY` com 2 execuções separadas do comando:

`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**3. Instale as dependências**

```bash
npm install
```

**4. Aplique as migrations**

```bash
npx prisma migrate dev
```

**5. Inicie**

```bash
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:3333`

---

## Deploy via Coolify

**Pré-requisitos:** repositório acessível pelo Coolify, conexão a um banco/schema PostgreSQL

**1. Crie um novo serviço no Coolify via Git**

- Build Pack: **Docker Compose**
- Arquivo de compose: `docker-compose.coolify.yml`

**2. Configure as variáveis de ambiente no Coolify**

```env
DATABASE_URL=          # connection string do banco
LLM_API_KEY=           # obrigatório
LLM_MODEL=             # obrigatório
LLM_TITLE_MODEL=       # opcional
SESSION_SECRET=        # chave para assinatura da sessão
ENCRYPTION_KEY=        # chave para criptografia de tokens GitLab
APP_PASSWORD=          # senha de acesso à aplicação
ALLOWED_ORIGINS=       # URL pública do frontend (ex: https://app.exemplo.com)

# Opcionais (defaults abaixo)
SESSION_RETENTION_DAYS=30
RATE_LIMIT_GLOBAL=60
RATE_LIMIT_LLM=15
RATE_LIMIT_UPLOAD=5
RATE_LIMIT_WINDOW=1m
```

*OBS: Gere `SESSION_SECRET` e `ENCRYPTION_KEY` com 2 execuções separadas do comando:

`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**3. Deploy**

O Coolify executa o build e sobe os containers. As migrations do Prisma rodam automaticamente no startup da API via `entrypoint.sh`.

O nginx (container `web`) serve o frontend e faz proxy de `/api/*` para a API.
