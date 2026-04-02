# ADR 009 — Credenciais de runtime restritas (sem BYPASSRLS)

**Status:** Aceito
**Data:** 2026-02

---

## Contexto

O PostgreSQL tem uma flag de role `BYPASSRLS` que ignora Row-Level Security policies. Se o runtime da aplicação usar credenciais com `BYPASSRLS`, qualquer bug no código pode expor dados de qualquer tenant.

## Decisão

Separar as credenciais de banco em dois tipos:

| Variável | Role | `BYPASSRLS` | Quando usar |
|----------|------|------------|-------------|
| `DATABASE_URL` | Role restrita de aplicação | **NÃO** | Runtime da aplicação, webhooks, cron jobs |
| `DATABASE_ADMIN_URL` | Role de admin | **SIM** | Migrations, bootstrap, scripts de produção |

- `DATABASE_URL` é usada em `packages/db/src/db.ts` para todas as queries da aplicação
- `DATABASE_ADMIN_URL` é usada apenas em `packages/db/src/migrate.ts` e scripts de bootstrap
- `DATABASE_ADMIN_URL` nunca é exposta em variáveis de ambiente do Vercel runtime

## Alternativas consideradas

| Alternativa | Por que descartada |
|-------------|-------------------|
| Uma única credencial para tudo | Se comprometida ou com bug de aplicação, RLS pode ser bypassada acidentalmente |
| Credencial separada por tenant | Operacionalmente inviável; custo de gerenciamento de N conexões |
| RLS desabilitada + filtros na aplicação | Sem garantia estrutural; vulnerável a esquecimento de filtro |

## Consequências

- Mesmo com um bug de aplicação, RLS está sempre ativa para queries do runtime
- `DATABASE_ADMIN_URL` é configurada apenas no ambiente GitHub Actions `production` e localmente para devs
- Scripts de bootstrap validam que estão usando a branch correta do Neon antes de executar
- `db:inspect-target` verifica o `EXPECTED_PRODUCTION_NEON_BRANCH_ID` antes de aplicar migrations
- Trade-off: dois conjuntos de credenciais para gerenciar; custo operacional baixo, ganho de segurança alto
