# Deliveries AI Control Tower Spec

## Goal

Evolve `/dashboard/entregas` from a producer-facing list plus map into an AI-assisted control tower for real farm logistics operations.

The MVP target is not a driver app. The primary persona is the farm operator who decides what leaves first, with which vehicle, and under what operational risk.

## Current Repo Baseline

Current implementation already provides a solid operational base:

- Web control surface in `apps/web/src/app/dashboard/entregas/deliveries-page-client.tsx`
- Operational map in `apps/web/src/app/dashboard/entregas/delivery-map-client.tsx`
- Pending deliveries query in `packages/api/src/routers/logistics.ts`
- Delivery status mutation in `packages/api/src/routers/logistics.ts`
- Current order status enum in `packages/db/src/schema.ts`

Today, the page is a good operational dashboard, but it still lacks:

- AI prioritization
- explicit operational risk
- suggested outbound grouping
- vehicle recommendation
- confidence signaling
- persistent manual override flow

## Product Decisions Locked For MVP

### Primary Persona

- Main persona: farm operations manager
- Secondary use: producer acting as their own operator
- Future persona, out of scope for this web MVP: driver/delivery worker in mobile

### Experience Direction

- The page is a control tower, not a route simulator and not a chat UI
- The main visual anchor is `Proxima acao agora`
- The queue is AI-ordered by default
- The human remains the final decision maker

### Recommendation Scope

The AI must recommend:

- outbound order for the day
- next best action now
- grouped outbound waves when clustering is useful
- vehicle type always
- specific vehicle when simple fleet data exists

The AI must not recommend in MVP:

- specific driver assignment
- irreversible operational actions without human confirmation

## Recommendation Engine

### Core Score Hierarchy

Initial score hierarchy for MVP:

1. delivery window / deadline
2. perishability
3. distance and geographic grouping
4. order value as tie-breaker

This hierarchy is intentional:

- internal urgency drives dispatch
- perishability increases operational risk
- geography optimizes execution
- order value influences tie-breaks, not first principles

### External Signals In V1

External context used in MVP:

- weather
- traffic
- closures / road works

External signals refine the recommendation, but never block the operation.

### Fallback Rule

If weather, traffic, or closure providers fail:

- the page must continue operating
- the queue must still be generated from internal data
- the UI must show that external context is degraded

### Confidence Model

Confidence is shown as:

- alta
- media
- baixa

MVP intentionally avoids percentages to prevent false precision.

Low confidence does not block dispatch, but it requires explicit human review before confirmation.

## Human Control Model

### Manual Actions

The first manual controls in MVP are:

- `Fixar no topo`
- `Adiar para depois`

Full manual drag-and-drop ordering is out of scope for the first cut.

### Override Persistence

Manual overrides persist for the current operational cycle/day.

The AI keeps recalculating in the background, but:

- if no manual override exists, the recommendation can refresh automatically
- if manual override exists, the UI shows `nova recomendacao disponivel` instead of silently reordering the queue

### Override Reason

Override requires a short reason using quick options:

- cliente pediu prioridade
- janela combinada
- carga / veiculo
- problema no endereco
- aguardar separacao
- decisao comercial
- outro

Free text is optional except for `outro`.

Override reason appears:

- compact in the queue
- complete in the detail/history view

## Fleet Model For MVP

The AI can recommend a specific vehicle only if the farm has a simple fleet catalog.

Minimum fleet fields:

- vehicle type
- capacity
- refrigeration flag
- availability status

This keeps the system useful without turning MVP into a full fleet management product.

## Operational Flow

### Current Status Context

Current operational flow already uses statuses such as:

- `payment_authorized`
- `confirmed`
- `picking`
- `in_transit`
- `delivered`

### New State

MVP introduces a new intermediate operational step:

- display label: `Pronto para sair`
- recommended technical enum value: `ready_for_dispatch`

Why this state exists:

- `in_transit` is too early if the vehicle has not actually departed
- only saving a plan without status change is too weak for real operations
- a dispatch-ready state creates traceability between picking and real departure

### Intended Flow

1. AI recommends the next outbound wave
2. operator reviews the wave
3. operator can add or remove deliveries
4. operator confirms the outbound wave
5. orders move to `Pronto para sair`
6. vehicle actually departs
7. orders move to `Em transito`
8. final confirmation moves orders to `Entregue`

### UI Action Guardrails

The delivery card must mirror the same transition contract enforced by the backend.

- `payment_authorized`, `confirmed`, and `picking` only expose `Confirmar saida`
- `ready_for_dispatch` exposes `Saiu para entrega` and may expose `Entregue` as an operator shortcut
- `in_transit` exposes only `Confirmar entrega`
- `delivered` and `cancelled` expose no forward action

This keeps the control tower from inviting invalid transitions before dispatch confirmation and preserves `ready_for_dispatch` as the operational gate between picking and real departure.

## UI Composition

### Page Hierarchy

The page should evolve into four layers:

1. `Proxima acao agora`
2. AI-recommended queue
3. operational map with sequence context
4. supporting metrics and history

### Top Surface

`Proxima acao agora` must show:

- recommended outbound wave
- why it should leave now
- suggested vehicle
- confidence level
- clear CTA to review and confirm

### Queue Cards

Each queue card should expose, in this order:

1. urgency / risk
2. customer + delivery window + order value
3. region / distance / logistics context
4. short AI explanation
5. quick manual actions

### Map

The map should stop being only a destination display and start reflecting:

- recommended grouping
- selected outbound wave
- suggested sequence context

It still does not need turn-by-turn navigation in MVP.

## Persistence Requirements

MVP needs durable storage for at least four things:

- fleet catalog
- confirmed outbound waves
- daily manual overrides
- override reasons / audit trail

Recommendation snapshots may be derived or cached, but manual intervention and confirmed dispatch decisions must be persistent.

## Implementation Slices

Recommended PR order:

1. spec and documentation
2. data model and status transitions
3. internal recommendation engine
4. external signals integration with resilient fallback
5. deliveries page redesign
6. outbound confirmation flow
7. hardening and E2E

This keeps the feature reviewable and reduces risk.

## Validation Criteria

The feature is only considered useful when all of the following are true:

- the AI recommendation is explainable on every item
- low-confidence recommendations are visibly flagged
- external provider failure does not break the queue
- manual override persists during the operating day
- outbound confirmation uses `Pronto para sair` before `Em transito`
- the operator can still make decisions without fighting the system

## Non-Goals

Out of scope for this MVP cut:

- driver mobile UX
- driver assignment optimization
- full fleet management
- route navigation UI
- event-local intelligence beyond weather, traffic, and closures
- confidence percentages

## Why This Is The Right MVP

This spec aims for a strong MVP, not a shallow demo.

It keeps the current web deliveries surface and upgrades it into a dispatch control tower with:

- real operational recommendations
- clear human override
- resilient fallback behavior
- architecture that can later support driver mobile flows without rewriting the operator experience
