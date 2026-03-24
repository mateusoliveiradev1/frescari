# Go-Live Security Checklist

> Checklist operacional de seguranca do go-live web do Frescari.
> Atualizado em 2026-03-24.
> Status do codigo: SELADO.
> Status operacional do go-live: ABERTO.
> Decisao atual: NO-GO ate fechar exposicao publica final, rodada ofensiva proporcional e confirmacao final do backup gerenciado na Neon.

## 0. Papel deste documento e leitura correta do status

### Papel documental

- [x] Este arquivo consolida a trilha de seguranca, as evidencias e a decisao operacional desta frente de go-live.
- [x] Este arquivo nao substitui planos mestres, runbooks ou docs funcionais como fonte unica de verdade do produto.
- [x] `docs/MVP_CLOSURE_PLAN.md` continua como resumo de fechamento do MVP.
- [x] `docs/architecture/LAUNCH_V1_MASTER_PLAN.md` continua como plano estrategico e nao redefine a regra de release desta fase.
- [x] `docs/operations/LAUNCH_BOOTSTRAP_RUNBOOK.md` passa a ser o caminho versionado para bootstrap de admin, cadastro manual do catalogo inicial e auditoria do legado Stripe.
- [x] A decisao de `GO`, `GO WITH FIXES SCHEDULED` ou `NO-GO` desta frente de seguranca fica registrada aqui.

### O que "Status do codigo: SELADO" significa

- [x] O runtime principal usa `DATABASE_URL` restrita e nao depende de role com `BYPASSRLS`.
- [x] O runtime de auth/webhook foi alinhado para a mesma role restrita de runtime.
- [x] O estado final de RLS pode ser reaplicado via `pnpm --filter @frescari/db db:deploy`.
- [x] O workflow `.github/workflows/ci.yml` executa `lint`, `typecheck`, `test` e `knip`.
- [x] O workflow `.github/workflows/deploy-staging.yml` faz push de schema + reaplicacao de RLS em staging e falha de forma segura quando `DATABASE_ADMIN_URL` nao esta configurada.
- [x] O repositório passou a ter tambem `.github/workflows/deploy-production.yml`, com disparo manual, inspecao do alvo Neon e aplicacao versionada de migracoes para a base oficial quando a branch limpa existir.
- [x] O baseline local de qualidade foi restaurado em 2026-03-20 e `pnpm check` esta verde.
- [x] A malha E2E do core web cobre comprador, fazenda e entregas com `pnpm --filter web test:e2e` verde.
- [x] Os cron jobs operacionais do app web estao versionados em `vercel.json`.
- [x] `apps/web/src/lib/auth.ts` agora aplica `trustedOrigins`, atributos seguros de cookie e rate limit dedicado para auth.
- [x] `apps/web/src/app/auth/login/login-form.tsx` e `apps/web/src/app/auth/register/register-form.tsx` ocultam detalhes sensiveis do backend no cliente.
- [x] `apps/web/src/app/api/auth/[...all]/route.ts` mascara cadastro duplicado para evitar enumeracao no nivel da API.
- [x] `apps/web/src/app/api/auth/[...all]/route.ts` remove o `token` do corpo JSON de `sign-in/email` e `sign-up/email`, preservando a sessao apenas no cookie `HttpOnly`.

### O que continua aberto antes de dizer GO

- [x] rodar o `build` final do release candidate
- [x] concluir a configuracao das variaveis de ambiente e segredos na nuvem
- [ ] validar o comportamento remoto final no custom domain publico, com HTTPS, sem bypass e sem abrir os aliases atuais
- [ ] executar a rodada ofensiva proporcional ao MVP
- [ ] confirmar o backup gerenciado do provedor e registrar a evidencia final do restore window/snapshots
- [ ] criar a branch Neon oficial limpa de producao, configurar `DATABASE_ADMIN_URL` e `EXPECTED_PRODUCTION_NEON_BRANCH_ID` no environment `production` do GitHub Actions, e disparar `.github/workflows/deploy-production.yml`

