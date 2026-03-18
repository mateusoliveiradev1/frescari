# MVP Closure Plan

> Status review atualizado em 2026-03-18 com base no estado atual do repositorio.

## Goal
Fechar um MVP premium no web: experiencia forte no fluxo central de compra, operacao e entregas, incluindo a camada de IA operacional para apoiar analise de entregas e rotas e um sistema de notificacoes web-first.

## Release Rule
O lancamento publico do MVP exige fechamento completo do escopo de produto e do hardening de confiabilidade. Na pratica: 9.1 e 9.2 precisam estar concluidos antes do go-live.

Status atual: regra de release ainda nao atendida.

## Status Summary
- Concluido: 5
- Parcial: 2
- Pendente: 3

## Legend
- `[x]` Concluido
- `[-]` Parcial
- `[ ]` Pendente

## Tasks
- [x] Fechar checkout por fazenda no backend: criar `checkout.createFarmCheckoutSession`, recalcular itens/frete no servidor e salvar `address_snapshot` na metadata.
  Verify: mutation nova existe, testes do router passam e o fluxo nao depende de endereco bruto vindo do cliente.
  Status notes: implementado em `packages/api/src/routers/checkout.ts` e coberto por `packages/api/src/checkout.router.test.ts`.

- [x] Virar o `CartDrawer` para o contrato novo.
  Verify: o CTA deixa de usar `createCheckoutSession` legado e passa a enviar apenas `farmId + addressId + items`.
  Status notes: o drawer usa `trpc.checkout.createFarmCheckoutSession.useMutation` em `apps/web/src/components/CartDrawer.tsx`.

- [x] Adicionar remocao por fazenda no carrinho.
  Verify: existe acao `removeItemsByFarm(farmId)` e so o grupo comprado sai do store.
  Status notes: implementado em `apps/web/src/store/useCartStore.ts` e consumido no checkout por fazenda em `apps/web/src/components/CartDrawer.tsx`.

- [x] Limpar o caminho legado de pedido publico.
  Verify: checkout/webhook publico nao re-geocodifica endereco do comprador e nao confia em `deliveryFee` calculado no frontend.
  Status notes: o webhook principal ja reconstrui pedidos a partir de `address_snapshot` e nao re-geocodifica nesse fluxo novo em `apps/web/src/app/api/webhooks/stripe/route.ts`, com teste em `apps/web/src/app/api/webhooks/stripe/route.test.ts`. Em 2026-03-16, o mutation legado `createCheckoutSession` foi isolado em `packages/api/src/routers/checkout.ts` para falhar com `FORBIDDEN`, e `order.createOrder` passou a apontar para `checkout.createFarmCheckoutSession`.

- [x] Implementar a IA operacional de entregas e rotas no dashboard web.
  Verify: o operador recebe analise clara de prioridades, risco e sugestao de sequenciamento/roteiro a partir dos pedidos pendentes.
  Status notes: a control tower ja entrega score heuristico, risco, confianca, sugestao de veiculo e explicacao operacional em `packages/api/src/delivery-control.ts`, com persistencia de override/wave em `packages/api/src/routers/logistics.ts` e `packages/db/src/schema.ts`. Em 2026-03-17 entrou o corte de `Proxima acao agora` e a confirmacao de wave multi-order no dashboard. Em 2026-03-18 o frontend fechou o refresh com override protegido em `apps/web/src/app/dashboard/entregas/use-delivery-control-refresh.ts` e passou a consumir o mapa contextual pronto do backend em `apps/web/src/app/dashboard/entregas/deliveries-page-client.tsx`, `apps/web/src/app/dashboard/entregas/delivery-map-client.tsx` e `apps/web/src/app/dashboard/entregas/delivery-map-client.test.tsx`. Ainda em 2026-03-18 o backend passou a integrar sinais externos resilientes com fallback silencioso em `packages/api/src/delivery-control.ts`, `packages/api/src/external-risk-signals.ts` e `packages/api/src/routers/logistics.ts`, com cobertura para penalizacao por risco alto e fallback em erro/timeout em `packages/api/src/delivery-control.test.ts`.

