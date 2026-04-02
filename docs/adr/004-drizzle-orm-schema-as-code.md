# ADR 004 — Drizzle ORM e schema-as-code

**Status:** Aceito
**Data:** 2026-01

---

## Contexto

Precisávamos de uma ORM que: (a) gerasse tipos TypeScript a partir do schema, (b) suportasse features avançadas de PostgreSQL como PostGIS e RLS, (c) permitisse queries customizadas com `sql` template literals quando necessário.

## Decisão

Usar **Drizzle ORM** com o schema definido em TypeScript (`packages/db/src/schema.ts`). Migrations são geradas a partir do schema via `drizzle-kit` e aplicadas de forma idempotente.

## Alternativas consideradas

| Alternativa | Por que descartada |
|-------------|-------------------|
| Prisma | Schema em `.prisma` file cria um layer de abstração extra; suporte a features PostgreSQL avançadas (PostGIS, custom types) é mais limitado |
| TypeORM | Decorators; menos ergonômico com TypeScript moderno; geração de tipos menos precisa |
| Kysely (query builder puro) | Sem migrations gerenciadas; mais boilerplate para CRUD simples |
| SQL puro | Sem type safety; mais propenso a erros em queries complexas |

## Consequências

- Schema é a fonte de verdade: tipos TypeScript derivam do schema, não o contrário
- `drizzle-kit` gera migrations incrementais (diff entre schema atual e banco)
- `sql` template literal do Drizzle é parametrizado: sem SQL injection
- Custom types para PostGIS (`geometry(POINT, 4326)`) são suportados via adaptadores custom
- `db:deploy` é idempotente: pode ser reexecutado sem risco de replicar migrations
- Trade-off: Drizzle é relativamente novo vs Prisma; API muda com mais frequência
