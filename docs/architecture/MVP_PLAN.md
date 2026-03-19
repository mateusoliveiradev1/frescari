# Frescari — Plano de Arquitetura MVP

> **Documento:** `docs/architecture/MVP_PLAN.md`
> **Versão:** 1.0 — 2026-03-04
> **Autor:** Arquiteto de Software Líder
> **Status:** 📋 DRAFT — Aguardando aprovação

---

## 1. Visão Geral do Produto

**Frescari** é uma infraestrutura SaaS B2B e Marketplace para o setor de **Hortifruti (produtos frescos)** no Brasil. O sistema conecta produtores rurais, distribuidores e compradores (restaurantes, redes de varejo, processadoras), com foco em:

- Logística **hyper-local** e rastreabilidade da cadeia de frio
- Gestão de **validade e perecibilidade** em tempo real
- Vendas por **peso (Kg/g)** e por **unidade (cx, dz, mç)** no mesmo catálogo
- App mobile **offline-first** para produtores no campo
- Catálogo público indexável para **SEO Programático**

---

## 2. Stack Técnica de Alta Integridade

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Monorepo** | Turborepo | Cache remoto, pipelines paralelas, build incremental |
| **Backend API** | Node.js + tRPC v11 | Type-safety E2E sem geração de código |
| **Frontend** | Next.js 15+ (App Router) | RSC, streaming, layouts aninhados, ISR/SSR |
| **Mobile** | React Native + Expo SDK 52 | Offline-first com Expo SQLite + sync |
| **Banco de Dados** | PostgreSQL 16 + PostGIS 3.4 | Geoespacial nativo, extensões ricas |
| **ORM** | Drizzle ORM | Queries type-safe, migrations versionadas, zero-runtime overhead |
| **Validação** | Zod v3 | Schema único: validação runtime + tipos estáticos |
| **Autenticação** | Lucia Auth ou Better Auth | Sessões DB-backed, suporte a multi-tenant |
| **Fila de Tarefas** | BullMQ + Redis | Sincronização offline, notificações, expiração de lotes |
| **Armazenamento** | Cloudflare R2 | Fotos de produtos, documentos de rastreabilidade |
| **CI/CD** | GitHub Actions + Turborepo Remote Cache | Build apenas do que mudou |

---

## 3. Estrutura do Monorepo

```
frescari/
├── apps/
│   ├── web/                  # Next.js 15 — Marketplace + painel B2B
│   ├── mobile/               # Expo React Native — app do produtor
│   └── api/                  # Node.js HTTP server (Entry point do tRPC)
│
├── packages/
│   ├── db/                   # Drizzle schema + migrations + queries compartilhadas
│   ├── trpc/                 # Definição dos routers e procedures (consumido por web e api)
│   ├── validators/           # Schemas Zod reutilizados em toda a stack
│   ├── ui/                   # Componentes React compartilhados (Design System)
│   ├── mobile-ui/            # Componentes React Native (tokens compartilhados com ui/)
│   └── config/               # Configurações ESLint, TypeScript, Tailwind base
│
├── turbo.json
└── package.json              # pnpm workspaces
```

### 3.1 Fluxo de Tipagem E2E

```
packages/validators/ (Zod schemas)
    ↓ infer<>
packages/trpc/ (procedures tipadas com input/output Zod)
    ↓ inferRouterOutputs<>
apps/web/ e apps/mobile/  (consumo via @trpc/react-query)
    ↓
packages/db/ (Drizzle $inferSelect / $inferInsert)
```

Nenhum `any`, nenhum cast manual. Um único ponto de mutação de tipo.

---

## 4. Modelagem do Banco de Dados

### 4.1 Entidades Núcleo

#### `tenants` — Multi-tenant raiz
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid PK` | |
| `slug` | `text UNIQUE` | Ex: `cooperativa-vale-verde` |
| `name` | `text` | Razão social |
| `plan` | `enum(free, pro, enterprise)` | |
| `geo_region` | `geometry(POINT, 4326)` | PostGIS: sede geográfica |
| `created_at` | `timestamptz` | |

#### `users`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid PK` | |
| `tenant_id` | `uuid FK` | |
| `role` | `enum(producer, distributor, buyer, admin)` | |
| `email` | `text UNIQUE` | |
| `name` | `text` | |

