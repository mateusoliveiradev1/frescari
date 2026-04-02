# ADR 003 — PostgreSQL RLS para isolamento multi-tenant

**Status:** Aceito
**Data:** 2026-01

---

## Contexto

A Frescari é multi-tenant: produtores veem apenas seus próprios lotes, pedidos e fazendas; compradores veem apenas seus próprios pedidos e endereços. O isolamento de dados é um requisito de segurança não negociável.

## Decisão

Implementar isolamento multi-tenant via **PostgreSQL Row-Level Security (RLS)**, com contexto de tenant injetado em cada transação via `SET LOCAL app.current_tenant = tenantId`.

- O runtime da aplicação usa uma role PostgreSQL sem `BYPASSRLS`
- Migrations e bootstrap usam `DATABASE_ADMIN_URL` (role separada, com `BYPASSRLS`)
- RLS policies cobrem `SELECT`, `INSERT`, `UPDATE`, `DELETE` nas tabelas core
- O estado de RLS é reaplicável via `pnpm --filter @frescari/db db:deploy`

## Alternativas consideradas

| Alternativa | Por que descartada |
|-------------|-------------------|
| Filtro apenas na aplicação (WHERE tenantId = ?) | Vulnerável a bugs de aplicação que esquecem o filtro; sem garantia estrutural |
| Banco por tenant (schema per tenant) | Operacionalmente inviável no MVP; custo de gerenciamento de N conexões/schemas |
| RLS apenas em tabelas críticas | Risco de vazamento de dados em tabelas "secundárias" que eventualmente acumulam dados sensíveis |

## Consequências

- Isolamento estrutural: mesmo um bug de aplicação não vaza dados de outro tenant
- Qualquer query que esqueça o filtro de tenant simplesmente retorna vazio (não vaza)
- O runtime nunca tem `BYPASSRLS`, garantindo que RLS está sempre ativa
- Testes de integração reais validam as policies RLS (`packages/db/src/rls.integration.test.ts`)
- Trade-off: necessidade de `SET LOCAL` em cada transação; overhead mínimo mas presente
