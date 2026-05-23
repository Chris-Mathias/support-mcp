# Support MVP

Monorepo para um assistente de suporte técnico orientado a projeto. O sistema combina:

- chat com respostas geradas por LLM
- contexto de documentos enviados pelo usuário
- contexto de repositórios GitLab
- ferramentas MCP para leitura estruturada de arquivos e documentos

O objetivo do projeto é permitir que cada projeto tenha sua própria base de conhecimento e histórico de suporte, com respostas mais precisas e rastreáveis.

## Visão Geral

Hoje o sistema é composto por três aplicações principais:

- `apps/web`: interface React para suporte, projetos, documentos e integração GitLab
- `apps/api`: API Fastify responsável por sessões de chat, documentos, GitLab e orquestração do LLM
- `apps/mcp-server`: servidor MCP com ferramentas para leitura de repositório e documentos

O fluxo principal é:

1. o usuário seleciona um projeto no frontend
2. o projeto pode ter documentos anexados e uma integração GitLab configurada
3. o chat envia a pergunta para a API
4. a API monta o contexto da sessão e chama o LLM
5. o LLM pode usar ferramentas MCP para consultar arquivos e documentos
6. a resposta é transmitida em streaming para o frontend e persistida no banco

## Funcionalidades Atuais

- criação e listagem de projetos
- criação e histórico de sessões de chat por projeto
- envio de mensagens com resposta em streaming
- geração automática de título para sessão
- upload e exclusão de documentos PDF por projeto
- extração e armazenamento de texto de documentos
- cadastro de integração GitLab por projeto
- navegação básica em árvore de arquivos do repositório
- leitura de conteúdo de arquivos do GitLab
- servidor MCP com ferramentas para:
  - visão geral de repositório
  - listagem de árvore
  - busca em conteúdo
  - leitura de trechos e arquivos completos
  - visão geral de documentos
  - leitura e busca em documentos

## Arquitetura

### Frontend

- React 19
- Vite
- Tailwind CSS 4
- Axios para chamadas HTTP regulares
- `fetch` para streaming SSE do chat

### Backend

- Fastify 5
- Prisma
- PostgreSQL
- OpenAI SDK
- `@fastify/cors`
- `@fastify/multipart`

### MCP

- `@modelcontextprotocol/sdk`
- ferramentas próprias para documentos e repositório

## Estrutura do Repositório

```text
.
├── apps/
│   ├── api/          # API Fastify
│   ├── mcp-server/   # Servidor MCP com ferramentas
│   └── web/          # Frontend React/Vite
├── docs/
│   └── deploy/       # Guias de deploy (gitignored)
├── infra/
│   ├── compose/      # docker-compose: dev.yml, prod.yml, coolify.yml
│   └── docker/       # Dockerfiles, entrypoint.sh, nginx.conf
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── package.json
└── README.md
```

## Modelo de Dados

As entidades centrais no banco são:

- `Project`: projeto raiz do sistema
- `ChatSession`: conversa vinculada a um projeto
- `ChatMessage`: mensagens de usuário e assistente
- `GitlabIntegration`: configuração de acesso ao repositório do projeto
- `ProjectDocument`: documento anexado ao projeto
- `ProjectDocumentChunk`: fragmentos do texto extraído para recuperação/busca

## Requisitos

- Node.js 20+
- npm 10+
- Docker e Docker Compose
- acesso a uma chave válida de API para o provedor LLM

## Configuração de Ambiente