#### `farms` — Propriedades dos produtores
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid PK` | |
| `tenant_id` | `uuid FK` | |
| `name` | `text` | |
| `location` | `geometry(POINT, 4326)` | **PostGIS** — coords GPS da propriedade |
| `address` | `jsonb` | Endereço estruturado |
| `certifications` | `text[]` | ex: `["organico_mapa","GlobalGAP"]` |

#### `product_categories` — Taxonomia fixa do Hortifruti
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid PK` | |
| `slug` | `text UNIQUE` | `tomate-italiano`, `alface-hidroponica` |
| `name` | `text` | Nome canônico para SEO |
| `parent_id` | `uuid FK self` | Hierarquia: Verduras > Alface |
| `seo_description` | `text` | Texto base para SEO Programático |

#### `products` — Catálogo do produtor
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid PK` | |
| `tenant_id` | `uuid FK` | |
| `farm_id` | `uuid FK` | |
| `category_id` | `uuid FK` | |
| `sku` | `text` | Código interno do produtor |
| `name` | `text` | Nome do produto (ex: "Tomate Débora Orgânico") |
| `sale_unit` | `enum(kg, g, unit, box, dozen, bunch)` | **Venda por peso vs. unidade** |
| `unit_weight_g` | `integer NULL` | Peso médio por unidade em gramas (para conversão) |
| `price_per_unit` | `numeric(12,4)` | Preço na `sale_unit` definida |
| `min_order_qty` | `numeric(10,3)` | Qtd mínima de pedido (permite frações para kg) |
| `origin_location` | `geometry(POINT, 4326)` | PostGIS — origem geográfica do produto |
| `images` | `text[]` | URLs em R2 |
| `is_active` | `boolean` | |

> **Decisão de Design:** A coluna `sale_unit` + `unit_weight_g` permite que um produto seja vendido "por kg" mas também que o sistema calcule quantas unidades físicas compõem um pedido — essencial para picking e logística.

#### `product_lots` — ⚡ Entidade crítica: Lotes com Decaimento de Validade
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid PK` | |
| `product_id` | `uuid FK` | |
| `lot_code` | `text` | Código de rastreabilidade do lote |
| `harvest_date` | `date` | Data de colheita |
| `expiry_date` | `date` | **Data de validade** — motor de decaimento |
| `available_qty` | `numeric(12,3)` | Quantidade disponível (em `sale_unit` do produto) |
| `reserved_qty` | `numeric(12,3)` | Reservado por pedidos em andamento |
| `price_override` | `numeric(12,4) NULL` | Permite precificação dinâmica por lote (ex: desconto próximo ao vencimento) |
| `freshness_score` | `integer` | 0–100, calculado por job agendado (BullMQ) |
| `storage_location` | `text` | Ex: "Câmara Fria B3" |
| `created_at` | `timestamptz` | |

**Estratégia de Decaimento de Validade:**
- Job BullMQ (`lot-freshness-worker`) roda a cada 6h
- Calcula `freshness_score = (expiry_date - now) / (expiry_date - harvest_date) * 100`
- Score < 30: publica evento `lot.expiring_soon` → notificação automática ao produtor e comprador
- Score = 0 (ou `expiry_date < now`): lote automaticamente marcado como `is_expired = true`, removido do catálogo ativo

#### `orders` e `order_items`
| Coluna (`orders`) | Tipo | Descrição |
|---|---|---|
| `id` | `uuid PK` | |
| `buyer_tenant_id` | `uuid FK` | |
| `seller_tenant_id` | `uuid FK` | |
| `status` | `enum(draft, confirmed, picking, in_transit, delivered, cancelled)` | |
| `delivery_address` | `jsonb` | |
| `delivery_point` | `geometry(POINT, 4326)` | PostGIS — ponto de entrega |
| `delivery_window_start` | `timestamptz` | |
| `delivery_window_end` | `timestamptz` | |
| `total_amount` | `numeric(14,4)` | |

