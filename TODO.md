# TODO

## Fase 4 — Dívida Técnica Aprovada

- [ ] Externalizar a URL do client tRPC e remover o hardcode `http://localhost:3000/api/trpc` em `apps/web/src/trpc/Provider.tsx`.
- [ ] Alinhar as versões e a compatibilidade entre `apps/web` (Next 16 / Tailwind 4) e `packages/ui` (Next 15 / Tailwind 3).
- [ ] Implementar a política final de multi-tenancy no banco com RLS e soft delete, eliminando o hard delete atual de lotes em `packages/api/src/routers/lot.ts`.
