# Auditoria Cirúrgica: Minha Fazenda

## Estado atual validado

- O formulário de `Minha Fazenda` usa `react-hook-form` em `apps/web/src/app/dashboard/fazenda/farm-page-client.tsx`.
- O mapa e a captura de coordenadas estão isolados em `FarmMap` via `Controller` e podem permanecer intactos.
- O banco já possui:
  - `pricePerKm`
  - `maxDeliveryRadiusKm`
- A logística ativa já consome `pricePerKm` e `maxDeliveryRadiusKm` em `packages/api/src/routers/logistics.ts`.

## Conflito detectado antes da implementação

A missão pede novas variáveis `deliveryRadiusKm` e `pricePerKm`, mas:

- `pricePerKm` já existe na tabela `farms`
- o raio hoje existe com outro nome: `maxDeliveryRadiusKm`

Isso significa que há duas estratégias possíveis:

1. Compatível e segura:
   Expor `deliveryRadiusKm` na UI/API e mapear internamente para `maxDeliveryRadiusKm`, sem renomear a coluna já usada pela logística.

2. Renomeação estrutural:
   Alterar o banco e o router de logística para trocar `maxDeliveryRadiusKm` por `deliveryRadiusKm`.

## Recomendação

Seguir a estratégia compatível e segura:

- manter o mapa 100% read-only
- manter a coluna física existente `max_delivery_radius_km`
- adicionar o campo `deliveryRadiusKm` apenas no contrato do formulário/API, mapeando para `maxDeliveryRadiusKm` no persistence layer
- reutilizar a coluna existente `price_per_km`

Essa abordagem reduz risco de regressão na logística e provavelmente elimina migration desnecessária.

## Linhas exatas de inserção planejadas

### 1. UI: formulário `Minha Fazenda`

Arquivo: `apps/web/src/app/dashboard/fazenda/farm-page-client.tsx`

- `26-39`
  - estender `FarmFormValues` com:
    - `deliveryRadiusKm: number | string`
    - `pricePerKm: number | string`

- `74-89`
  - incluir defaults em `getDefaultFormValues()`

- `91-110`
  - popular os novos campos em `parseFarmToFormValues()`
  - origem segura:
    - `pricePerKm` vindo do payload do backend
    - `deliveryRadiusKm` vindo do payload do backend, preferencialmente já normalizado

- `494-509`
  - incluir os dois campos em `saveMutation.mutateAsync(...)`

- `929-953`
  - manter `Controller` do mapa exatamente como está
  - inserir os novos inputs logo abaixo do bloco de coordenadas, dentro da mesma section de localização
  - ponto exato sugerido de inserção: após a `div` de coordenadas que termina na linha `953`

Observação:
- `farm-map.tsx` e `farm-map-client.tsx` ficam sem alteração

### 2. Validator Zod

Arquivo: `packages/validators/src/index.ts`

- `150-156`
  - estender `upsertFarmInputSchema` com:
    - `deliveryRadiusKm`
    - `pricePerKm`

- `158`
  - `saveFarmLocationInputSchema` reaproveita o schema acima, então herda a mudança

Observação:
- não existe `updateFarmSchema` no repositório
- o equivalente atual é `upsertFarmInputSchema`

### 3. API tRPC da fazenda

Arquivo: `packages/api/src/routers/farm.ts`

- `29-35`
  - ajustar `mapFarmResponse()` para devolver os campos logísticos que a UI precisa preencher
  - se seguirmos a estratégia segura:
    - mapear `maxDeliveryRadiusKm` -> `deliveryRadiusKm`
    - devolver `pricePerKm` já num formato estável para o form

- `79-83`
  - estender `valuesToPersist` para persistir:
    - `pricePerKm`
    - `maxDeliveryRadiusKm` (recebendo o valor de `deliveryRadiusKm`)

- `102-107`
  - criação inicial da fazenda herda o mesmo `valuesToPersist`

### 4. Banco / schema Drizzle

Arquivo: `packages/db/src/schema.ts`

- `144-155`
  - estado atual já contém:
    - `pricePerKm` na linha `152`
    - `maxDeliveryRadiusKm` na linha `153`

Impacto:
- se seguirmos a estratégia segura, não há inserção física de coluna aqui
- se você exigir o nome físico novo `delivery_radius_km`, aqui entra a alteração estrutural que também exige ajuste em `packages/api/src/routers/logistics.ts`

### 5. Logística já dependente desses campos

Arquivo: `packages/api/src/routers/logistics.ts`

- `218-220`
  - a query já lê:
    - `pricePerKm`
    - `maxDeliveryRadiusKm`

- `240-244`
  - o cálculo de cobertura usa `maxDeliveryRadiusKm`

- `280-282`
  - o cálculo de frete usa `pricePerKm`

Conclusão:
- qualquer rename físico de coluna exige intervenção aqui

### 6. Testes que precisam acompanhar

Arquivo: `packages/validators/src/farm.test.ts`

- `6-22`
  - ampliar payload válido com os novos campos

- `43-56`
  - ampliar caso inválido para validar os novos campos

Arquivo: `packages/api/src/farm.router.test.ts`

- `131-143` e sequência imediata
  - ampliar payload do `saveLocation` com os novos campos

## Escopo

- In:
  - contracts RHF/Zod/tRPC
  - persistência de `pricePerKm`
  - exposição de `deliveryRadiusKm` com compatibilidade
  - inputs abaixo do mapa, sem mexer no fluxo do mapa

- Out:
  - refatoração do mapa
  - alteração visual do layout base
  - mudanças cosméticas

## Próximo passo após confirmação

1. Implementar a estratégia aprovada
2. Se houver migration, gerar e mostrar o SQL antes de qualquer aplicação
3. Rodar `pnpm --filter web exec tsc --noEmit`