| Coluna (`order_items`) | Tipo | Descrição |
|---|---|---|
| `id` | `uuid PK` | |
| `order_id` | `uuid FK` | |
| `lot_id` | `uuid FK` | **Vinculado ao lote específico** (rastreabilidade) |
| `product_id` | `uuid FK` | |
| `qty` | `numeric(12,3)` | Quantidade (suporta frações para kg) |
| `unit_price` | `numeric(12,4)` | Preço no momento da reserva |

#### `delivery_routes` — Roteamento PostGIS
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid PK` | |
| `date` | `date` | |
| `vehicle_id` | `uuid FK` | |
| `stops` | `geometry(LINESTRING, 4326)` | Rota otimizada |
| `order_ids` | `uuid[]` | Pedidos na rota |
| `estimated_duration_min` | `integer` | |

> **PostGIS em uso:** Queries como `ST_DWithin(farms.location, buyer.location, 50000)` para "fornecedores num raio de 50km" são nativas e indexadas com GiST.

### 4.2 Índices Estratégicos

```sql
-- Busca geoespacial (raio de entrega)
CREATE INDEX idx_farms_location ON farms USING GIST(location);
CREATE INDEX idx_products_origin ON products USING GIST(origin_location);
CREATE INDEX idx_orders_delivery ON orders USING GIST(delivery_point);

-- Validade — consultas frequentes de lotes próximos ao vencimento
CREATE INDEX idx_lots_expiry ON product_lots(expiry_date ASC) WHERE is_expired = false;

-- Tenant isolation (todas as queries filtram por tenant)
CREATE INDEX idx_products_tenant ON products(tenant_id, is_active);
CREATE INDEX idx_lots_product ON product_lots(product_id, available_qty) WHERE available_qty > 0;

-- SEO: slug único por categoria
CREATE UNIQUE INDEX idx_categories_slug ON product_categories(slug);
```

---

## 5. Arquitetura tRPC — Routers Principais

```
AppRouter
├── auth.*          — login, logout, sessão, refresh
├── tenant.*        — onboarding, configurações, plano SaaS
├── catalog.*       — listagem de produtos, filtragem por geo, busca
│   ├── catalog.list         (público, sem auth — usado pelo SEO SSR)
│   ├── catalog.byCategory   (público)
│   └── catalog.lot.reserve  (autenticado — reserva de lote)
├── producer.*      — CRUD de produtos, lotes, fazendas
├── order.*         — criação, status, timeline, picking list
├── logistics.*     — rotas, veículos, tracking
└── admin.*         — gestão de tenants, analytics agregadas ✅ (CONCLUÍDO)
```

**Convenção de procedures:**
- `query` = leitura (GET semântico, cacheável por React Query)
- `mutation` = escrita
- Toda `mutation` que modifica estoque valida disponibilidade dentro de uma **transação de banco de dados** (via Drizzle `db.transaction()`)

---

## 6. Arquitetura Mobile — Offline-First (Expo)

### 6.1 Princípio Fundamental

Produtores no campo operam em áreas com cobertura de sinal fraca ou nula. O app DEVE funcionar completamente offline para as operações de:

- Cadastro de novos lotes (colheita)
- Atualização de estoque
- Consulta de pedidos pendentes
- Registro de picking (separação de pedidos)

### 6.2 Stack de Sincronização

| Componente | Tecnologia |
|---|---|
| Banco local | **Expo SQLite** (expo-sqlite v14+) com WAL mode |
| Schema local | Drizzle ORM com driver `expo-sqlite` (mesmo schema, subset de tabelas) |
| Fila de sincronização | `expo-background-fetch` + `expo-task-manager` |
| Detector de conectividade | `@react-native-community/netinfo` |
| Resolução de conflitos | **Last-Write-Wins** por `updated_at` para a fase MVP |

### 6.3 Fluxo de Sincronização

```
[OFFLINE]
  Produtor registra colheita → salva em SQLite local com status: "pending_sync"
  Produtor atualiza estoque → idem
  
