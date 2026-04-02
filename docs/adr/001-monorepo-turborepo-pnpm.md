# ADR 001 — Monorepo com Turborepo + pnpm

**Status:** Aceito
**Data:** 2026-01

---

## Contexto

O projeto Frescari tem múltiplos pacotes com código compartilhado: lógica de API, schema do banco, componentes de UI e schemas Zod. Precisávamos de uma estratégia de organização de código que evitasse duplicação, facilitasse o compartilhamento de tipos e simplificasse o build pipeline.

## Decisão

Usar **pnpm workspaces** para gerenciamento de dependências e **Turborepo** para orquestração de tasks (build, test, lint, typecheck) com cache inteligente.

Estrutura:
- `apps/web` — app Next.js deployável
- `packages/api` — routers tRPC e lógica de negócio
- `packages/db` — schema Drizzle e migrations
- `packages/ui` — componentes React compartilhados
- `packages/validators` — schemas Zod compartilhados

## Alternativas consideradas

| Alternativa | Por que descartada |
|-------------|-------------------|
| Múltiplos repositórios (polyrepo) | Overhead de sincronização de tipos e versões entre repos; dificulta refactoring cross-package |
| npm workspaces + Nx | pnpm tem melhor handling de peer dependencies e é mais leve; Turborepo é mais simples que Nx para o tamanho do projeto |
| Tudo em `apps/web` | Impossibilita separação de concerns; dificulta testar lógica de negócio isoladamente |

## Consequências

- Build com cache: Turborepo reutiliza artefatos entre runs, acelerando CI
- `pnpm install --frozen-lockfile` garante builds reproduzíveis no CI
- Cada package tem seu `tsconfig.json` herdando do root
- Packages internos são referenciados como `workspace:^` sem versionamento manual
- Trade-off: overhead inicial de configuração do monorepo
