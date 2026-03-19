# RLS Rollout Runbook

> Runbook operacional para promover o isolamento multi-tenant com PostgreSQL RLS para ambientes remotos. Atualizado em 2026-03-19.

## Estado Atual

- O repositório já contém as migrations e testes de integração que comprovam a barreira estrutural de RLS.
- `DATABASE_URL` deve usar a role restrita de runtime, sem `BYPASSRLS`.
- `DATABASE_ADMIN_URL` deve ser reservado para migrations, bootstrap e tarefas de owner.
- No workspace local, o arquivo raiz `.env` já segue essa divisão.
- O arquivo local `apps/web/.env.local` precisava ser alinhado com a mesma divisão.
- Ainda não há `staging`, `production`, deployments ou secrets cadastrados no GitHub, e este workspace não está linkado a nenhum projeto Vercel.

## Pré-Requisitos

1. Criar ou identificar a role restrita da aplicação no PostgreSQL.
2. Garantir que essa role tenha `rolbypassrls = false`.
3. Garantir que a role administrativa continue disponível apenas para infra.
4. Confirmar que o ambiente remoto onde o app roda aceita duas variáveis separadas:
   `DATABASE_URL`
   `DATABASE_ADMIN_URL`

## Segredos Obrigatórios

- `DATABASE_URL`
  Deve apontar para a role restrita de runtime.
- `DATABASE_ADMIN_URL`
  Deve apontar para a role owner/admin usada em migrations e bootstrap.

## Ordem de Rollout

1. Atualizar os secrets do ambiente remoto.
   `DATABASE_URL` = app user sem `BYPASSRLS`
   `DATABASE_ADMIN_URL` = owner/admin
2. Rodar a migration com credencial administrativa.
   `pnpm --filter @frescari/db db:push`
3. Fazer deploy da aplicação com o runtime já lendo o novo `DATABASE_URL`.
4. Executar o smoke test multi-tenant.
5. Registrar a evidência no checklist de go-live.

## Smoke Test Mínimo

1. Autenticar com um usuário do tenant A.
2. Tentar ler um recurso conhecido do tenant B.
   Esperado: zero linhas ou erro de acesso.
3. Tentar alterar um recurso conhecido do tenant B.
   Esperado: nenhuma linha afetada ou erro de RLS.
4. Repetir o teste em pelo menos:
   `products`
   `product_lots`
   `orders`
   `farms`
   `addresses`

## Verificações Técnicas

- Confirmar no banco que `relrowsecurity = true` e `relforcerowsecurity = true` para as tabelas core.
- Confirmar que a role de runtime retorna `rolbypassrls = false`.
- Confirmar que o runtime principal e o runtime de auth/webhook usam a mesma role restrita.
- Confirmar que `set_config('app.current_tenant', ...)` continua sendo aplicado antes das queries autenticadas.

## Critério de Go

- Migration aplicada sem erro.
- Runtime usando apenas a role restrita.
- Smoke test cross-tenant bloqueado pelo próprio PostgreSQL.
- Nenhum fluxo crítico de auth, checkout ou webhook dependente de `DATABASE_ADMIN_URL`.

## Bloqueios Atuais

- Falta descobrir ou cadastrar o ambiente remoto real de deploy.
- Falta configurar `staging` e `production` com os novos secrets separados.
- Falta executar o smoke test no ambiente remoto após o primeiro deploy.