### Situacao consolidada em 2026-03-23

- [x] O fix de catalogo publico para `STRIPE_CONNECT_MODE=connect` foi merged no PR `#45`.
- [x] `pnpm build` passou localmente na rodada final de release candidate em 2026-03-22.
- [x] `pnpm --filter web test:e2e` passou com `11/11` na mesma rodada.
- [x] Os checks remotos de `quality` e Vercel passaram no PR `#45` antes do merge.
- [x] A validacao remota de auth foi executada em preview protegido com bypass controlado no deploy `https://frescari-staging-jpo85t3f0-mateusoliveiradev1s-projects.vercel.app`.
- [x] O PR `#48` passou com `quality` e Vercel verdes antes do merge, consolidando o fallback visual do email de verificacao e a regressao de onboarding para contas novas.
- [x] Em `2026-03-24`, a validacao operacional do email verificado foi concluida no preview `frescari-staging-git-codex-119eac-mateusoliveiradev1s-projects.vercel.app`: o login real respondeu `EMAIL_NOT_VERIFIED`, o email da Resend foi entregue, o callback foi consumido, o banco passou a registrar `emailVerified=true` e o login seguinte retornou sucesso com redirecionamento para `/auth/verified`.
- [ ] A validacao remota final do app em URL publica ainda nao foi encerrada porque a estrategia escolhida e manter a protection nos aliases atuais e abrir apenas o futuro custom domain.
- [ ] A rodada ofensiva proporcional e a confirmacao final do backup gerenciado da Neon seguem sem registro final.
- [ ] Em `2026-03-24`, o `production` da Vercel ainda nao apontava para a base oficial final: o `DATABASE_URL` remoto do ambiente estava vazio, e o alvo local de producao inspecionado (`br-blue-pond-ai3k7tdq`) nao estava limpo para go-live.

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

- [x] Confirmar criacao de sessao, login e logout remoto com `Origin` legitima.
- [ ] Confirmar expiracao, revogacao e comportamento apos troca de tenant ou role.
- [x] Confirmar que cookies de sessao usam `HttpOnly`, `Secure` em producao e `SameSite` intencional.
- [x] O fluxo exposto desta rodada e apenas email/senha, sem OAuth, magic link ou redirect param controlado pelo cliente no caminho principal.
- [ ] Revalidar open redirect se callbacks ou provedores externos forem adicionados antes da abertura publica.
- [x] Confirmar que login e register nao enumeram existencia de conta nos cenarios exercitados.
- [x] O corpo JSON de `sign-in/email` e `sign-up/email` nao expõe mais o token de sessao em respostas de sucesso.
- [ ] Confirmar que callbacks e demais erros de auth nao vazam tenant, role ou estado interno adicional.
- [x] Confirmar rate limit e throttling nas entradas de auth.
- [ ] Confirmar throttling nos callbacks publicos.
- [ ] Confirmar que nenhuma rota protegida depende apenas de hide/show na UI.

Evidencia minima:

- captura de headers/cookies em preview ou staging
- walkthrough manual de login/logout
- nota curta sobre redirects e mensagens de erro

Evidencia remota consolidada em 2026-03-22:

