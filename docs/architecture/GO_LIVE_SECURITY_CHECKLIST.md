# Go-Live Security Checklist

> Checklist operacional definitiva do go-live web do Frescari.
> Atualizado em 2026-03-20.
> Status do codigo: SELADO.
> Status operacional do go-live: ABERTO.

## 0. Leitura correta do status

### O que "Status do codigo: SELADO" significa

- [x] O runtime principal usa `DATABASE_URL` restrita e nao depende de role com `BYPASSRLS`.
- [x] O runtime de auth/webhook foi alinhado para a mesma role restrita de runtime.
- [x] O estado final de RLS pode ser reaplicado via `pnpm --filter @frescari/db db:deploy`.
- [x] O workflow `.github/workflows/ci.yml` executa `lint`, `typecheck`, `test` e `knip`.
- [x] O workflow `.github/workflows/deploy-staging.yml` faz push de schema + reaplicacao de RLS em staging e falha de forma segura quando `DATABASE_ADMIN_URL` nao esta configurada.
- [x] O baseline local de qualidade foi restaurado em 2026-03-20 e `pnpm check` esta verde.
- [x] A malha E2E do core web cobre comprador, fazenda e entregas com `pnpm --filter web test:e2e` verde.
- [x] Os cron jobs operacionais do app web estao versionados em `vercel.json`.

### O que continua aberto antes de dizer GO

- [x] rodar o `build` final do release candidate
- [ ] concluir a configuracao das variaveis de ambiente e segredos na nuvem
- [ ] validar segredos e ambientes remotos
- [ ] executar a rodada ofensiva proporcional ao MVP
- [ ] registrar evidencia de backup, restore e recovery operacional

## 1. Objective

Transformar a rodada final de seguranca do MVP em uma verificacao executavel, auditavel e proporcional ao produto real que vai para producao.

## 2. Exit Rule

O go-live web so pode acontecer quando:

- nenhum bloqueador permanecer aberto em auth, autorizacao, isolamento multi-tenant, pagamentos, uploads, abuso de superficie publica, logs/auditoria e recovery
- cada frente abaixo tiver evidencia minima registrada
- a validacao ofensiva proporcional ao MVP tiver sido executada nas superficies criticas

## 3. Surface Inventory

### Public web and SEO

- `/`
- `/catalogo`
- `/catalogo/[categoria]`
- `/catalogo/[categoria]/[produto]`
- `/catalogo/fornecedores/[estado]/[cidade]`
- `/robots.txt`
- `/sitemap.xml`

### Auth and identity

- `/auth/login`
- `/auth/register`
- `/api/auth/[...all]`

### Buyer core flow

- `apps/web/src/components/CartDrawer.tsx`
- `/dashboard/perfil`
- `/sucesso`
- `packages/api/src/routers/addresses.ts`
- `packages/api/src/routers/checkout.ts`
- `packages/api/src/routers/order.ts`

### Producer, admin and logistics

- `/dashboard/fazenda`
- `/dashboard/inventario`
- `/dashboard/pedidos`
- `/dashboard/entregas`
- `/dashboard/vendas`
- `/dashboard/admin`
- `/admin`
- `/admin/catalogo`
- `/admin/usuarios`
- `packages/api/src/routers/farm.ts`
- `packages/api/src/routers/lot.ts`
- `packages/api/src/routers/logistics.ts`
- `packages/api/src/routers/admin.ts`
- `packages/api/src/routers/notification.ts`
- `packages/api/src/routers/onboarding.ts`

### Platform APIs and integrations

- `/api/trpc/[trpc]`
- `/api/uploadthing`
- `/api/webhooks/stripe`
- `/api/cron/freshness`
- `/api/cron/notifications`
- `packages/api/src/routers/product.ts`
- `packages/api/src/routers/stripe.ts`

## 4. Auth, session and cookies

- [ ] Confirmar expiracao de sessao, logout, revogacao e comportamento apos troca de tenant ou role.
- [ ] Confirmar que cookies de sessao usam `HttpOnly`, `Secure` em producao e `SameSite` intencional.
- [ ] Confirmar que login, register e callbacks nao permitem open redirect.
- [ ] Confirmar que erros de autenticacao nao enumeram conta, tenant ou estado interno.
- [ ] Confirmar rate limit e throttling nas entradas de auth e nos callbacks publicos.
- [ ] Confirmar que nenhuma rota protegida depende apenas de hide/show na UI.

Evidencia minima:

- captura de headers/cookies em preview ou staging
- walkthrough manual de login/logout
- nota curta sobre redirects e mensagens de erro

Evidencia parcial ja coletada em 2026-03-20:

- GET anonimo em `/auth/login` retornou `200` com `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` e `Referrer-Policy`.
- A validacao de cookies de sessao permanece pendente porque ainda falta walkthrough com login real.

## 5. Authorization, RBAC and tenant isolation

