# Frescari

Marketplace web de hortifruti para operacao B2B/B2C, organizado como monorepo com `pnpm` e `turbo`.

## Estado atual do repositorio

- App deployavel atual: `apps/web`
- Backend de dominio compartilhado: `packages/api`
- Banco, schema e scripts operacionais: `packages/db`
- UI compartilhada: `packages/ui`
- Schemas e contratos Zod: `packages/validators`

Nao existe `apps/api` no estado atual do projeto. O backend do MVP vive como package interno consumido pelo app web. O app mobile continua fora do escopo do MVP atual.

## Stack

- Next.js 16 + React 19
- tRPC v11
- Drizzle ORM + PostgreSQL
- Better Auth
- Tailwind CSS v4
- Stripe
- Turborepo + pnpm

## Modelo operacional atual

- O `admin` mantém o catalogo mestre em `/admin/catalogo`, com categorias e produtos-base.
- O `producer` nao cria uma taxonomia paralela; ele seleciona um item do catalogo mestre ao registrar um lote em `/dashboard/inventario`.
- O lote e a oferta comercial real do produtor: foto, quantidade, preco, colheita, validade e unidade de venda.
- Na versao atual, a unidade escolhida no lote/produto (`kg`, `un`, `cx`, `maco`) guia a experiencia efetiva de catalogo, carrinho e checkout.
- Itens vendidos por peso continuam suportando autorizacao e captura manual no Stripe depois da pesagem final.

## Requisitos

- Node.js 22 recomendado
- `pnpm` 9
- Banco PostgreSQL configurado nas variaveis de ambiente

## Estrutura do monorepo

```text
frescari/
|- apps/
|  `- web/
`- packages/
   |- api/
   |- db/
   |- ui/
   `- validators/
```

## Configuracao local

1. Clone o repositorio e instale as dependencias:

```bash
git clone https://github.com/mateusoliveiradev1/frescari.git
cd frescari
pnpm install
```

2. Preencha as variaveis de ambiente:

- `.env` na raiz para configuracoes compartilhadas
- `apps/web/.env.local` apenas para overrides locais do app web

3. Se precisar alinhar o banco a partir da raiz do monorepo, use os scripts do package `@frescari/db`:

```bash
pnpm --filter @frescari/db db:push
pnpm --filter @frescari/db db:apply-rls
```

Para rollout idempotente de schema + RLS:

```bash
pnpm --filter @frescari/db db:deploy
```

4. Rode o app web:

```bash
pnpm --filter web dev
```

O app sobe em `http://localhost:3000`.

## Comandos uteis

Qualidade do workspace:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm knip
pnpm check
```

Build:

```bash
pnpm build
```

Playwright do app web:

```bash
pnpm --filter web test:e2e
```

Stripe local:

```bash
pnpm stripe:listen
```

## Banco e seguranca

- `DATABASE_URL` deve ser a credencial restrita de runtime (sem BYPASSRLS)
- `DATABASE_ADMIN_URL` deve ficar reservada para migration, bootstrap e tarefas administrativas
- O estado final de RLS fica versionado em `packages/db`
- O checklist operacional de go-live esta em `docs/operations/security-checklist.md`

## Documentacao

| Documento | Descricao |
|-----------|-----------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | SDD central: arquitetura, diagramas C4, ERD, fluxos |
| [`docs/adr/`](docs/adr/README.md) | Architecture Decision Records (9 ADRs) |
| [`docs/guides/`](docs/guides/) | Guias de features: logistica, UI/UX, SEO |
| [`docs/operations/`](docs/operations/) | Runbooks operacionais: bootstrap, RLS, Stripe, backup |
