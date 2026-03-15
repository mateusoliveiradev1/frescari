# Frescari - Freight and Checkout Plan

> Documento: `docs/architecture/FREIGHT_PLAN.md`
> Versao: 1.0
> Data: 2026-03-13
> Status: Draft - aguardando aprovacao para implementacao

---

## 1. Objetivo

Definir a especificacao tecnica do novo fluxo de logistica e checkout do Frescari, cobrindo:

- livro de enderecos B2B compartilhado por `tenant_id`
- motor de frete geografico baseado em PostGIS
- checkout visualmente agrupado por `farm_id`, com 1 sessao de pagamento e 1 pedido por fazenda

O objetivo desta fase e somente especificar o desenho tecnico, sem alterar codigo-fonte `.ts` ou `.tsx`.

---

## 2. Estado Atual e Gap Arquitetural

Hoje o repositorio ja possui alguns blocos importantes:

- `packages/db/src/schema.ts` ja possui `farms.location` e `orders.deliveryPoint` com suporte a PostGIS.
- `packages/api/src/geocoding.ts` ja tem geocoding para enderecos de entrega e para localizacao de fazenda.
- `packages/api/src/routers/logistics.ts` ja usa geoespacial, mas apenas para fluxo do produtor apos o pagamento.
- `packages/api/src/routers/checkout.ts` ainda cria uma unica sessao Stripe por carrinho e aceita endereco bruto vindo do frontend.
- `apps/web/src/components/CartDrawer.tsx` ainda trabalha com carrinho unico, frete fixo (`DELIVERY_FEE = 8`) e formulario manual de endereco no drawer.
- `apps/web/src/store/useCartStore.ts` guarda `farmName`, mas nao guarda `farmId`, o que inviabiliza agrupamento tecnico por fazenda.

Principais gaps frente a regra de negocio:

1. Nao existe address book compartilhado por tenant comprador.
2. O geocoding do comprador acontece em checkout/webhook, quando deveria acontecer somente na criacao do endereco.
3. O checkout atual ainda permite misturar itens de multiplos produtores em uma mesma sessao Stripe.
4. O contrato atual de checkout confia em `productName`, `unitPrice` e `imageUrl` enviados pelo cliente, o que nao atende o nivel de integridade esperado.

---

## 3. Visao Geral do Fluxo Alvo

Fluxo alvo, ponta a ponta:

1. Um gerente comprador cria um endereco em `/dashboard/perfil`.
2. O backend geocodifica o endereco uma unica vez e salva:
   - campos textuais do endereco
   - `tenant_id`
   - `location = geometry(POINT, 4326)`
3. Todos os usuarios do mesmo `tenant_id` passam a enxergar esse endereco.
4. No `CartDrawer`, os itens continuam coexistindo no carrinho local, mas sao agrupados visualmente por `farm_id`.
5. O comprador escolhe um endereco salvo.
6. Para cada grupo de fazenda, o frontend chama `logistics.calculateFreight(addressId, farmId)`.
7. O backend calcula a distancia via `ST_DistanceSphere`, valida o raio maximo da fazenda e retorna:
   - distancia em metros/km
   - `base_delivery_fee`
   - `price_per_km`
   - frete total
8. Cada bloco de fazenda exibe:
   - subtotal dos itens daquela fazenda
   - frete dinamico
   - total daquele pedido
   - botao exclusivo `Fechar pedido da Fazenda X`
9. Ao clicar no CTA do bloco, o frontend abre uma sessao Stripe somente para aquela fazenda.
10. O webhook cria exatamente 1 `order` para 1 comprador e 1 vendedor, mantendo o split de pagamento simples.

Decisao central:

- o banco nao tera "mixed order"
- o agrupamento misto existe apenas no carrinho local do frontend
- a unidade de pagamento e pedido passa a ser `tenant comprador + farm`

---

## 4. Alteracoes de Schema em `packages/db`

## 4.1 Nova tabela `addresses`

Tabela nova, pertencente ao contexto do comprador B2B.

Escopo:

- o endereco pertence ao `tenant_id`, nao ao usuario
- diferentes gerentes da mesma empresa compartilham os mesmos locais de entrega
- os campos geograficos sao persistidos no momento da criacao

Estrutura proposta:

