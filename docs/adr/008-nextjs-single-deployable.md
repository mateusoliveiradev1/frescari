# ADR 008 — Next.js App Router como único deployable

**Status:** Aceito
**Data:** 2026-01

---

## Contexto

No início do projeto, existia a possibilidade de separar o frontend (Next.js) de um backend dedicado (`apps/api`). Essa arquitetura "padrão" adiciona complexidade operacional, latência e mais superfície de deployment.

## Decisão

Usar um **único app Next.js** (`apps/web`) como o único deployable do MVP. O backend vive em `packages/api` como package interno — consumido diretamente por `apps/web` sem rede. Não existe `apps/api`.

- **Route handlers** do Next.js expõem tRPC, webhooks, uploads e cron jobs
- **Server Components** consomem `packages/api` diretamente, sem HTTP
- **Vercel** hospeda o app inteiro com zero configuração de infra adicional

## Alternativas consideradas

| Alternativa | Por que descartada |
|-------------|-------------------|
| Frontend Next.js + Backend Express/Fastify separado | Dois serviços para gerenciar; CORS; latência adicional; complexidade de deploy desnecessária no MVP |
| Frontend estático + BFF (Backend for Frontend) | Over-engineering para o tamanho atual do produto |
| Remix | Ainda em avaliação no ecossistema React; Next.js tem maior adoção e melhor suporte Vercel |
| SvelteKit | Requer outro ecossistema; equipe familiar com React/Next |

## Consequências

- Deploy simplificado: `git push` → Vercel constrói e publica
- Server Components chamam `packages/api` sem latência de rede
- Cron jobs do Vercel (`vercel.json`) são route handlers do mesmo app
- `export const runtime = "nodejs"` em routes que precisam de features Node (ex: BullMQ workers CLI)
- `serverExternalPackages` no `next.config.ts` para pacotes como `better-auth` e `drizzle-orm`
- Trade-off: se no futuro o backend precisar de escala independente, será necessário extrair `packages/api` para um serviço separado
