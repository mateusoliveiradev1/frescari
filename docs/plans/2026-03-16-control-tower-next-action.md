# Control Tower Next Action Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Exibir a `Proxima acao agora` na mesa de entregas e permitir confirmar uma wave com multiplos pedidos no mesmo fluxo operacional.

**Architecture:** A ordenacao da fila continua no backend via `buildDispatchControlQueue`. O frontend passa a derivar um resumo operacional e uma wave candidata a partir da fila ja ordenada, sem duplicar a logica de score. A confirmacao continua usando `logistics.confirmDispatchWave`, agora enviando mais de um `orderId` quando houver consolidacao valida.

**Tech Stack:** Next.js App Router, React 19, tRPC, Playwright, `node:test`, TypeScript.

---

### Task 1: Extrair a logica da proxima acao

**Files:**
- Create: `apps/web/src/app/dashboard/entregas/delivery-control-summary.ts`
- Test: `apps/web/src/app/dashboard/entregas/delivery-control-summary.test.ts`

**Step 1: Write the failing test**

Criar casos para:
- escolher a primeira entrega despachavel da fila como ancora;
- agrupar pedidos compativeis na mesma wave candidata;
- ignorar pedidos com override `delay` e pedidos ja em `ready_for_dispatch`.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/app/dashboard/entregas/delivery-control-summary.test.ts`
Expected: FAIL porque o helper ainda nao existe.

**Step 3: Write minimal implementation**

Implementar helpers puros para:
- identificar pedidos despachaveis;
- montar a wave candidata com base na ancora;
- calcular labels de resumo para o card `Proxima acao agora`.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/app/dashboard/entregas/delivery-control-summary.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/entregas/delivery-control-summary.ts apps/web/src/app/dashboard/entregas/delivery-control-summary.test.ts
git commit -m "feat: derive next dispatch action"
```

### Task 2: Aplicar o resumo na UI e consolidar multi-order no dialogo

**Files:**
- Modify: `apps/web/src/app/dashboard/entregas/deliveries-page-client.tsx`
- Modify: `apps/web/e2e/support/producer-session.ts`
- Modify: `apps/web/e2e/producer-logistics.spec.ts`

**Step 1: Write the failing test**

Adicionar um E2E que:
- seede pelo menos dois pedidos pendentes;
- abre a mesa logistica;
- confirma a saida pelo fluxo operacional;
- verifica que a mutation `logistics.confirmDispatchWave` recebe dois `orderIds`.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test:e2e -- producer-logistics.spec.ts`
Expected: FAIL porque a UI ainda confirma apenas um pedido por vez.

**Step 3: Write minimal implementation**

Implementar:
- card `Proxima acao agora` no topo;
- estado de dialogo com lista de pedidos selecionados;
- consolidacao padrao dos pedidos compativeis;
- payload multi-order para `confirmDispatchWave`.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test:e2e -- producer-logistics.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/entregas/deliveries-page-client.tsx apps/web/e2e/support/producer-session.ts apps/web/e2e/producer-logistics.spec.ts
git commit -m "feat: add multi-order dispatch review"
```

### Task 3: Validacao final do corte

**Files:**
- Modify: `docs/MVP_CLOSURE_PLAN.md` (somente se o comportamento final divergir do plano atual)
- Modify: `docs/architecture/MVP_PLAN.md` (somente se o comportamento final divergir do plano atual)

**Step 1: Run focused validation**

Run: `pnpm --filter web typecheck`
Expected: PASS

**Step 2: Run repo validation**

Run: `pnpm check`
Expected: PASS

**Step 3: Commit**

```bash
git add docs/MVP_CLOSURE_PLAN.md docs/architecture/MVP_PLAN.md
git commit -m "docs: refresh control tower rollout status"
```
