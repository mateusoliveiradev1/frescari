# MVP Closure Plan

> Status review atualizado em 2026-03-20 com base no estado atual do repositorio.

## Goal

Fechar um MVP premium no web: compra por fazenda segura, operacao forte no painel, entregas assistidas e notificacoes web-first, com um baseline tecnico que aguente go-live serio.

## Release Rule

O lancamento publico do MVP exige duas coisas ao mesmo tempo:

- baseline de codigo fechado
- validacao operacional final concluida

Status atual: o baseline de codigo esta selado. A validacao operacional final ainda esta aberta.

## Snapshot

- Baseline de codigo: `[x]` selado
- Fluxo central do produto no web: `[x]` fechado
- Cobertura E2E rota por rota do core web: `[x]` fechado
- Verificacao operacional final de go-live: `[ ]` pendente

## Tasks

- [x] Fechar checkout por fazenda no backend.
  Verify: existe mutation dedicada, o servidor recalcula itens/frete e o pedido nasce de dados confiaveis.
  Status notes: `packages/api/src/routers/checkout.ts` concentra o contrato novo e `apps/web/src/components/CartDrawer.tsx` usa esse fluxo no web.

- [x] Virar o carrinho para o contrato novo.
  Verify: o CTA de compra envia apenas os identificadores e itens necessarios; nao monta pedido confiando no frontend.
  Status notes: o drawer do web opera no fluxo por fazenda e o caminho legado publico ficou isolado.

- [x] Garantir remocao por fazenda no carrinho.
  Verify: a compra de uma fazenda nao apaga itens de outra.
  Status notes: o estado do carrinho ja respeita agrupamento por fazenda no fluxo atual.

- [x] Limpar o caminho legado de pedido publico.
  Verify: checkout/webhook nao re-geocodificam endereco bruto nem confiam em taxa enviada pelo cliente.
  Status notes: o webhook do Stripe reconstrui o pedido no servidor e o fluxo legado ficou bloqueado para uso publico.

- [x] Entregar a IA operacional de entregas e rotas no dashboard web.
  Verify: o operador recebe prioridade, risco, confianca, sugestao de veiculo e proxima acao util.
  Status notes: a control tower do MVP ja esta no web e no backend compartilhado.

- [x] Entregar o sistema de notificacoes do MVP web.
  Verify: eventos criticos de pedido, entrega e lote aparecem no painel com inbox e badge.
  Status notes: schema, emissao, router e componentes web do inbox ja existem no monorepo.

- [x] Fechar o hardening tecnico e de seguranca do baseline.
  Verify: `noUncheckedIndexedAccess`, Husky, lint-staged, Knip, RLS e CI/CD minimo estao alinhados ao estado atual do repo.
  Status notes:
  Em 2026-03-19 o runtime de auth passou a usar `DATABASE_URL` restrita, com cobertura para a role de runtime e runbook de rollout de RLS.
  Em 2026-03-20 o monorepo consolidou `db:deploy`, o workflow `.github/workflows/deploy-staging.yml` para push de schema + reaplicacao de RLS em staging, e o ajuste de CI para pular esse deploy quando `DATABASE_ADMIN_URL` nao existir.
  Em 2026-03-20 a higiene local de qualidade foi restaurada: `package.json`, `knip.json`, `.husky/pre-commit` e `packages/validators/package.json` foram corrigidos, a dependencia morta em validators foi removida e `pnpm check` voltou a passar verde no root.
  O workflow `.github/workflows/ci.yml` continua sendo a porta de qualidade do repo com `lint`, `typecheck`, `test` e `knip`.

- [x] Fechar o polish do core flow.
  Verify: teclado, formularios, estados vazios, erros e refinamentos de UX do web core estao auditados.
  Status notes: em 2026-03-20 a aprovacao da suite E2E do comprador consolidou catalogo, checkout, sucesso, perfil e pedidos como fluxo funcional de ponta a ponta para o MVP. O item fica considerado concluido para a release gate de codigo.

- [x] Executar a varredura completa do web core rota por rota.
  Verify: catalogo, perfil, checkout, sucesso, fazenda, pedidos e entregas passam por cobertura E2E suficiente para o MVP.
  Status notes: em 2026-03-20 a malha foi fechada com `apps/web/e2e/buyer-core.spec.ts`, `apps/web/e2e/support/buyer-session.ts` e a regressao complementar existente em `apps/web/e2e/producer-logistics.spec.ts`; `pnpm --filter web test:e2e` passou com 11 testes verdes.

- [ ] Rodar a verificacao operacional final do MVP web.
  Verify: `build`, E2E do core, checklist de seguranca e evidencia de ambiente remoto concluidos.
  Status notes: `pnpm check` ja esta verde, mas isso ainda nao substitui a rodada final de build, E2E completo e execucao da checklist operacional.

## Out of Scope

- App mobile nativo
- Sync offline
- Push mobile
- Busca geografica de descoberta como frente separada

## Done When

- [x] O comprador consegue navegar, calcular frete por fazenda e pagar com seguranca no fluxo web final.
- [ ] O produtor consegue operar fazenda, lotes e pedidos sem depender de fluxos provisiorios.
- [x] O operador de entregas ja consegue usar a camada de IA operacional no painel.
- [x] Os eventos principais do fluxo ja aparecem como notificacoes operacionais no web.
- [ ] O projeto passa por `build`, E2E do core, checklist operacional e sign-off final de go-live.

## Next Steps

1. Rodar `pnpm build` e registrar a evidencia do release candidate.
2. Iniciar a configuracao das variaveis de ambiente na nuvem para a rodada final (Auth, Banco, Stripe e Vercel), sem versionar segredos.
3. Executar `docs/architecture/GO_LIVE_SECURITY_CHECKLIST.md` com evidencia de ambiente e sign-off final.