- [ ] Revisar as rotas `dashboard/*`, `admin/*` e procedures administrativas com foco em enforcement server-side.
- [ ] Tentar acesso horizontal por ID conhecido em pedidos, enderecos, lotes, entregas e usuarios.
- [ ] Tentar acesso vertical fora do proprio papel para buyer, producer e admin.
- [ ] Confirmar que o comportamento remoto bate com o baseline de RLS validado no codigo.

Codigo ja fechado:

- [x] `packages/api/src/trpc.ts` centraliza `protectedProcedure`, `tenantProcedure`, `producerProcedure` e `buyerProcedure`.
- [x] As tabelas core multi-tenant operam com RLS ativa e forcada.
- [x] O runtime principal e o runtime de auth/webhook usam a mesma role restrita.
- [x] Existe cobertura automatizada para regressao cross-tenant nas entidades sensiveis do fluxo principal.

Evidencia minima:

- lista das procedures revisadas por papel
- tentativa manual de IDOR ou acesso cruzado
- confirmacao do ambiente remoto usando a role certa

## 6. Input and output validation

- [ ] Confirmar que input de tRPC exposto ao cliente usa schema runtime.
- [ ] Confirmar coercoes seguras para numeros, datas, enums, slugs e IDs.
- [ ] Confirmar que respostas de erro nao vazam stack trace, SQL ou segredo.
- [ ] Revisar paginacao, filtros e ordenacoes de procedures caras.

Evidencia minima:

- lista dos routers revisados
- payloads invalidos testados em checkout, order, logistics, admin e product

## 7. Browser and frontend security

- [ ] Confirmar headers de seguranca do web em ambiente remoto.
- [ ] Revisar XSS, `dangerouslySetInnerHTML`, redirects e links externos.
- [ ] Revisar CSRF segundo o modelo real de sessao/cookie usado pelo app.
- [ ] Validar comportamento de embeds, iframes e `postMessage`, se aplicavel.

Escopo minimo:

- `/`
- `/catalogo/*`
- `/auth/*`
- `/dashboard/*`
- `/sucesso`

## 8. Public web routes and SEO surfaces

- [ ] Confirmar que rotas publicas nao vazam dados internos de tenant, estoque reservado ou metadata sensivel.
- [ ] Confirmar estados vazios, erro e 404 seguros nas superficies SEO.
- [ ] Confirmar que `robots.txt` e `sitemap.xml` apontam para superficies corretas.
- [ ] Confirmar tratamento seguro de slugs e parametros de rota.

## 9. Buyer checkout and order flow

- [ ] Executar walkthrough com tampering basico no checkout por fazenda.
- [ ] Validar dupla submissao, retry, abandono e cancelamento.
- [ ] Confirmar o comportamento remoto da pagina `/sucesso`.

Codigo ja fechado:

- [x] `checkout.createFarmCheckoutSession` recalcula itens e frete no servidor.
- [x] O caminho legado de checkout publico foi isolado.
- [x] O webhook Stripe processa com verificacao de assinatura.
- [x] O fluxo principal usa reconstrucao server-side do pedido.
- [x] O processamento de webhook ja tem protecao de idempotencia e replay basico.

Arquivos foco:

- `apps/web/src/components/CartDrawer.tsx`
- `packages/api/src/routers/checkout.ts`
- `packages/api/src/routers/order.ts`
- `apps/web/src/app/sucesso/page.tsx`
- `apps/web/src/app/api/webhooks/stripe/route.ts`

## 10. Producer, admin and logistics flows

- [ ] Tentar mutacoes cross-tenant em fazenda, lote, pedido, entregas e admin.
- [ ] Validar que dashboards e CTAs nao permitem operacoes fora do proprio papel.
- [ ] Revisar respostas administrativas para campos sensiveis em excesso.
- [ ] Validar que notificacoes e dashboards nao vazam eventos de outro tenant.

## 11. tRPC surface and expensive procedures

- [ ] Inventariar procedures publicas, autenticadas e administrativas.
- [ ] Confirmar middleware correto em cada router.
- [ ] Identificar procedures caras e validar limites de payload, paginacao e throttling.
- [ ] Confirmar que mutacoes sensiveis usam transacao quando alteram estado critico.

## 12. Stripe, payments and webhooks

- [ ] Reexecutar replay controlado do webhook em ambiente seguro.
- [ ] Validar cenarios de timeout, duplicacao e retry remoto.
- [ ] Confirmar trilha de auditoria suficiente para reconciliar pedido x pagamento.

Codigo ja fechado:

- [x] assinatura do Stripe verificada antes do processamento
- [x] idempotencia no webhook com lock e tratamento de duplicidade
- [x] fluxo principal de pedido reconstruido do lado servidor

## 13. Uploads, files and media