[CONEXÃO DETECTADA]
  netinfo.addEventListener → dispara SyncEngine
  
[SyncEngine — executado em background worker]
  1. Lê todos os registros com status: "pending_sync"
  2. Agrupa em batch (máx 50 por request)
  3. Envia via tRPC mutation: producer.syncOfflineQueue
  4. Server processa, detecta conflitos, retorna resultado
  5. App atualiza registros locais com `server_id` e status: "synced"
  6. App baixa delta de dados do server (pedidos novos, preços atualizados)
```

### 6.4 Tabelas SQLite Local (subset offline)

- `local_lots` — Lotes criados offline (espelha `product_lots`)
- `local_products` — Catálogo de produtos do produtor (read-only, baixado do server)
- `local_orders` — Pedidos para picking (read-only, baixado do server)
- `sync_queue` — Fila de operações pendentes com contagem de retry

### 6.5 UX Offline

- Header do app exibe badge **"Modo Offline"** em laranja quando sem conexão
- Operações pendentes exibem ícone de "relógio de sincronização"
- Tela dedicada **"Fila de Sincronização"** mostra itens aguardando e histórico

---

## 7. SEO Programático — Catálogo Público

### 7.1 Estratégia ✅ (CONCLUÍDO)

O catálogo público do Frescari (`frescari.com.br/catalogo/...`) é um ativo de SEO crítico. A estratégia usa Next.js 15 App Router com **Incremental Static Regeneration (ISR)** para gerar milhares de páginas indexáveis.

### 7.2 Árvore de URLs

```
/catalogo/                          → Página raiz do catálogo (ISR, revalidate: 3600)
/catalogo/[categoria]/              → Listagem por categoria (ISR)
  ex: /catalogo/tomates/
/catalogo/[categoria]/[sub]/        → Sub-categoria
  ex: /catalogo/tomates/tomate-italiano/
/catalogo/[categoria]/[produto]/    → Página de produto individual (ISR)
  ex: /catalogo/tomates/tomate-debora-organico/
/catalogo/fornecedores/[regiao]/    → Produtores por região geográfica (ISR)
  ex: /catalogo/fornecedores/sao-paulo/campinas/
/catalogo/produto/[sku-slug]/       → Página de produto por SKU (ISR)
```

### 7.3 Geração de Conteúdo SEO por Página

Cada página de produto gerada programaticamente incluirá:

| Elemento | Geração |
|---|---|
| `<title>` | `{produto.name} a granel em {cidade} - Frescari` |
| `<meta description>` | Template: "Compre {produto} direto do produtor em {região}. Disponível em lotes de {min_order} {unit}. Entrega em {raio}km." |
| `<h1>` | `{produto.name} — {categoria.name}` |
| Dados estruturados | `schema.org/Product` com `offers`, `availability`, `areaServed` |
| Conteúdo editorial | `category.seo_description` + dados dinâmicos de disponibilidade |
| `hreflang` | Não aplicável (somente pt-BR) |
| `canonical` | URL canônica auto-gerada |

### 7.4 `generateStaticParams` — Estratégia de Build

```
Build inicial: gera todas as páginas de categoria (finito, ~200 páginas)
On-demand ISR: páginas de produto individuais geradas na 1ª visita, depois cacheadas
Revalidação: triggered por webhook quando produtor atualiza produto/lote
```

### 7.5 Sitemap Dinâmico

- `GET /sitemap.xml` — gerado dinamicamente via Next.js Route Handler
- Inclui todas as categorias + produtos ativos + fornecedores
- Dividido em `sitemap-0.xml`, `sitemap-1.xml`... (índice de sitemaps) quando > 50k URLs
- Atualizado via cron job diário ou invalidação por evento

### 7.6 Dados Estruturados Schema.org

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Tomate Débora Orgânico",
  "category": "Tomates",
  "offers": {
    "@type": "Offer",
    "priceCurrency": "BRL",
    "price": "8.50",
    "unitCode": "KGM",
    "availability": "https://schema.org/InStock",
    "areaServed": {
      "@type": "GeoCircle",
      "geoMidpoint": { "@type": "GeoCoordinates", "latitude": -22.9, "longitude": -47.1 },
      "geoRadius": "50000"
    }
  },
  "producer": { "@type": "Organization", "name": "Fazenda Sol Nascente" }
}
```