| Coluna SQL | Campo Drizzle | Tipo | Regra |
| --- | --- | --- | --- |
| `id` | `id` | `uuid PK` | `defaultRandom()` |
| `tenant_id` | `tenantId` | `uuid FK -> tenants.id` | obrigatorio |
| `title` | `title` | `text` | ex: `Matriz`, `Loja Centro`, `CD Sorocaba` |
| `zipcode` | `zipcode` | `text` | CEP normalizado |
| `street` | `street` | `text` | obrigatorio |
| `number` | `number` | `text` | obrigatorio |
| `neighborhood` | `neighborhood` | `text` | opcional |
| `city` | `city` | `text` | obrigatorio |
| `state` | `state` | `text` | UF com 2 letras |
| `country` | `country` | `text` | default `BR` |
| `complement` | `complement` | `text` | opcional |
| `formatted_address` | `formattedAddress` | `text` | snapshot textual para display |
| `is_default` | `isDefault` | `boolean` | default `false` |
| `location` | `location` | `geometry(POINT, 4326)` | obrigatorio |
| `created_at` | `createdAt` | `timestamptz` | default now |
| `updated_at` | `updatedAt` | `timestamptz` | default now |

Observacoes de desenho:

- `location` deve reutilizar o adapter `postgisPoint` ja existente em `packages/db/src/schema.ts`.
- `formatted_address` deve ser persistido pelo backend para evitar divergencia de formatacao entre telas.
- o endereco fisico deve ser tratado como imutavel para este ciclo:
  - `title` e `isDefault` podem ser atualizados
  - se `street/number/city/state/zipcode` mudarem, o fluxo correto e criar um novo endereco
  - isso preserva a regra "geocoding apenas na criacao"

Constraints e indices recomendados:

- `index addresses_tenant_idx on (tenant_id)`
- `create unique index addresses_one_default_per_tenant on addresses(tenant_id) where is_default = true`
- `create index addresses_location_gist on addresses using gist(location)`
- opcional: `unique (tenant_id, title)` se quisermos impedir titulos repetidos

## 4.2 Alteracoes na tabela `farms`

Adicionar 3 colunas em `farms`:

| Coluna SQL | Campo Drizzle | Tipo sugerido | Default | Uso |
| --- | --- | --- | --- | --- |
| `base_delivery_fee` | `baseDeliveryFee` | `numeric(10,2)` | `0` | taxa fixa minima por entrega |
| `price_per_km` | `pricePerKm` | `numeric(10,2)` | `0` | componente variavel por km |
| `max_delivery_radius_km` | `maxDeliveryRadiusKm` | `numeric(10,2)` | `0` | cobertura maxima da fazenda |

Regras:

- manter as tres colunas `not null` com default `0` para nao quebrar dados existentes
- `0 km` significa "fazenda ainda nao configurada para entregar"
- adicionar checks logicos `>= 0`

## 4.3 Tabela `orders`

Nenhuma mudanca obrigatoria de schema e necessaria para o MVP deste fluxo.

Decisao:

- `orders` continua armazenando snapshot imutavel de entrega:
  - `deliveryStreet`
  - `deliveryNumber`
  - `deliveryCep`
  - `deliveryCity`
  - `deliveryState`
  - `deliveryAddress`
  - `deliveryPoint`
  - `deliveryFee`
- nao adicionar `orders.addressId` nesta etapa

Justificativa:

- evita acoplar o pedido historico a um endereco mutavel do address book
- reduz impacto de migracao
- mantem compatibilidade com dashboards e webhook atuais

## 4.4 Ordem de migracao recomendada

1. Criar tabela `addresses`
2. Criar indices e constraint de default por tenant
3. Adicionar as 3 colunas novas em `farms`
4. Backfill implicito via default `0`
5. Expor novos campos em queries e routers de fazenda

---

## 5. Novos Routers e Schemas Zod

## 5.1 Alteracoes em `packages/validators`

Adicionar novos schemas em `packages/validators/src/index.ts`.

### Address book

- `addressBaseSchema`
- `createAddressInputSchema`
- `updateAddressMetadataInputSchema`
- `deleteAddressInputSchema`
- `setDefaultAddressInputSchema`
- `selectAddressSchema`
- `listAddressesOutputSchema`

Campos minimos esperados:

- `title`
- `zipcode`
- `street`
- `number`
- `neighborhood?`
- `city`
- `state`
- `country?`
- `complement?`
- `isDefault?`

Padroes:

- `zipcode`: regex BR `^\d{5}-?\d{3}$`
- `state`: 2 letras
- `country`: 2 letras, default `BR`

### Freight

- `calculateFreightInputSchema`
  - `addressId: uuid`
  - `farmId: uuid`