- GET anonimo em `/auth/login` no preview endurecido retornou `200` com `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Permissions-Policy`, `Referrer-Policy` e `X-Robots-Tag: noindex`.
- POST invalido em `/api/auth/sign-in/email` retornou mensagem generica `Invalid email or password`, sem distinguir existencia de conta.
- Em 2026-03-22, a suite `pnpm --filter web test` passou com regressao cobrindo a remocao do `token` do corpo de `sign-in/email` e `sign-up/email` sem perder `set-cookie`.
- Repeticao rapida de POST invalido em `/api/auth/sign-in/email` passou a responder `Too many requests. Please try again later.`, confirmando throttling real na superficie de login.
- POST valido em `/api/auth/sign-up/email` com `acceptedLegalVersion=2026-03-23-v1` retornou `200` e `Set-Cookie: __Secure-better-auth.session_token=...; HttpOnly; Secure; SameSite=Lax`.
- POST duplicado em `/api/auth/sign-up/email` no preview corrigido agora retorna `{"message":"Nao foi possivel concluir o cadastro agora. Revise os dados e tente novamente.","code":"SIGN_UP_FAILED"}`, sem vazar existencia de conta.
- POST em `/api/auth/sign-out` sem `Origin` retornou `403` com `MISSING_OR_NULL_ORIGIN`; com `Origin` legitima do proprio deployment retornou `200` e limpou `__Secure-better-auth.session_token`, `__Secure-better-auth.session_data` e `__Secure-better-auth.dont_remember` com `Max-Age=0`.
- A nota residual anterior sobre `token` no JSON fica encerrada: a regressao atual do route handler exige `payload.token === null` em `sign-in/email` e `sign-up/email`, preservando a sessao apenas no cookie `HttpOnly`.

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
- [x] Em 2026-03-22 a regressao do catalogo publico em Connect foi corrigida sem reabrir bypass amplo de leitura no runtime.

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

Decisao operacional assumida em 2026-03-22: manter a deployment protection nos aliases `*.vercel.app` e expor o app apenas pelo custom domain oficial quando ele for comprado e configurado.

Snapshot remoto consolidado em 2026-03-22:

- [x] `production` no Vercel ja tem a base critica de configuracao para auth, banco, Stripe, UploadThing e URLs publicas do app.
- [x] `preview` no Vercel ja tem `DATABASE_URL`, `BETTER_AUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `UPLOADTHING_TOKEN`, `STRIPE_CONNECT_MODE` e `CRON_SECRET`.
- [x] O ambiente `staging` no GitHub Actions ja tem `DATABASE_ADMIN_URL` para o workflow de deploy de schema com RLS.
- [x] O ambiente `staging` no GitHub Actions ja tem `EXPECTED_STAGING_NEON_BRANCH_ID` para inspecao do target correto.
- [ ] O projeto ainda nao tem custom domains configurados; com `ssoProtection.deploymentType = all_except_custom_domains`, todos os aliases atuais permanecem protegidos fora do bypass controlado.
- [x] O app ja tem fallback por `VERCEL_URL` para app/auth/tRPC em `apps/web/src/lib/app-url.ts`, `apps/web/src/lib/auth.ts`, `apps/web/src/lib/auth-client.ts` e `apps/web/src/trpc/Provider.tsx`.
- [x] `CRON_SECRET` foi gerado automaticamente e injetado via CLI no Vercel para `production` e `preview`, sem uso de painel manual.
- [x] O projeto Vercel `frescari-staging` foi alinhado para `Node.js 22.x` em 2026-03-22 por configuracao remota.
- [x] O preview endurecido `https://frescari-staging-jpo85t3f0-mateusoliveiradev1s-projects.vercel.app` foi usado com `vercel curl` para validacao remota de headers e auth.

Regras operacionais definidas para exposicao publica:

- [x] Nao remover a protection atual dos aliases `*.vercel.app`.
- [x] Nao tratar preview protegido como URL publica definitiva.
- [x] Usar o custom domain oficial como unica superficie publica do go-live.
- [x] Reexecutar a rodada final de validacao publica apenas depois que o custom domain estiver ativo com HTTPS funcional.

Evidencia coletada:

