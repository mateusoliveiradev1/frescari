# Frescari - Plano de Arquitetura do MVP

> Documento vivo alinhado ao estado real do repositorio em 2026-03-20.
> Escopo atual: `apps/web` + `packages/*`.
> Status: MVP web-first com codigo selado e validacao operacional final em andamento.

## 1. Visao do produto

Frescari e um marketplace de hortifruti com operacao web para:

- publicar catalogo indexavel e orientado a SEO
- permitir compra por fazenda com checkout seguro
- operar fazenda, produtos, lotes e pedidos no painel web
- apoiar despacho e entregas com heuristicas operacionais
- manter notificacoes criticas do fluxo dentro do proprio painel

O objetivo do MVP nao e cobrir toda a visao futura do produto. O objetivo e fechar com qualidade o fluxo web que ja vende, opera e permite aprender com seguranca.

## 2. Verdade do repositorio hoje

O estado atual do projeto e:

- existe um unico app deployavel: `apps/web`
- o backend do dominio nao vive em `apps/api`; ele vive em `packages/api`
- `packages/api` concentra routers tRPC, servicos de negocio, workers e integracoes
- `packages/db` concentra schema Drizzle, scripts de banco e o estado final de RLS
- `packages/ui` e `packages/validators` sustentam o contrato compartilhado do monorepo
- `apps/mobile` e a estrategia offline-first continuam fora do MVP atual

Em outras palavras: o MVP de hoje e um produto web com backend interno em packages compartilhados.

## 3. Estrutura real do monorepo

```text
frescari/
|- apps/
|  `- web/                # Next.js App Router, catalogo, dashboard, webhooks, cron routes
`- packages/
   |- api/                # tRPC routers, servicos, workers, regras de negocio
   |- db/                 # schema Drizzle, scripts de banco, RLS, migrations
   |- ui/                 # componentes React compartilhados
   `- validators/         # schemas Zod e contratos compartilhados
```

## 4. Stack efetiva do MVP

| Camada | Tecnologia | Papel no MVP |
| --- | --- | --- |
| App web | Next.js 16 + React 19 | Catalogo publico, auth, dashboards, route handlers |
| Backend interno | tRPC v11 em `packages/api` | Mutations, queries, regras de dominio |
| Banco | PostgreSQL + Drizzle ORM | Persistencia principal |
| Seguranca de dados | PostgreSQL RLS | Isolamento estrutural multi-tenant |
| UI compartilhada | `@frescari/ui` | Design system React |
| Contratos | Zod em `@frescari/validators` | Validacao runtime e tipos compartilhados |
| Pagamentos | Stripe | Checkout por fazenda e webhook |
| Qualidade | GitHub Actions + `pnpm check` | Lint, typecheck, test e Knip |
| Operacao agendada | Vercel cron + wrappers no web | Frescor de lotes e varreduras operacionais |

## 5. Arquitetura de runtime

O fluxo de runtime do MVP e este:

1. `apps/web` serve o catalogo publico, as rotas autenticadas e os endpoints HTTP.
2. As rotas de API do app web expoem tRPC, auth, webhook Stripe, upload e cron jobs.
3. `packages/api` contem a logica de negocio usada por essas rotas.
4. `packages/api` fala com `packages/db` para persistencia e usa `packages/validators` para input/output.
5. `packages/ui` entrega os componentes compartilhados usados pelo app web.

Essa arquitetura e deliberadamente enxuta: um unico app em producao, com packages internos para manter separacao de responsabilidades sem criar uma segunda superficie deployavel.

## 6. Dominios que o MVP ja cobre no codigo

### Catalogo e descoberta

- catalogo publico indexavel
- paginas por categoria, produto e fornecedores
- metadados e superficie SEO no app web

### Compra e pagamento

- livro de enderecos do comprador
- checkout por fazenda
- recalculo server-side de itens e frete
- Stripe Checkout
- webhook com idempotencia e reconstrucao do pedido no servidor

### Operacao

- dashboard producer para fazenda, inventario, lotes e pedidos
- dashboard admin para catalogo mestre e gestao operacional
- control tower de entregas com score, risco e sugestao operacional
- inbox e notificacoes web-first

## 7. Banco, RLS e CI/CD

O baseline tecnico atual do MVP depende destas decisoes:

- `DATABASE_URL` e a credencial restrita de runtime
- `DATABASE_ADMIN_URL` fica reservada para migration, bootstrap e tarefas de owner
- o estado final de RLS e reaplicavel via `pnpm --filter @frescari/db db:deploy`
- o app principal e os fluxos de auth/webhook usam a mesma role restrita de runtime
- o workflow `ci.yml` executa `lint`, `typecheck`, `test` e `knip`
- o workflow `deploy-staging.yml` faz push de schema e reaplicacao de RLS em staging quando `DATABASE_ADMIN_URL` existe
- `vercel.json` versiona os cron jobs operacionais do app web

## 8. Escopo real do fechamento do MVP

### Fechado no codigo

- checkout por fazenda no contrato novo
- pipeline de pedido sem confiar em endereco bruto vindo do frontend
- notificacoes operacionais no web
- IA operacional de entregas/rotas no painel
- RLS como barreira estrutural multi-tenant
- baseline de qualidade com Husky, lint-staged, Knip e `pnpm check`
- cobertura E2E suficiente do core web, incluindo comprador, fazenda e entregas no fluxo do MVP

### Ainda aberto antes do go-live

- o codigo do MVP esta selado; o que resta e readiness operacional antes do go-live
- rodar `build` final do release candidate
- iniciar a configuracao de variaveis de ambiente e segredos na nuvem para a rodada final
- executar a checklist operacional de seguranca
- validar ambientes remotos, segredos e evidencia de recovery

### Fora do escopo deste MVP

- app mobile nativo
- sincronizacao offline
- push mobile
- um app backend separado em `apps/api`

## 9. Referencias de fechamento

- `docs/MVP_CLOSURE_PLAN.md`
- `docs/architecture/GO_LIVE_SECURITY_CHECKLIST.md`
- `docs/architecture/RLS_ROLLOUT_RUNBOOK.md`

Esses documentos sao a trilha de fechamento do MVP. Este arquivo define a arquitetura real; os outros dois definem a prontidao operacional.
