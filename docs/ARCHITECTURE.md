# Frescari — Arquitetura do Sistema

> Documento central de arquitetura. Consolida as decisões de produto, engenharia e operação da plataforma.
> Última atualização: 2026-04-09

---

## 1. Visão Geral

**Frescari** é um marketplace B2B/B2C de hortifruti operado como **"invisible SaaS"**: não operamos galpões nem estoques. Somos a infraestrutura digital que conecta produtores rurais a compradores e monetizamos via taxa de intermediação sobre cada transação.

### Princípios fundamentais

| Princípio | Descrição |
|-----------|-----------|
| **Backend como dono da verdade** | Preço, frete e total são sempre calculados no servidor. O frontend nunca é confiado para valores financeiros. |
| **Multi-tenancy estrutural** | Isolamento de dados via PostgreSQL RLS — não apenas na aplicação. |
| **Idempotência financeira** | Toda operação sensível ao Stripe usa chaves de idempotência. |
| **Menor privilégio** | O runtime da aplicação nunca usa credenciais com `BYPASSRLS`. |
| **Qualidade como gate** | Nenhum código chega à produção sem passar por `pnpm check` (lint + typecheck + test + knip). |
| **Soft delete** | Preferir marcação de inativo a hard delete em pedidos, lotes e pagamentos. |

---

## 2. Diagrama de Contexto (C4 — Nível 1)

```mermaid
C4Context
    title Frescari — Contexto do Sistema

    Person(buyer, "Comprador", "Empresa ou pessoa que compra produtos do marketplace")
    Person(producer, "Produtor", "Agricultor que publica lotes e gerencia pedidos")
    Person(admin, "Administrador", "Mantém o catálogo mestre e opera o marketplace")

    System(frescari, "Frescari", "Marketplace web de hortifruti. Catálogo, checkout por fazenda, gestão de lotes, despacho e notificações.")

    System_Ext(stripe, "Stripe", "Processamento de pagamentos e repasses via Stripe Connect")
    System_Ext(neon, "Neon PostgreSQL", "Banco de dados gerenciado com suporte a PostGIS e RLS")
    System_Ext(uploadthing, "UploadThing", "Armazenamento e CDN de imagens de lotes")
    System_Ext(resend, "Resend", "Envio de e-mails transacionais e de autenticacao")
    System_Ext(nominatim, "Nominatim / OSM", "Geocodificação de endereços")

    Rel(buyer, frescari, "Navega catálogo, faz pedidos, acompanha entregas")
    Rel(producer, frescari, "Publica lotes, gerencia pedidos e entregas")
    Rel(admin, frescari, "Gerencia catálogo mestre e operações")
    Rel(frescari, stripe, "Cria sessões de checkout, captura pagamentos, repassa ao produtor")
    Rel(frescari, neon, "Persiste e consulta todos os dados")
    Rel(frescari, uploadthing, "Upload e serve imagens de lotes")
    Rel(frescari, resend, "Envia e-mails de verificacao, reset de senha e transacionais")
    Rel(frescari, nominatim, "Geocodifica endereços de fazendas e compradores")
```

---

## 3. Diagrama de Containers (C4 — Nível 2)