- Em 2026-03-20, GET remoto em `/api/cron/freshness` retornou `500` com payload `CRON_SECRET is not configured.`.
- Em 2026-03-21, apos bootstrap zero-touch + novo deploy, GET remoto em `/api/cron/freshness` retornou `401` com payload `Unauthorized cron invocation.`, confirmando que o segredo passou a estar carregado no runtime.
- Em 2026-03-22, `vercel env ls` confirmou a presenca dos segredos criticos em `preview` e `production`.
- Em 2026-03-22, `gh secret list --env staging` confirmou `DATABASE_ADMIN_URL` e `gh variable list --env staging` confirmou `EXPECTED_STAGING_NEON_BRANCH_ID`.
- Em 2026-03-23, `vercel env pull --environment=preview` + `pnpm --filter @frescari/db run db:inspect-target` confirmaram que o `DATABASE_URL` usado pelo preview do projeto `frescari-staging` aponta para `NEON_BRANCH_ID=br-polished-term-aiqe9nkj`, exatamente igual ao `EXPECTED_STAGING_NEON_BRANCH_ID`.
- Em 2026-03-23, a mesma branch Neon de `staging` respondeu com os objetos esperados de `0010_user_legal_acceptances`, `0011_producer_profile_fields` e `0012_stripe_connect_status_fields`, confirmando schema alinhado no ambiente inspecionado.
- Em 2026-03-23, `pnpm --filter @frescari/api stripe:connect:audit-legacy --json --limit 200` retornou `summary.total=0` e `legacyUnsynced=0`, e uma consulta SQL direta em `tenants` retornou `total=0`; nesta data, a base de `staging` inspecionada estava vazia, sem legado Stripe pendente para backfill.
- Em 2026-03-22, `vercel project inspect` e a API de projeto confirmaram `nodeVersion=22.x`.
- Em 2026-03-22, a API de projeto confirmou `ssoProtection.deploymentType=all_except_custom_domains` e a API de dominios retornou `domains=[]`.

Runbook quando o dominio for comprado:

1. Adicionar o custom domain ao projeto Vercel `frescari-staging`.
2. Apontar DNS, esperar validacao e confirmar HTTPS ativo no dominio final.
3. Alinhar `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL` e `NEXT_PUBLIC_APP_URL` para o custom domain.
4. Fazer novo deploy e repetir walkthrough publico de `/`, `/catalogo`, `/auth/login`, `/auth/register`, checkout e logout no dominio final.
5. So depois dessa rodada reavaliar a decisao de `GO` desta checklist.

- [x] Inventariar segredos e variaveis criticas em `preview`, `staging` e `production`.
- [ ] Validar o comportamento remoto final desses ambientes no custom domain publico, sem bypass e sem abrir os aliases protegidos.
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

- [ ] Confirmar backup gerenciado de banco e assets criticos no provedor.
- [x] Confirmar restore testado ou procedimento de restore ensaiado.
- [x] Confirmar estrategia de rollback operacional para auth, checkout e webhook.
- [ ] Confirmar recovery de pedidos, pagamentos e notificacoes apos incidente.

Evidencia coletada em 2026-03-22:

- [x] `docs/operations/BACKUP_RESTORE_RECOVERY_RUNBOOK.md` versiona o procedimento minimo de backup, restore e rollback.
- [x] `pnpm --filter @frescari/db db:recovery-rehearsal` executou com `exit 0`, criou um schema isolado temporario e reconciliou as contagens das tabelas criticas sem tocar no schema `public`.
- [ ] A captura do restore window/snapshots da Neon ainda depende de acesso ao console do provedor e nao foi anexada nesta rodada.

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

Regra de fechamento:

- enquanto este bloco final nao for atualizado com uma decisao nova, este documento continua sendo o registro vigente da decisao de seguranca do go-live
- nenhum resumo paralelo deve sobrescrever a decisao de seguranca registrada aqui

### Status do momento em 2026-03-23

- Decisao atual: `NO-GO`
- Frentes ja fechadas nesta rodada: baseline de codigo; hardening de auth com `trustedOrigins`, cookies seguros e rate limit; mascara anti-enumeracao em cadastro; remocao do `token` do corpo de `sign-in/sign-up`; validacao remota de sign-up/sign-in/sign-out em preview endurecido; fix do catalogo Connect; inventario de segredos; checks remotos dos PRs `#45` e `#48`; ensaio versionado de restore/recovery com `db:recovery-rehearsal`; decisao operacional de manter aliases protegidos e publicar apenas no custom domain.
- Bloqueadores operacionais remanescentes: custom domain ainda nao configurado e sem walkthrough publico final; rodada ofensiva proporcional ao MVP; confirmacao do backup gerenciado e restore window na Neon; revisao residual de callbacks publicos.