- `calculateFreightOutputSchema`
  - `addressId`
  - `farmId`
  - `distanceMeters`
  - `distanceKm`
  - `baseDeliveryFee`
  - `pricePerKm`
  - `maxDeliveryRadiusKm`
  - `freightTotal`

### Checkout por fazenda

- `checkoutFarmItemInputSchema`
  - `lotId: uuid`
  - `quantity: positive number`
- `createFarmCheckoutSessionInputSchema`
  - `farmId: uuid`
  - `addressId: uuid`
  - `items: checkoutFarmItemInputSchema[]`
  - `deliveryNotes?: string`

Observacao importante:

- o novo contrato nao deve aceitar `unitPrice`, `productName`, `imageUrl` nem `deliveryFee` vindos do cliente
- todos esses valores devem ser derivados do banco e do motor de frete no backend

## 5.2 Novo router `address`

Adicionar novo namespace em `packages/api/src/root.ts`:

- `address: addressRouter`

Procedures propostas em `packages/api/src/routers/address.ts`:

- `address.list`
  - `buyerProcedure`
  - retorna todos os enderecos do `ctx.tenantId`
- `address.create`
  - `buyerProcedure`
  - geocodifica o endereco uma unica vez
  - persiste `location`
  - se for o primeiro endereco do tenant, forca `isDefault = true`
  - se `isDefault = true`, zera o anterior dentro de transacao
- `address.updateMetadata`
  - `buyerProcedure`
  - atualiza apenas `title` e/ou `isDefault`
- `address.delete`
  - `buyerProcedure`
  - remove endereco do tenant
  - se apagar o default e ainda existirem outros, promove outro endereco
- `address.getDefault`
  - `buyerProcedure`
  - retorna o endereco default do tenant

Regra operacional:

- geocoding deve existir somente dentro de `address.create`
- `checkout`, `order` e `webhook` nao podem chamar geocoding para enderecos do comprador

## 5.3 Extensoes no router `farm`

Necessarias para o produtor configurar frete:

- `farm.getCurrent` passa a retornar, de forma aditiva:
  - `baseDeliveryFee`
  - `pricePerKm`
  - `maxDeliveryRadiusKm`
- nova mutation `farm.saveDeliveryConfig`
  - input:
    - `baseDeliveryFee`
    - `pricePerKm`
    - `maxDeliveryRadiusKm`
  - `producerProcedure`

Isso evita quebrar o contrato atual de `farm.saveLocation`.

## 5.4 Nova procedure `logistics.calculateFreight`

Adicionar em `packages/api/src/routers/logistics.ts`.

Tipo:

- `buyerProcedure`
- preferencialmente `query`, pois e um calculo puro e idempotente

Contrato:

- input: `addressId`, `farmId`
- output: breakdown completo do frete

Validacoes obrigatorias:

1. o endereco precisa pertencer ao `ctx.tenantId`
2. a fazenda precisa existir
3. `farms.location` precisa existir
4. `addresses.location` precisa existir
5. `maxDeliveryRadiusKm > 0`
6. a distancia calculada precisa ser `<= maxDeliveryRadiusKm`

Formula:

```sql
distance_meters = ST_DistanceSphere(farms.location, addresses.location)
distance_km = ROUND(distance_meters / 1000.0, 2)
freight_total = ROUND(base_delivery_fee + (price_per_km * distance_km), 2)
```

Erros esperados:

- `NOT_FOUND`: fazenda ou endereco inexistente
- `FORBIDDEN`: endereco nao pertence ao tenant logado
- `PRECONDITION_FAILED`: fazenda sem localizacao ou sem configuracao de frete
- `BAD_REQUEST`: fora da area de cobertura

Mensagem funcional obrigatoria:

- `"Fora da area de cobertura"`

## 5.5 Novo contrato de checkout por fazenda

Em vez de quebrar o contrato atual imediatamente, a estrategia recomendada e aditiva:

- manter `checkout.createCheckoutSession` legado durante a transicao
- introduzir `checkout.createFarmCheckoutSession` para o novo fluxo

Comportamento esperado de `checkout.createFarmCheckoutSession`:

1. validar `addressId` do tenant comprador
2. validar que todos os lotes pertencem ao `farmId` informado
3. recalcular preco dos itens a partir do banco
4. recalcular frete chamando a mesma rotina de dominio usada por `logistics.calculateFreight`
5. montar uma sessao Stripe com somente uma fazenda
6. salvar em metadata:
   - `buyer_tenant_id`
   - `farm_id`
   - `address_id`
   - `address_snapshot`
   - `delivery_point`
   - `delivery_fee`
   - `items`
   - `delivery_notes` se existir