Atualmente o código usa diretamente estas variáveis:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/support_mvp
LLM_API_KEY=your_api_key
LLM_MODEL=gpt-5-nano
LLM_TITLE_MODEL=gpt-5-nano
PORT=3333
```

Observações:

- `DATABASE_URL` é exigida pelo Prisma
- `LLM_API_KEY` é obrigatória para o chat funcionar
- `LLM_MODEL` e `LLM_TITLE_MODEL` são opcionais
- `PORT` é opcional na API e o padrão é `3333`

## Subindo o Banco

```bash
docker compose -f infra/compose/dev.yml up -d
```

O `docker-compose` sobe um PostgreSQL 16 com:

- host: `localhost`
- porta: `5433`
- database: `support_mvp`
- usuário: `postgres`
- senha: `postgres`

## Instalação

```bash
npm install
```

## Banco de Dados

Aplicar migrations localmente:

```bash
npx prisma migrate dev
```

Gerar o client do Prisma, se necessário:

```bash
npx prisma generate
```

## Executando em Desenvolvimento

Subir API e frontend:

```bash
npm run dev
```

Rodar apenas a API:

```bash
npm run dev:api
```

Rodar apenas o frontend:

```bash
npm run dev:web
```

Endpoints padrão:

- web: `http://localhost:5173`
- api: `http://localhost:3333`

## Build

Build do monorepo:

```bash
npm run build
```

Builds por aplicação:

```bash
npm run build -w apps/api
npm run build -w apps/web
npm run build -w apps/mcp-server
```

## Observações Importantes

- o chat já usa streaming entre API e frontend
- o endpoint de stream usa SSE sobre `POST`
- o frontend foi reorganizado em componentes reutilizáveis para reduzir acoplamento visual entre páginas
- o repositório ainda não tem uma camada formal de testes automatizados
- existe uma inconsistência conhecida em configuração de TypeScript relacionada a `ignoreDeprecations` em alguns builds, que deve ser corrigida

## Roadmap e Próximos Passos

### Curto prazo

- criar `.env.example` na raiz com todas as variáveis necessárias
- padronizar scripts de banco (`prisma migrate`, `prisma generate`, `prisma studio`)
- corrigir definitivamente a configuração de TypeScript usada nos builds
- adicionar tratamento melhor de erros de streaming no frontend
- adicionar validação mais forte para payloads e respostas da API

### Melhorias de produto

- exibir histórico de uso de ferramentas no chat para depuração
- permitir reprocessamento manual de documentos com falha
- mostrar status de processamento de documentos em tempo real
- permitir múltiplos documentos por upload ou fila de upload
- melhorar o visualizador de arquivos do GitLab com syntax highlight
- adicionar busca textual no explorador GitLab
- suportar pré-visualização de documentos no frontend

### Melhorias de arquitetura

- extrair hooks de domínio no frontend, especialmente para o chat
- separar melhor a camada de serviço do LLM da camada HTTP
- centralizar tipos compartilhados entre `web` e `api`
- introduzir contratos mais claros para eventos de streaming
- reduzir acoplamento entre API e detalhes internos das ferramentas MCP

### Qualidade e segurança

- adicionar testes unitários no frontend e backend
- adicionar testes de integração para chat, documentos e GitLab
- adicionar observabilidade mínima: logs estruturados, correlação por request e métricas
- revisar armazenamento de token GitLab
- criptografar ou proteger segredos sensíveis em repouso
- adicionar rate limit e políticas de segurança para endpoints de suporte

### Evolução funcional

- implementar busca semântica sobre documentos
- enriquecer o contexto do chat com chunking e ranking melhores
- adicionar autenticação e multiusuário
- adicionar autorização por projeto
- suportar múltiplos provedores de LLM
- registrar auditoria de sessões e ações críticas

## Convenções Sugeridas

- manter componentes reutilizáveis em `apps/web/src/components`
- manter lógica de domínio compartilhável em `apps/web/src/lib`
- evitar páginas grandes e concentrar responsabilidade de visualização em componentes menores
- preservar a separação entre:
  - orquestração de estado
  - componentes visuais
  - integração com API

## Estado Atual do Projeto

Este repositório já funciona como MVP navegável com:

- gestão de projetos
- base documental
- integração GitLab
- chat de suporte com streaming

O próximo salto de maturidade está em qualidade operacional, testes, segurança e evolução do mecanismo de recuperação de contexto.