- [ ] Confirmar allowlist de mime/type e extensoes aceitas.
- [ ] Confirmar limite de tamanho, quantidade e taxa de upload.
- [ ] Testar upload fora da allowlist, mime spoofing e nome malicioso.
- [ ] Confirmar ACL correta para assets publicos e privados.

## 14. Abuse, rate limiting and public attack surface

- [ ] Confirmar rate limiting real em auth, catalogo publico, callbacks e endpoints caros.
- [ ] Confirmar protecao proporcional contra brute force, enumeration e scraping abusivo.
- [ ] Confirmar payload limits e timeouts defensivos nas superficies publicas.
- [ ] Confirmar que upload e webhook nao ficam expostos sem controles minimos.

## 15. Secrets and configuration

Proxima acao operacional imediata: concluir a validacao final remota e decidir se `preview` recebera URLs publicas explicitas ou se o fallback atual por `VERCEL_URL` sera mantido como padrao operacional.

Snapshot remoto consolidado em 2026-03-21:

- [x] `production` no Vercel ja tem a base critica de configuracao para auth, banco, Stripe, UploadThing e URLs publicas do app.
- [x] O ambiente `staging` no GitHub Actions ja tem `DATABASE_ADMIN_URL` para o workflow de deploy de schema com RLS.
- [ ] `preview` ainda nao tem URLs publicas explicitas para auth/app/tRPC; hoje o runtime depende de fallback por `VERCEL_URL` e isso ainda precisa de alinhamento intencional.
- [x] `CRON_SECRET` foi gerado automaticamente e injetado via CLI no Vercel para `production` e `preview`, sem uso de painel manual.
- [x] O runtime efetivo do deploy de producao foi alinhado para Node.js `22.x` por override em `package.json`; o log da Vercel invalidou o cache ao detectar a troca de `24.x` para `22.x`.

Evidencia coletada:

- Em 2026-03-20, GET remoto em `/api/cron/freshness` retornou `500` com payload `CRON_SECRET is not configured.`.
- Em 2026-03-21, apos bootstrap zero-touch + novo deploy, GET remoto em `/api/cron/freshness` retornou `401` com payload `Unauthorized cron invocation.`, confirmando que o segredo passou a estar carregado no runtime.

- [ ] Validar segredos em preview, staging e production.
- [ ] Confirmar ausencia de segredo em bundle client, logs e respostas publicas.
- [ ] Confirmar estrategia minima de rotacao para segredos criticos.

Codigo ja fechado:

- [x] split de `DATABASE_URL` e `DATABASE_ADMIN_URL` consolidado
- [x] runbook de rollout de RLS documentado
- [x] staging DB deploy preparado para rodar apenas quando o segredo administrativo existir

## 16. Dependencies, CI and supply chain

- [ ] Rodar auditoria de dependencias proporcional ao release candidate.
- [x] Confirmar branch protection e required checks no remoto.
- [ ] Confirmar que caches, logs e tokens de automacao seguem privilegio minimo.

Codigo ja fechado:

- [x] `main` exige o check remoto `quality` com branch protection estrita e `enforce_admins` habilitado.
- [x] `ci.yml` padroniza a porta de qualidade do monorepo
- [x] `pnpm check` cobre lint, typecheck, test e Knip
- [x] Husky e lint-staged estao restaurados no baseline local

## 17. Logging, auditability and incident response

- [ ] Revisar logs para ausencia de senha, cookie, token, segredo e PII desnecessaria.
- [ ] Confirmar trilha minima para auth, pedido, pagamento, dispatch e override.
- [ ] Confirmar plano curto de triagem para incidente de auth, pagamento ou isolamento multi-tenant.

## 18. Data protection, backup and recovery

- [ ] Confirmar backup de banco e assets criticos.
- [ ] Confirmar restore testado ou procedimento de restore ensaiado.
- [ ] Confirmar estrategia de rollback operacional para auth, checkout e webhook.
- [ ] Confirmar recovery de pedidos, pagamentos e notificacoes apos incidente.

## 19. Proportional offensive validation

- [ ] brute force e enumeration em `/auth/login`, `/auth/register` e `/api/auth/[...all]`
- [ ] IDOR e acesso horizontal em enderecos, pedidos, lotes, entregas, usuarios e admin
- [ ] tampering em checkout, order e metadata Stripe
- [ ] replay e duplicacao em `/api/webhooks/stripe`
- [ ] upload malicioso, oversize e mime spoofing em `/api/uploadthing`
- [ ] burst e abuso em `/api/trpc/[trpc]` e rotas publicas de catalogo

Saida esperada:

- nenhum bloqueador aberto
- ou lista objetiva de achados com severidade, superficie e plano de remediacao

## Final Sign-off

Registrar ao final:

- data da rodada
- ambiente usado
- responsavel tecnico
- evidencias coletadas
- bloqueadores encontrados
- decisao final: `GO`, `GO WITH FIXES SCHEDULED` ou `NO-GO`
