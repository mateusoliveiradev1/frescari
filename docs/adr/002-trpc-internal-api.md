# ADR 002 — tRPC como API interna (sem serviço separado)

**Status:** Aceito
**Data:** 2026-01

---

## Contexto

O MVP precisava de uma camada de API type-safe entre o frontend Next.js e a lógica de negócio no backend. A alternativa mais óbvia seria criar um serviço REST ou GraphQL separado, mas isso adicionaria complexidade de deployment e latência.

## Decisão

Usar **tRPC v11** com o backend em `packages/api` (package interno do monorepo), consumido diretamente por `apps/web` via import. Não existe um `apps/api` separado — a lógica de backend vive em um package compartilhado.

O tRPC usa HTTP internamente via route handlers do Next.js (`/api/trpc/[trpc]`), mas durante Server Components o consumo é direto (sem overhead de rede).

## Alternativas consideradas

| Alternativa | Por que descartada |
|-------------|-------------------|
| REST API separado (apps/api) | Segunda superfície deployável aumenta complexidade de infra e latência no MVP |
| GraphQL (Apollo/Pothos) | Overhead de schema definition e resolver mapping sem benefício real no MVP com um único cliente |
| Server Actions apenas | Não cobre o caso de uso de query/mutation client-side com cache (React Query) |
| REST handlers em Next.js | Sem type safety end-to-end; mais boilerplate |

## Consequências

- Type safety completa do input ao output sem geração de código
- Client-side usa `@trpc/react-query` com TanStack Query para caching e invalidation
- Procedures são organizadas por domínio: `checkout`, `order`, `farm`, `lot`, etc.
- Middleware de procedures implementa RBAC: `publicProcedure`, `protectedProcedure`, `tenantProcedure`, `producerProcedure`, `buyerProcedure`, `adminProcedure`
- Trade-off: acoplamento entre frontend e backend no mesmo repositório — aceitável para MVP, revisável em escala