```mermaid
C4Container
    title Frescari — Containers

    Person(user, "Usuário", "Comprador, Produtor ou Admin")

    Container(web, "apps/web", "Next.js 16 + React 19", "App único deployável. Serve catálogo público, dashboards, route handlers, webhooks e cron jobs.")
    Container(api_pkg, "packages/api", "TypeScript + tRPC v11", "Routers tRPC, serviços de negócio, workers, integrações Stripe e geocoding.")
    Container(db_pkg, "packages/db", "Drizzle ORM + PostgreSQL", "Schema, migrações, scripts RLS, bootstrap de produção.")
    Container(ui_pkg, "packages/ui", "React + Tailwind CSS v4", "Design system compartilhado: componentes, formatadores.")
    Container(validators_pkg, "packages/validators", "Zod", "Schemas de validação e contratos compartilhados.")

    System_Ext(neon, "Neon PostgreSQL", "Banco de dados com PostGIS e RLS")
    System_Ext(stripe, "Stripe Connect", "Pagamentos e repasses")
    System_Ext(vercel, "Vercel", "Hospedagem do app web + cron jobs")
    System_Ext(gh_actions, "GitHub Actions", "CI/CD: qualidade + deploy de schema/RLS")
    System_Ext(redis, "Redis", "Fila para workers CLI (BullMQ)")

    Rel(user, web, "HTTPS")
    Rel(web, api_pkg, "Import direto (monorepo)")
    Rel(web, db_pkg, "Import direto (monorepo)")
    Rel(web, ui_pkg, "Import direto (monorepo)")
    Rel(web, validators_pkg, "Import direto (monorepo)")
    Rel(api_pkg, db_pkg, "Queries via Drizzle ORM")
    Rel(api_pkg, validators_pkg, "Validação de inputs")
    Rel(db_pkg, neon, "TCP/TLS (Neon serverless driver)")
    Rel(api_pkg, stripe, "Stripe SDK (pagamentos, Connect)")
    Rel(web, vercel, "Deploy automático via git push")
    Rel(gh_actions, neon, "Migrações + RLS (DATABASE_ADMIN_URL)")
    Rel(api_pkg, redis, "BullMQ (workers CLI apenas)")
```

---

## 4. Multi-tenancy e Isolamento via RLS

### Modelo de tenants

| Papel | `role` | `tenantType` | Descrição |
|-------|--------|-------------|-----------|
| Comprador | `buyer` | `BUYER` | Empresa ou pessoa que compra |
| Produtor | `producer` | `PRODUCER` | Agricultor que publica lotes |
| Administrador | `admin` | — | Gerencia o marketplace |

### Como o isolamento funciona

1. **Na autenticação** — `Better Auth` associa `tenantId` e `role` ao usuário na sessão.
2. **No tRPC** — Cada tipo de procedure extrai `tenantId` do contexto e o injeta em todas as queries:
   - `publicProcedure` — sem auth
   - `protectedProcedure` — requer sessão válida
   - `tenantProcedure` — requer `tenantId`
   - `producerProcedure` / `buyerProcedure` — verifica role + tenantType
   - `adminProcedure` — somente admins
3. **No banco** — PostgreSQL RLS verifica `app.current_tenant` em toda query antes de retornar dados. O runtime usa uma role sem `BYPASSRLS`.

```mermaid
sequenceDiagram
    participant Client
    participant tRPC
    participant RLS
    participant DB

    Client->>tRPC: request (cookie de sessão)
    tRPC->>tRPC: Extrai user + tenantId da sessão
    tRPC->>DB: SET LOCAL app.current_tenant = tenantId
    tRPC->>DB: SELECT * FROM orders WHERE ...
    DB->>RLS: Verifica app.current_tenant em cada linha
    RLS->>DB: Filtra somente linhas do tenant
    DB->>tRPC: Resultado isolado
    tRPC->>Client: Response
```

---

## 5. Contrato de API (tRPC)

### Estrutura de routers

| Router | Escopo | Principais operações |
|--------|--------|---------------------|
| `productRouter` | Público | Listagem e detalhes do catálogo |
| `lotRouter` | Produtor | CRUD de lotes, métricas de inventário |
| `checkoutRouter` | Comprador | Criação de sessão Stripe por fazenda |
| `orderRouter` | Comprador/Produtor | Pedidos, status, captura pós-pesagem |
| `farmRouter` | Produtor | Perfil, localização, frota, configurações |
| `stripeRouter` | Produtor | Onboarding Stripe Connect, status da conta |
| `addressesRouter` | Comprador | CRUD de endereços de entrega |
| `logisticsRouter` | Produtor/Admin | Despacho, ondas, overrides, torre de controle |
| `notificationRouter` | Autenticado | Inbox, leitura, badges |
| `adminRouter` | Admin | Catálogo mestre, usuários, operações |
| `onboardingRouter` | Autenticado | Fluxo de criação de tenant |

### Validação

- Todos os inputs são validados com **Zod** e o flag `.strict()` para rejeitar campos desconhecidos.
- Schemas compartilhados vivem em `packages/validators`.
- Identificadores são tipados como `.uuid()` para prevenir IDOR.

---

## 6. Modelo de Dados (ERD)