Decisao de integridade:

- a metadata deve carregar snapshot do endereco selecionado, inclusive coordenadas
- o webhook deve reconstruir o pedido a partir desse snapshot
- isso elimina qualquer necessidade de geocoding no webhook

## 5.6 Webhook Stripe e `order` router

O webhook atual ja cria `orders` a partir da sessao, mas hoje ainda suporta sessao misturada.

Meta da arquitetura final:

- 1 sessao Stripe nova = 1 fazenda = 1 order

Plano de compatibilidade:

- fase 2: webhook aceita o metadata novo sem remover o legado
- fase 3: apos a virada do frontend, o caminho legado pode ser removido

Observacao sobre `order.createOrder`:

- a mutation atual ja agrupa por seller, mas ainda recebe endereco bruto e re-geocodifica
- ela nao deve ser usada como base do novo fluxo publico do comprador
- se for mantida, deve ser alinhada ao contrato `farmId + addressId + items`

---

## 6. Alteracoes de Frontend em `apps/web`

## 6.1 Contratos de dados que precisam mudar

### `lot.getAvailableLots`

Hoje o retorno inclui `farmName`, mas nao inclui `farmId`.

Adicionar, de forma aditiva:

- `farmId`

Isso impacta:

- `packages/api/src/routers/lot.ts`
- `apps/web/src/store/useCartStore.ts`
- `apps/web/src/components/ProductCardWrapper.tsx`
- qualquer tipagem local que consuma `CatalogLot`

### `useCartStore`

`CatalogLot` e `CartItem` passam a incluir:

- `farmId: string`

O carrinho continua unico no frontend, mas o agrupamento visual passa a ser:

- `groupBy(items, item.farmId)`

## 6.2 Nova pagina `/dashboard/perfil`

Criar uma nova aba/pagina para comprador:

- `apps/web/src/app/dashboard/perfil/page.tsx`
- cliente associado, por exemplo `buyer-profile-client.tsx`

Responsabilidades da tela:

- listar enderecos do tenant
- criar endereco novo
- marcar endereco default
- renomear `title`
- excluir endereco

Fluxo de UX:

- se nao houver endereco salvo, mostrar CTA primario para criar o primeiro
- se houver endereco default, destacar visualmente
- toda criacao de endereco deve exibir sucesso somente apos geocoding e persistencia
- falhas de geocoding devem aparecer como erro de formulario, nao como falha generica do checkout

Tambem sera necessario adicionar link de navegacao para comprador em `global-nav.tsx`:

- `Perfil e Enderecos` apontando para `/dashboard/perfil`

## 6.3 Alteracoes no `CartDrawer`

O `CartDrawer` atual precisa ser dividido em dois blocos conceituais:

### Bloco A - seletor de endereco

- remover os campos manuais:
  - `deliveryStreet`
  - `deliveryNumber`
  - `deliveryCep`
  - `deliveryCity`
  - `deliveryState`
- substituir por:
  - query `address.list`
  - selecao de `addressId`
  - fallback automatico para `address.getDefault`
  - link `Gerenciar enderecos` para `/dashboard/perfil`

### Bloco B - grupos por fazenda

Para cada `farmId` unico no carrinho:

- cabecalho com nome da fazenda
- lista de itens daquela fazenda
- subtotal dos itens
- status do frete:
  - loading
  - sucesso
  - fora da cobertura
  - fazenda sem configuracao
- total do bloco
- CTA exclusivo:
  - `Fechar pedido da Fazenda X`

Regras de habilitacao do CTA:

- endereco selecionado obrigatorio
- frete calculado com sucesso
- nenhuma linha do grupo pode estar acima do estoque

Se a fazenda estiver fora da cobertura:

- o bloco continua visivel
- exibe erro local
- CTA fica desabilitado
- os demais blocos continuam operaveis

## 6.4 Calculo de valores no drawer

Por grupo de fazenda:

- `groupSubtotal = soma(item.finalPrice * item.cartQty)`
- `groupFreight = retorno de logistics.calculateFreight`
- `groupTotal = groupSubtotal + groupFreight`

Mensagem de UX recomendada:

- "Cada fazenda gera um pedido e um pagamento separado."

## 6.5 Fluxo de checkout no frontend

Ao clicar no CTA de um grupo:

1. frontend envia apenas:
   - `farmId`
   - `addressId`
   - `items[{ lotId, quantity }]` daquele grupo