- [ ] Implementar o sistema de notificacoes do MVP web.
  Verify: eventos criticos de pedido, entrega e lote geram notificacao no painel e badge/estado visivel nas rotas relevantes.
  Status notes: revisao do repositorio em 2026-03-16 nao encontrou schema, router, store ou UI de notificacoes web do MVP.

- [ ] Subir o hardening obrigatorio de go-live.
  Verify: `noUncheckedIndexedAccess`, Husky/lint-staged e Knip configurados e executando no projeto.
  Status notes: `tsconfig.json` ainda nao ativa `noUncheckedIndexedAccess` e o repositorio nao possui configuracao de Husky, lint-staged ou Knip.

- [-] Fechar polish do core flow.
  Verify: auditoria de teclado/formulario nas rotas principais e ajustes finais do drawer/dashboard aplicados.
  Status notes: houve melhorias de UX e acessibilidade registradas em `docs/architecture/UI_UX_IMPROVEMENTS.md`, mas o proprio documento ainda marca auditoria completa de teclado e formularios como recomendacao pendente.

- [ ] Executar varredura completa do web core rota por rota.
  Verify: catalogo, perfil, checkout, sucesso, fazenda, pedidos e entregas passam por checklist funcional, visual, responsivo e de estados vazios/erro.
  Status notes: existe base de E2E em `apps/web/playwright.config.ts` e o repositorio ja contem `apps/web/e2e/producer-logistics.spec.ts`, mas ainda nao ha varredura completa do core web rota por rota cobrindo catalogo, checkout, sucesso, perfil, pedidos e entregas em checklist unico.

- [-] Rodar verificacao final do MVP web.
  Verify: `test`, `typecheck`, `lint`, `build`, E2E web e checklist basico de seguranca concluidos.
  Status notes: `pnpm check` e `pnpm build` foram validados no fechamento do checkout por fazenda, mas ainda faltam E2E do core web e a etapa basica de seguranca/hardening do plano.

## Out of Scope
- App mobile com Expo
- SQLite offline e sync offline
- E2E mobile
- Push mobile nativo
- Busca geografica de descoberta com `ST_DWithin`

## Done When
- [-] Um comprador consegue navegar, escolher endereco salvo, calcular frete por fazenda e pagar cada fazenda separadamente com seguranca.
  Status notes: o fluxo principal de compra por fazenda esta funcional no web e o legado publico de checkout foi isolado, mas o fechamento total do hardening e da verificacao final ainda nao terminou.

- [-] Um produtor consegue operar fazenda, produtos e lotes no web sem depender de fluxos quebrados ou pendentes.
  Status notes: os fluxos base existem, mas o plano de fechamento ainda pede polish, auditoria de rotas e hardening de go-live.

- [x] O operador de entregas consegue usar a camada de IA para entender prioridade, risco e ordem sugerida de saida.
  Status notes: a fila operacional agora expoe prioridade, risco, confianca, sugestao de veiculo, `Proxima acao agora`, refresh protegido por override manual, contexto de mapa por wave e sinais externos resilientes sem bloquear o despacho.

- [ ] Os eventos principais do fluxo aparecem como notificacoes operacionais no web sem depender de aplicativo mobile.
  Status notes: ainda nao implementado.

- [-] O projeto passa pelos checks de qualidade e fica pronto para um primeiro go-live web serio.
  Status notes: os checks atuais de lint, typecheck, test e build estao rodando, mas o pacote completo de hardening, E2E core e verificacao final do MVP ainda nao foi fechado.

## Next Steps
1. Criar o sistema de notificacoes web do MVP com leitura, badge e eventos operacionais.
2. Aplicar o hardening de go-live: `noUncheckedIndexedAccess`, Husky, lint-staged e Knip.
3. Rodar a varredura completa do core web com E2E e checklist manual das rotas criticas.
4. Rodar a verificacao final do MVP web com `test`, `typecheck`, `lint`, `build`, E2E core e checklist basico de seguranca.