```mermaid
erDiagram
    tenants {
        uuid id PK
        text name
        tenantType type
        text stripAccountId
        producerLegalEntityType legalEntityType
    }
    users {
        text id PK
        text email
        role role
        uuid tenantId FK
    }
    userLegalAcceptances {
        uuid id PK
        text userId FK
        text legalVersion
        timestamptz acceptedAt
        text ipAddress
        text source
    }
    farms {
        uuid id PK
        uuid tenantId FK
        text name
        jsonb address
        geometry location
        numeric baseDeliveryFee
        numeric pricePerKm
        numeric maxDeliveryRadiusKm
    }
    farmVehicles {
        uuid id PK
        uuid farmId FK
        fleetVehicleType vehicleType
        fleetVehicleStatus status
        boolean hasRefrigeration
    }
    productCategories {
        uuid id PK
        text name
        text slug
    }
    masterProducts {
        uuid id PK
        uuid categoryId FK
        text name
        text slug
        pricingType pricingType
    }
    products {
        uuid id PK
        uuid masterProductId FK
        uuid tenantId FK
    }
    productLots {
        uuid id PK
        uuid productId FK
        uuid tenantId FK
        text lotCode
        numeric pricePerUnit
        saleUnit unit
        numeric availableQty
        date harvestDate
        date expiryDate
        text photoUrl
    }
    addresses {
        uuid id PK
        uuid tenantId FK
        text title
        text zipcode
        text street
        text city
        text state
        geometry location
        boolean isDefault
    }
    orders {
        uuid id PK
        uuid buyerTenantId FK
        uuid sellerTenantId FK
        uuid deliveryAddressId FK
        orderStatus status
        text stripeCheckoutSessionId
        text stripePaymentIntentId
        numeric totalAmountBrl
        numeric platformFeeBrl
    }
    orderItems {
        uuid id PK
        uuid orderId FK
        uuid lotId FK
        numeric quantity
        numeric unitPrice
        saleUnit unit
    }
    notifications {
        uuid id PK
        uuid tenantId FK
        notificationType type
        notificationScope scope
        notificationSeverity severity
        boolean read
    }
    deliveryDispatchWaves {
        uuid id PK
        uuid farmId FK
        date waveDate
        dispatchWaveStatus status
        jsonb aiRecommendation
    }
    deliveryDispatchWaveOrders {
        uuid id PK
        uuid waveId FK
        uuid orderId FK
        int position
    }
    deliveryDispatchOverrides {
        uuid id PK
        uuid orderId FK
        dispatchOverrideAction action
        dispatchOverrideReason reason
    }

    tenants ||--o{ users : "tem"
    tenants ||--o{ farms : "opera"
    tenants ||--o{ productLots : "publica"
    tenants ||--o{ orders : "compra/vende"
    tenants ||--o{ addresses : "tem"
    users ||--o{ userLegalAcceptances : "aceita"
    farms ||--o{ farmVehicles : "possui"
    farms ||--o{ deliveryDispatchWaves : "tem"
    productCategories ||--o{ masterProducts : "contém"
    masterProducts ||--o{ products : "origina"
    products ||--o{ productLots : "tem"
    orders ||--o{ orderItems : "contém"
    orderItems }o--|| productLots : "referencia"
    orders }o--|| addresses : "entrega em"
    deliveryDispatchWaves ||--o{ deliveryDispatchWaveOrders : "inclui"
    deliveryDispatchWaveOrders }o--|| orders : "referencia"
    orders ||--o{ deliveryDispatchOverrides : "tem"
```

---

## 7. Autenticação e Autorização

### Stack de auth

- **Better Auth v1.6.1** com adapter Drizzle
- Sessões em cookies `HttpOnly; Secure; SameSite=Lax`
- Verificação de e-mail obrigatória antes de acesso completo
- Reset de senha por e-mail com token de 1 hora e revogação de sessões após redefinição
- Aceitação legal versionada (`userLegalAcceptances`) capturada no cadastro

### Fluxo de login/cadastro

```mermaid
sequenceDiagram
    participant User
    participant Web
    participant BetterAuth
    participant DB

    User->>Web: POST /api/auth/sign-up/email
    Web->>Web: Rate limit (10 req/min por IP)
    Web->>BetterAuth: Registra usuário
    BetterAuth->>DB: Insere user + session
    BetterAuth->>DB: Insere userLegalAcceptances
    BetterAuth-->>Web: Session token (cookie)
    Web-->>User: 200 OK (token removido da resposta JSON)
    Web->>User: E-mail de verificação (via Resend)
```