2. backend retorna URL da sessao Stripe
3. frontend redireciona
4. apenas os itens daquele grupo sao removidos do carrinho local apos sucesso confirmado do redirect inicial

Observacao importante:

- `clearCart()` global nao serve mais
- o store precisa ganhar uma acao do tipo `removeItemsByFarm(farmId)` ou equivalente

## 6.6 Tela do produtor em `/dashboard/fazenda`

Como `farms` tera tres campos novos, a tela da fazenda tambem precisa receber:

- `Taxa base de entrega`
- `Preco por km`
- `Raio maximo de entrega (km)`

Esses campos nao precisam entrar no `saveLocation` existente.
O mais seguro e introduzir uma secao propria de "Configuracao de Entrega" ligada a `farm.saveDeliveryConfig`.

---

## 7. Plano de Execucao Fatiado

## Fase 1 - Fundacao de dados e address book

Objetivo:

- adicionar todas as estruturas persistentes sem quebrar o checkout atual

Escopo:

- criar tabela `addresses`
- criar indices e constraint de default
- adicionar colunas de frete em `farms`
- expor `addressRouter`
- expor novos campos de `farm.getCurrent`
- adicionar `farm.saveDeliveryConfig`
- criar `/dashboard/perfil`
- manter `CartDrawer` atual funcionando sem usar os novos recursos

Criterio de saida:

- comprador consegue criar e listar enderecos
- produtor consegue salvar configuracao de entrega
- nenhum fluxo atual de catalogo, pedido ou webhook foi removido

## Fase 2 - Motor de frete e novo contrato de checkout

Objetivo:

- introduzir o calculo geografico e o fluxo backend seguro por fazenda, sem ainda virar o drawer inteiro

Escopo:

- adicionar `logistics.calculateFreight`
- adicionar `createFarmCheckoutSessionInputSchema`
- adicionar `checkout.createFarmCheckoutSession`
- fazer o webhook aceitar metadata nova baseada em `address_snapshot` e `delivery_point`
- parar de geocodificar endereco do comprador em checkout/webhook no novo caminho
- adicionar `farmId` ao retorno de `lot.getAvailableLots`
- adicionar `farmId` em `CatalogLot` e `CartItem`

Criterio de saida:

- existe um caminho novo funcional de sessao Stripe por fazenda
- o backend nao confia mais em `unitPrice` ou `productName` do cliente nesse novo caminho
- o legado continua disponivel enquanto o frontend ainda nao migrou

## Fase 3 - Virada do frontend para o carrinho estilo Shopee

Objetivo:

- ativar a UX final de checkout separado por produtor

Escopo:

- agrupar `CartDrawer` por `farmId`
- trocar formulario manual por seletor de endereco salvo
- mostrar frete dinamico por bloco
- adicionar CTA por fazenda
- remover itens apenas do grupo comprado
- atualizar copy e estados visuais
- apos estabilizacao, deprecar o contrato legado de checkout misto

Criterio de saida:

- usuario comprador consegue manter itens de varias fazendas no carrinho
- cada pagamento fecha somente o pedido da fazenda correspondente
- o banco continua recebendo 1 `order` para 1 comprador e 1 vendedor

---

## 8. Decisoes Arquiteturais Importantes

1. O address book e tenant-scoped, nao user-scoped.
2. O geocoding do comprador acontece apenas em `address.create`.
3. O pedido continua armazenando snapshot de entrega, nao referencia viva para `addresses`.
4. O frete e calculado por fazenda, nao por item.
5. O frontend pode ter carrinho misto local; o backend nao tera pedido misto.
6. O novo checkout nao aceita preco nem nome do produto vindo do cliente.
7. A migracao sera aditiva primeiro, para nao quebrar o compilador TypeScript nem o webhook atual.

---

## 9. Fora de Escopo Deste Ciclo

- roteirizacao multi-drop
- tabelas de zonas/logistica por bairro
- janelas de entrega por endereco
- politica de frete gratis por ticket minimo
- integracao com transportadoras externas
- soft delete ou versionamento de enderecos

---

## 10. Resultado Esperado ao Final da Implementacao

Ao final das 3 fases, o Frescari tera:

- um livro de enderecos B2B compartilhado por empresa compradora
- um motor de frete geografico nativo em PostGIS
- um checkout separado por produtor, compativel com Stripe Connect
- um fluxo de pedido coerente com a regra "1 comprador -> 1 vendedor -> 1 pedido"
- um caminho de migracao seguro, sem troca abrupta de contratos