---

## 8. Segurança e Multi-Tenancy

- **Isolamento:** Toda query ao DB inclui `WHERE tenant_id = $currentTenantId` (enforced no tRPC middleware `tenantMiddleware`)
- **Autenticação:** Sessões armazenadas em PostgreSQL (tabela `sessions`), sem JWT persistido — evita revogação complexa
- **Autorização:** RBAC implementado em middleware tRPC por `role` do usuário logado
- **Rate Limiting:** `@upstash/ratelimit` com Redis para endpoints públicos do catálogo
- **RLS (Row Level Security):** Ja implementado no banco e obrigatorio para manter isolamento multi-tenant

---

## 9. Escopo Real do MVP

### Regra de produto

MVP nao e "tudo que queremos construir". MVP e o menor pacote que permite vender, operar e aprender com seguranca razoavel no fluxo web principal.

Se colocarmos mobile, offline, push, busca geografica avancada, hardening completo e toda a migracao futura dentro do mesmo marco, deixamos de ter MVP e viramos um v1 grande demais.

Status detalhado e checklist operacional: ver `docs/MVP_CLOSURE_PLAN.md`.

### 9.1 MVP de venda (release gate)

Itens que devem existir para o Frescari validar operacao comercial no web:

- [x] Monorepo, schema core, auth e base tRPC
- [x] Catalogo publico com base de SEO
- [x] Dashboard producer para operar fazenda, produtos e lotes no fluxo web atual
- [x] Dashboard admin para Master Products e Categorias
- [x] Livro de enderecos do comprador em `/dashboard/perfil`
- [x] Calculo de frete por fazenda usando geoespacial no backend
- [x] Stripe Connect, Stripe Checkout, webhook e captura por peso
- [x] Checkout seguro por fazenda: o fluxo web principal ja usa `checkout.createFarmCheckoutSession`, recalculo server-side e remocao por grupo no carrinho
- [x] Pipeline de pedido de ponta a ponta: o webhook novo reconstrui por `address_snapshot`, e o caminho legado `createCheckoutSession` foi isolado para nao aceitar mais endereco bruto nem geocoding no fluxo publico
- [x] IA operacional de entregas e rotas no dashboard web: a mesa operacional ja combina score heuristico, risco, confianca, sugestao de veiculo, override manual e persistencia de wave no backend; `Proxima acao agora`, refresh com lock de override, mapa contextual da wave e sinais externos resilientes com fallback silencioso estao entregues no web e no API
- [x] Sistema de notificacoes do MVP web: eventos criticos de pedido, entrega e lote agora geram notificacao operacional no painel para os atores corretos, com inbox, badge, filtros e leitura otimista no web

#### Direcao tecnica da IA de rotas para o MVP

No MVP, a IA de entregas/rotas nao precisa nascer como um modelo caro ou proprietario. O desenho preferencial e:

- clusterizacao geografica dos pedidos pendentes
- score operacional por prioridade, distancia, perecibilidade e janela de entrega
- sugestao de sequenciamento/roteiro para o operador
- explicacao clara no dashboard sobre o motivo da recomendacao

Isso pode ser implementado inicialmente com stack free/open source e heuristicas deterministicas, desde que a recomendacao seja util na operacao real.

Especificacao funcional consolidada para esta frente: `docs/architecture/DELIVERIES_AI_CONTROL_TOWER_SPEC.md`.

#### Escopo minimo de notificacoes no MVP

Como o primeiro marco continua web-first, o sistema de notificacoes do MVP deve priorizar:

- inbox/centro de notificacoes no painel
- badges e estados de atencao nas rotas criticas
- envio assinado por evento para pedido confirmado, pedido em rota, pedido entregue e lote critico

Push mobile continua fora do primeiro marco se depender de app nativo, mas notificacao operacional no web ja esta entregue no MVP.