### Proteções implementadas

- Token de sessão não retorna no JSON (apenas no cookie)
- Erros de "usuário já existe" são mascarados com mensagem genérica (anti-enumeração)
- Rate limiting: 10 tentativas por minuto por IP em `/sign-in/email`, `/sign-up/email`, `/request-password-reset` e no legado `/forget-password`

---

## 8. Fluxo de Pagamento (Stripe Connect)

### Modelo: Destination Charges

O comprador paga à plataforma. A plataforma retém a comissão (10%) e repassa o restante à conta conectada do produtor.

```mermaid
sequenceDiagram
    participant Buyer
    participant Web
    participant API
    participant Stripe
    participant Producer

    Buyer->>Web: Finaliza carrinho por fazenda
    Web->>API: checkout.createFarmCheckoutSession(farmId, addressId, items)
    API->>API: Recalcula preços, frete e total (server-side)
    API->>Stripe: checkout.sessions.create (Destination Charge)
    Stripe-->>API: session.url
    API-->>Web: session.url
    Web->>Stripe: Redireciona comprador
    Buyer->>Stripe: Confirma pagamento
    Stripe->>Web: Webhook checkout.session.completed
    Web->>API: Verifica assinatura → processa pedido
    API->>DB: Cria order + orderItems + atualiza availableQty
    Stripe->>Producer: Repasse automático (menos 10%)
```

### Lifecycle de um pedido por peso

Para itens vendidos por peso (`kg`, `g`):
1. **Autorização** — captura o valor estimado (pré-pesagem)
2. **`order.status = awaiting_weight`** — produtor pesa o item
3. **Captura manual** — produtor informa peso real → backend calcula valor final e captura
4. **`order.status = confirmed`** — pedido segue para despacho

---

## 9. Logística e Frete

### Cálculo de frete

O frete é calculado server-side usando distância geoespacial entre o endereço do comprador e a fazenda:

```
frete = base_delivery_fee + (distância_km × price_per_km)
```

Restrições:
- Fazenda define `maxDeliveryRadiusKm`. Pedidos fora do raio são bloqueados.
- `ST_DistanceSphere(farm.location, address.location)` via PostGIS.

### Torre de controle de entregas

O módulo de logística (`logisticsRouter`) implementa:
- **Scoring de despacho** — prioridade por janela de entrega, risco e carga do veículo
- **Ondas de entrega** (`deliveryDispatchWaves`) — agrupamento de pedidos por dia/fazenda
- **Overrides manuais** — operador pode reordenar, atrasar ou fixar pedidos no topo
- **Sugestão por IA** — heurísticas automáticas de ordem e risco persistidas como `aiRecommendation` (JSON)

Para detalhes completos: [`docs/guides/deliveries-control-tower.md`](guides/deliveries-control-tower.md)

---

## 10. Deployment e DevOps

### Ambientes

| Ambiente | App | Schema/RLS | Trigger |
|----------|-----|-----------|---------|
| Preview | Vercel (por PR) | Staging Neon | Automático em PR |
| Staging | Vercel (`main`) | Staging Neon | Automático em push |
| Production | Vercel (`main`) | Production Neon | Manual (`deploy-production.yml`) |

### Workflows GitHub Actions

| Workflow | Trigger | O que faz |
|----------|---------|-----------|
| `ci.yml` | PRs + push | lint + typecheck + test + knip |
| `deploy-staging.yml` | Push em `main` ou mudança em `packages/db/` | Aplica migrações + RLS em staging |
| `deploy-production.yml` | Manual | Aplica migrações + RLS em produção |

### Cron jobs (Vercel)

Configurados em `vercel.json`:

| Rota | Horários UTC | Função |
|------|-------------|--------|
| `/api/cron/freshness` | 00h, 06h, 12h, 18h | Atualiza status de lotes expirados/vencendo |
| `/api/cron/notifications` | 01h, 07h, 13h, 19h | Processa fila de notificações |

### Branches Neon

