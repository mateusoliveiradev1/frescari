# Control Tower Closure Plan

> Status: concluido e pronto para merge em 2026-03-18 na branch `codex/feat-api-external-risk-signals`.

**Goal:** Fechar a IA operacional de entregas do MVP web sobre a base ja entregue, sem reabrir o que ja esta validado em `Proxima acao agora` e na confirmacao de wave multi-order.

**Baseline ja entregue:**

- fila ordenada com score heuristico, risco, confianca e sugestao de veiculo;
- override manual e persistencia operacional do dia;
- card `Proxima acao agora`;
- revisao e confirmacao de wave com multiplos pedidos;
- cobertura de testes focados e E2E da consolidacao basica.

## Tasks

- [x] Task 1: Expor sinais externos resilientes na recomendacao.
  Verify: a control tower continua operando sem weather/traffic/closures e a UI mostra estado degradado de contexto externo em vez de quebrar ou ocultar a fila.
  Status notes: concluido no backend com `buildDispatchControlQueueWithExternalRiskSignals` em `packages/api/src/delivery-control.ts`, adaptador stub em `packages/api/src/external-risk-signals.ts`, integracao no router em `packages/api/src/routers/logistics.ts` e cobertura de erro/timeout em `packages/api/src/delivery-control.test.ts`.

- [x] Task 2: Fechar o contrato de refresh versus override manual.
  Verify: quando existe override ativo, a fila nao e reordenada silenciosamente; a UI mostra `nova recomendacao disponivel` e o operador decide quando aplicar o refresh.
  Status notes: concluido em 2026-03-18 no frontend web com lock local de override em `apps/web/src/app/dashboard/entregas/use-delivery-control-refresh.ts`, integracao da UI em `apps/web/src/app/dashboard/entregas/deliveries-page-client.tsx` e cobertura em `apps/web/src/app/dashboard/entregas/use-delivery-control-refresh.test.tsx`.

- [x] Task 3: Dar contexto de sequencia para a onda selecionada no mapa.
  Verify: ao selecionar ou revisar uma wave, o mapa destaca a onda, sua ordem sugerida e o contexto geografico da sequencia sem virar navegacao turn-by-turn.
  Status notes: concluido em 2026-03-18 com `mapWaveContext` e `dispatchSuggestion.waveContext` vindos do backend e consumidos diretamente em `apps/web/src/app/dashboard/entregas/deliveries-page-client.tsx` e `apps/web/src/app/dashboard/entregas/delivery-map-client.tsx`.

- [x] Task 4: Validar e sincronizar a documentacao final da IA operacional.
  Verify: testes focados, `pnpm check` e docs de status ficam coerentes com o comportamento entregue.
  Status notes: concluido com a atualizacao de `docs/MVP_CLOSURE_PLAN.md`, `docs/architecture/MVP_PLAN.md` e deste plano, mantendo o estado da control tower coerente com a implementacao mergeavel.

## Done When

- [x] A control tower entrega explicacao operacional, risco, proxima acao, consolidacao de wave, contexto de mapa e degradacao elegante de sinais externos.
- [x] Override manual e refresh convivem sem conflito de UX ou perda de auditoria.
- [x] O item de IA operacional em `docs/MVP_CLOSURE_PLAN.md` permanece parcial apenas se ainda faltar notificacoes ou hardening externos a esta frente.