#### Quando o 9.1 e considerado concluido

O item 9.1 so fecha quando os pontos abaixo estiverem validados em conjunto:

- checkout por fazenda novo funcionando no web sem depender do contrato legado
- pipeline de pedido publico sem confiar em endereco bruto ou taxa de entrega vindos do frontend
- dashboard de entregas com analise assistida por IA util para operacao real
- notificacoes operacionais funcionando para eventos criticos do fluxo
- rotas criticas do web revisadas manualmente com checklist funcional, visual e responsivo

### 9.2 Go-live hardening

Itens obrigatorios antes do lancamento publico do MVP. Eles nao mudam o escopo central do produto, mas bloqueiam o go-live enquanto nao estiverem fechados:

- [x] E2E web com Playwright
- [x] Finalizar o contrato novo de checkout por fazenda e desativar o fluxo misto legado
- [ ] Adicionar `noUncheckedIndexedAccess` ao TypeScript
- [ ] Configurar Husky + lint-staged
- [ ] Configurar Knip para dead code e dependencias nao usadas
- [ ] Rodar auditoria completa de teclado e formularios nas rotas de dashboard
- [ ] Executar varredura completa do web core rota por rota
- [ ] Rodar verificacao final do MVP web (`test`, `typecheck`, `lint`, `build`, E2E core e checklist basico de seguranca)
- [ ] Rodar pentest basico e checklist final de seguranca operacional

#### Regra de lancamento

O MVP so pode ser considerado pronto para publicacao quando:

- todos os itens do 9.1 estiverem concluidos
- todos os itens do 9.2 estiverem concluidos
- o web core tiver passado por verificacao manual profunda e pela suite automatizada

### 9.3 Pos-MVP

Itens valiosos, mas que devem entrar depois que o nucleo web estiver fechado:

- [ ] App Expo para produtores
- [ ] Expo SQLite + schema local
- [ ] Motor de sincronizacao offline
- [ ] Detox / E2E mobile
- [ ] Busca geografica de descoberta com `ST_DWithin`
- [ ] Push mobile nativo

### 9.4 Correcoes de status do plano antigo

O plano anterior ficou desatualizado em alguns pontos. Estado correto do repositorio hoje:

- [x] `lot-freshness-worker` ja existe
- [x] E2E web ja existe
- [x] Address book do comprador ja existe
- [x] Calculo de frete geografico por endereco e fazenda ja existe
- [x] Carrinho ja agrupa visualmente por fazenda

### ⚡ Extras Ja Entregues

- [x] Master Products com `pricingType`
- [x] Upload de imagens (UploadThing)
- [x] Onboarding completo por tipo de tenant
- [x] Dashboard diferenciado Buyer vs Producer
- [x] Pagina de sucesso pos-compra
- [x] Design system compartilhado
- [x] Validators package com Zod compartilhado

---

## 10. Decisões de Arquitetura (ADRs Resumidos)

| Decisão | Escolha | Alternativa Rejeitada | Motivo |
|---|---|---|---|
| ORM | Drizzle | Prisma | Drizzle tem melhor suporte a tipos para PostGIS e queries manuais; zero overhead de runtime |
| API | tRPC | REST + OpenAPI | Type-safety E2E elimina uma camada de geração de código e possíveis desacordos de tipagem |
| Sync offline | SQLite local + queue | Apenas retry de rede | SQLite garante operação real sem dependência de rede; queue é auditável |
| Conflitos de sync | LWW (Last Write Wins) | CRDT / Operational Transform | Suficiente para MVP; operações de estoque são raras de conflitar no campo |
| Geo | PostGIS | Serviço externo (Google Maps API) | PostGIS nativo elimina latência de rede e custo por query; queries complexas (raio + filtros) |
| Perecibilidade | `product_lots` separado | Campo direto em `products` | Um produto pode ter múltiplos lotes simultâneos com validades diferentes — modelo é obrigatório |

---

> **Proximo Passo:** Fechar hardening de go-live e verificacao profunda das rotas criticas. Mobile, offline e push nativo continuam fora do primeiro marco.