- `main` — desenvolvimento e preview
- `staging` — branch de staging (auto-deploy)
- `production-v1-clean` — branch de produção (deploy manual apenas)

---

## 11. Workers e Jobs

Os workers CLIs usam **BullMQ + Redis** e rodam fora da Vercel (localmente ou em infra separada):

| Worker | Arquivo | Função |
|--------|---------|--------|
| `lot-freshness-cli` | `packages/api/src/workers/lot-freshness-cli.ts` | Versão CLI do job de frescor de lotes |
| `notification-worker-cli` | `packages/api/src/workers/notification-worker-cli.ts` | Processamento de fila de notificações |
| `stripe-connect-backfill-cli` | `packages/api/src/workers/stripe-connect-backfill-cli.ts` | Sincroniza dados de contas Stripe |
| `stripe-connect-legacy-audit-cli` | `packages/api/src/workers/stripe-connect-legacy-audit-cli.ts` | Audita contas Stripe legadas |

> Os cron jobs no Vercel (`/api/cron/*`) executam as mesmas tarefas inline, sem Redis, usando a implementação direta dos serviços.

---

## 12. Qualidade e Testes

### Quality gate (`pnpm check`)

```
pnpm lint        → ESLint 9 + TypeScript ESLint
pnpm typecheck   → tsc --noEmit (strict mode + noUncheckedIndexedAccess)
pnpm test        → tsx --test (Node.js built-in test runner)
pnpm knip        → Dead code detection
```

### Cobertura de testes (58 arquivos)

| Camada | Arquivos | Tipo |
|--------|---------|------|
| E2E Playwright | 3 | Buyer core, Producer/Logistics, Admin |
| packages/api | 24 | Routers, segurança, workers, flows |
| apps/web | 23 | Rotas API, componentes, utilitários |
| packages/db | 2 | Integração RLS real (não mockada) |
| packages/ui | 1 | Formatadores |
| packages/validators | 3 | Schemas Zod |

### Proteções de commit

- **Husky** — bloqueia commit com falha em typecheck/lint
- **lint-staged** — roda checks apenas em arquivos staged
- **Branch protection** — `main` requer `quality` check + aprovação admin

---

## 13. Modelo Operacional do Catálogo

```
Admin cria categoria → Admin cria produto-base (masterProduct)
                                        ↓
Produtor publica lote (productLot) vinculado ao masterProduct
                ↓ (define: preço, unidade, quantidade, foto, colheita, validade)
                        ↓
Catálogo público exibe lotes disponíveis
                ↓
Comprador adiciona ao carrinho → Checkout por fazenda → Pedido
```

Regras:
- Produtor **não cria** taxonomia paralela — vincula ao catálogo mestre
- `admin` é o único papel que cria `masterProduct` e `productCategory`
- O lote é a oferta comercial real: preço e unidade são definidos no lote, não no produto-base

---

## 14. Referências

| Documento | Localização | Conteúdo |
|-----------|------------|----------|
| ADRs | [`docs/adr/`](adr/README.md) | Decisões arquiteturais numeradas |
| Torre de controle | [`docs/guides/deliveries-control-tower.md`](guides/deliveries-control-tower.md) | Especificação do módulo de logística |
| Padrões UI/UX | [`docs/guides/ui-ux-standards.md`](guides/ui-ux-standards.md) | Design system e padrões visuais |
| SEO e crescimento | [`docs/guides/seo-and-growth-strategy.md`](guides/seo-and-growth-strategy.md) | Estratégia de SEO e loops de crescimento |
| Bootstrap de produção | [`docs/operations/launch-bootstrap-runbook.md`](operations/launch-bootstrap-runbook.md) | Promoção de admin e catálogo inicial |
| Deploy de RLS | [`docs/operations/rls-rollout-runbook.md`](operations/rls-rollout-runbook.md) | Procedimento de RLS |
| Go-live Stripe | [`docs/operations/stripe-go-live-runbook.md`](operations/stripe-go-live-runbook.md) | Ativação do Stripe Connect em produção |
| Backup e recovery | [`docs/operations/backup-restore-runbook.md`](operations/backup-restore-runbook.md) | Procedimentos de recuperação |
| Checklist de segurança | [`docs/operations/security-checklist.md`](operations/security-checklist.md) | Validação pré-lançamento |
