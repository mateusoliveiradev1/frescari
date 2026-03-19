# Go-Live Security Checklist

> Documento operacional do go-live web do Frescari. Atualizado em 2026-03-19.

## Objective

Transformar a rodada final de seguranca do MVP em uma verificacao executavel, auditavel e proporcional ao produto real que vai para producao.

Este checklist e focado no que existe hoje no repositorio:

- rotas publicas em `apps/web/src/app`
- autenticacao em `/api/auth/[...all]`
- superficie tRPC em `/api/trpc/[trpc]`
- upload em `/api/uploadthing`
- webhook Stripe em `/api/webhooks/stripe`
- routers do backend em `packages/api/src/routers`
- isolamento multi-tenant, secrets, dependencias e operacao

## Exit Rule

O go-live web so pode acontecer quando:

- nenhum bloqueador permanecer aberto em auth, autorizacao, isolamento multi-tenant, pagamentos, uploads, abuso de superficie publica, logs/auditoria e recovery
- cada frente abaixo tiver evidencia minima registrada
- a validacao ofensiva proporcional ao MVP tiver sido executada nas superficies criticas

## Surface Inventory

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
- `packages/api/src/routers/product.ts`
- `packages/api/src/routers/stripe.ts`

## 1. Auth, session and cookies

- [ ] Confirmar expiracao de sessao, logout, revogacao e comportamento apos troca de tenant ou role.
- [ ] Confirmar que cookies de sessao usam `HttpOnly`, `Secure` em producao e `SameSite` intencional.
- [ ] Confirmar que login, register e callbacks nao permitem open redirect.
- [ ] Confirmar que erros de autenticacao nao enumeram conta, tenant ou estado interno.
- [ ] Confirmar rate limit e throttling nas entradas de auth e nos callbacks publicos.
- [ ] Confirmar que nenhuma rota protegida depende apenas de hide/show na UI.

Prova minima:

- captura de headers/cookies em ambiente de teste ou preview
- teste manual de login/logout/troca de sessao
- nota objetiva sobre redirects e mensagens de erro

## 2. Authorization, RBAC and tenant isolation

- [ ] Revisar todas as rotas `dashboard/*`, `admin/*` e procedures administrativas para enforcement server-side.
- [ ] Validar isolamento horizontal: um tenant nao pode ler, editar, despachar ou faturar dados de outro tenant.
- [ ] Validar isolamento vertical: buyer, producer e admin nao conseguem executar acoes fora do proprio papel.
- [ ] Confirmar RLS ativo e coerente com o middleware de tenant.
- [ ] Tentar acessar recursos por ID conhecido de outro tenant em pedidos, enderecos, lotes, entregas e usuarios.
- [ ] Revisar queries criticas para garantir filtro explicito por tenant e ausencia de fallback inseguro.

Prova minima:

- lista de procedimentos validados por papel
- tentativa manual de IDOR/horizontal access em rotas e procedures criticas
- confirmacao de RLS e filtros de tenant nas entidades mais sensiveis

Status parcial desta rodada (2026-03-19):

- [PASS] Enforcement server-side centralizado: `packages/api/src/trpc.ts` aplica `protectedProcedure`, `tenantProcedure`, `producerProcedure` e `buyerProcedure`, com transacao autenticada e binding de `userId`/`tenantId` no contexto.
- [PASS] Isolamento vertical revisado nas procedures criticas auditadas: `packages/api/src/routers/farm.ts`, `packages/api/src/routers/addresses.ts`, `packages/api/src/routers/order.ts`, `packages/api/src/routers/logistics.ts` e `packages/api/src/routers/admin.ts` exigem role correta e filtram recursos do fluxo principal pelo tenant do usuario.
- [PASS] RLS estrutural esta ativo e validado nas entidades core multi-tenant. As tabelas `products`, `product_lots`, `orders`, `farms` e `addresses` agora possuem `ENABLE/FORCE ROW LEVEL SECURITY`, policies de `SELECT`/`INSERT`/`UPDATE`/`DELETE` e prova automatizada de bloqueio cross-tenant no proprio PostgreSQL.
- [PASS] `packages/api/src/routers/lot.ts` agora exige `tenantId` tambem no fallback por `products.id` dentro de `create`, impedindo que um produtor vincule um lote proprio a um produto de outro tenant apenas com um UUID valido.
- [PASS] Evidencia automatizada: `pnpm --filter @frescari/api test` passou em 2026-03-19 com `75/75`, incluindo a regressao negativa de `lot.create` para tentativa cross-tenant.
- [PASS] Existe regressao automatizada cobrindo tentativa cross-tenant em `lot.create`, validando que a mutation retorna erro e nao chega a inserir o lote quando o produto pertence a outro tenant.
- [PASS] `packages/db/src/index.ts` agora força os runtimes `db` e `authDb` a usarem `DATABASE_URL`, preservando a mesma role restrita da aplicacao nos fluxos de auth e webhook.
- [PASS] `packages/db/src/rls.integration.test.ts` valida que `authDb` usa a mesma role de runtime de `db` e que essa role continua sem `BYPASSRLS`.
- [PASS] Decisao da secao 2: o isolamento estrutural multi-tenant por RLS foi comprovado no codigo, com `DATABASE_ADMIN_URL` reservado para migrations/bootstrap e `DATABASE_URL` reservado para runtime.

## 3. Input and output validation

- [ ] Confirmar que input de tRPC usa schema runtime nas procedures expostas.
- [ ] Confirmar coercoes seguras para numericos, datas, enums, slugs e IDs.
- [ ] Confirmar que nenhuma decisao critica depende apenas de tipos TypeScript no cliente.
- [ ] Confirmar serializacao segura de erro, sem stack trace ou segredo em resposta publica.
- [ ] Revisar paginacao, filtros, ordenacoes e buscas para impedir payloads inesperados e queries explosivas.

Prova minima:

- lista de routers revisados em `packages/api/src/routers`
- tentativas com payload invalido em checkout, order, logistics, admin e product
- anotacao sobre respostas de erro observadas

## 4. Browser and frontend security

- [ ] Confirmar headers de seguranca no web: CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` ou equivalente.
- [ ] Revisar uso de HTML rich text, dangerouslySetInnerHTML e renderizacao de conteudo vindo do banco.
- [ ] Confirmar que links externos usam `rel` adequado quando abrirem nova aba.
- [ ] Confirmar protecao contra open redirect em fluxos de auth, sucesso e retorno do checkout.
- [ ] Revisar CSRF conforme o modelo real de sessao/cookies usado pelo app.
- [ ] Revisar `postMessage`, embeds e comportamento em iframes, se houver.

Escopo minimo:

- `/`
- `/catalogo/*`
- `/auth/*`
- `/dashboard/*`
- `/sucesso`

Prova minima:

- dump dos headers relevantes
- revisao pontual dos componentes e paginas sensiveis
- nota sobre XSS/redirect/CSRF

## 5. Public web routes and SEO surfaces

- [ ] Confirmar que rotas publicas nao vazam dados internos de tenant, estoque reservado, IDs ou metadata sensivel.
- [ ] Confirmar que catalogo e paginas SEO nao expoem campos administrativos, chaves, caminhos internos ou traces.
- [ ] Confirmar tratamento seguro de estados vazios, erro e produto inexistente.
- [ ] Confirmar que `robots.txt` e `sitemap.xml` nao apontam para superficies privadas ou ambientes errados.
- [ ] Confirmar que slugs e parametros de rota sao tratados com validacao e escape adequados.

Prova minima:

- checklist manual das rotas publicas
- exemplos de 404/erro/slug invalido
- revisao de `robots.txt` e `sitemap.xml`

## 6. Buyer checkout and order flow

- [ ] Confirmar que o cliente nao consegue definir preco, frete, tenant, endereco final ou metadata sensivel do pedido.
- [ ] Confirmar que `checkout.createFarmCheckoutSession` recalcula tudo server-side.
- [ ] Confirmar que `address_snapshot` e reconstrucoes de pedido nao aceitam dados brutos inseguros do frontend.
- [ ] Confirmar que carrinho e remocao por fazenda nao permitem misturar itens/tenants indevidos.
- [ ] Confirmar que `sucesso` nao marca pedido como pago nem revela estado inconsistente antes do webhook.
- [ ] Validar cenarios de retry, abandono, cancelamento e dupla submissao.

Arquivos foco:

- `apps/web/src/components/CartDrawer.tsx`
- `packages/api/src/routers/checkout.ts`
- `packages/api/src/routers/order.ts`
- `apps/web/src/app/sucesso/page.tsx`

Prova minima:

- walkthrough do checkout com tampering basico
- teste de dupla submissao/retry
- evidencia de recalculo server-side

## 7. Producer, admin and logistics flows

- [ ] Confirmar que CRUD de fazenda, lote, inventario e pedidos respeita tenant e role em toda mutacao.
- [ ] Confirmar que dispatch, override, wave e acoes operacionais nao aceitam recursos de outro tenant.
- [ ] Confirmar que telas admin exigem role correta no servidor e nao apenas layout protegido.
- [ ] Confirmar que listagens administrativas nao retornam campos sensiveis sem necessidade.
- [ ] Confirmar que notificacoes e dashboards nao vazam eventos de tenants diferentes.

Arquivos foco:

- `packages/api/src/routers/farm.ts`
- `packages/api/src/routers/lot.ts`
- `packages/api/src/routers/logistics.ts`
- `packages/api/src/routers/admin.ts`
- `packages/api/src/routers/notification.ts`

Prova minima:

- tentativas de acesso cruzado por tenant e por role
- revisao manual das mutacoes operacionais
- nota sobre campos sensiveis presentes nas respostas

## 8. tRPC surface and expensive procedures

- [ ] Inventariar procedures publicas, autenticadas e administrativas.
- [ ] Confirmar middlewares corretos em cada router.
- [ ] Identificar procedures caras e validar limites de payload, paginacao e throttling.
- [ ] Confirmar que procedures de escrita usam transacao quando alteram estado sensivel.
- [ ] Confirmar que erros nao vazam SQL, stack trace, segredos ou detalhes internos.

Prova minima:

- lista de routers/procedures revisados
- nota sobre protecao de procedures caras
- exemplos de erro publico observados

## 9. Stripe, payments and webhooks

- [x] Confirmar verificacao de assinatura do webhook Stripe.
- [x] Confirmar idempotencia do processamento e seguranca contra replay.
- [ ] Confirmar que pedido, pagamento e status final sao reconstruidos do lado servidor.
- [ ] Confirmar que metadata usada no webhook nao permite escalacao de tenant, alteracao de valor ou troca de destinatario.
- [ ] Confirmar logs suficientes para auditar eventos de pagamento sem vazar segredos.
- [ ] Validar cenarios de retry do Stripe, timeout e webhook duplicado.

Status parcial desta rodada (2026-03-19):

- Assinatura: `apps/web/src/app/api/webhooks/stripe/route.ts` le `stripe-signature`, rejeita ausencia do header e usa `stripe.webhooks.constructEvent(...)` antes de qualquer processamento de evento.
- Idempotencia: o fluxo de pedido existente (`metadata.orderId`) agora roda em transacao com `pg_advisory_xact_lock` por pedido e faz early return silencioso quando o pedido ja esta em estado pos-pagamento.
- Idempotencia: o fluxo legado agora pega lock transacional por `stripe-session`, faz a checagem de `stripeSessionId` dentro da transacao principal e trata `23505` como evento ja processado com retorno HTTP 200.
- Evidencia automatizada: `pnpm test` passou no monorepo em 2026-03-19, incluindo os testes de webhook do Stripe com retry duplicado.

Arquivos foco:

- `apps/web/src/app/api/webhooks/stripe/route.ts`
- `packages/api/src/routers/stripe.ts`
- `packages/api/src/routers/checkout.ts`
- `packages/api/src/routers/order.ts`

Prova minima:

- replay controlado do webhook em ambiente seguro
- evidencia de idempotencia
- nota sobre reconciliacao pedido x pagamento

## 10. Uploads, files and media

- [ ] Confirmar allowlist de mime/type e extensoes aceitas.
- [ ] Confirmar limite de tamanho, quantidade e taxa de upload.
- [ ] Confirmar nomes aleatorios, ausencia de path traversal e ausencia de execucao de conteudo enviado.
- [ ] Confirmar que previews publicos nao permitem HTML/script ativo.
- [ ] Confirmar politicas de acesso para arquivos privados vs publicos.

Arquivos foco:

- `apps/web/src/app/api/uploadthing/route.ts`
- qualquer configuracao de storage e componentes de upload/preview usados no web

Prova minima:

- tentativa com arquivo fora da allowlist
- tentativa com nome/path malicioso
- nota sobre ACL/publicacao dos assets

## 11. Abuse, rate limiting and public attack surface

- [ ] Confirmar rate limiting real em auth, catalogo publico, callbacks e endpoints caros.
- [ ] Confirmar protecao proporcional contra brute force, enumeration e scraping abusivo.
- [ ] Confirmar limites de payload e timeout defensivo para requests publicas.
- [ ] Confirmar que buscas e filtros nao permitem negar servico por combinacao explosiva.
- [ ] Confirmar que endpoints de webhook e upload nao ficam expostos sem controles minimos.

Prova minima:

- tabela simples dos endpoints com rate limit
- teste basico de burst nas superficies publicas
- nota sobre timeouts e payload limits

## 12. Secrets and configuration

- [ ] Inventariar todas as env vars criticas e classificar o que e server-only vs `NEXT_PUBLIC_*`.
- [ ] Confirmar ausencia de segredo em bundle client, logs e mensagens de erro.
- [ ] Confirmar que Stripe keys, auth secrets e tokens de integracao estao fora do repo e fora do client.
- [ ] Confirmar estrategia minima de rotacao e revogacao para segredos criticos.
- [ ] Confirmar que ambientes de preview, staging e prod nao compartilham segredos indevidamente.

Status parcial desta rodada (2026-03-19):

- [PASS] O split de credenciais do banco foi consolidado no codigo: `DATABASE_URL` fica como credencial restrita de runtime e `DATABASE_ADMIN_URL` fica reservado para migrations/bootstrap.
- [PASS] O workspace local foi alinhado para essa separacao, incluindo o `.env` raiz e o `.env.local` usado pelo app web.
- [PASS] O runbook operacional do rollout remoto foi registrado em `docs/architecture/RLS_ROLLOUT_RUNBOOK.md`.
- [OPEN] Ainda nao existe evidencia de `staging`, `production`, secrets remotos ou target de deploy configurado no repo/workspace atual.
- [OPEN] A validacao final desta secao continua dependente da configuracao remota e da checagem de bundles/logs no ambiente real de deploy.

Prova minima:

- inventario resumido de segredos
- checagem do bundle/client config
- nota sobre rotacao e segregacao por ambiente

## 13. Dependencies, CI and supply chain

- [ ] Rodar auditoria de dependencias e tratar advisories criticos ou com exploit publico plausivel.
- [ ] Confirmar lockfile consistente e install reproduzivel.
- [ ] Revisar scripts de build/install e hooks para evitar execucao desnecessaria ou arriscada.
- [ ] Revisar workflow de CI para garantir que segredo nao vaza em logs e que checks criticos bloqueiam merge.
- [ ] Confirmar que uploads de artefato, caches e tokens de automacao seguem privilegio minimo.

Prova minima:

- resultado da auditoria de dependencias
- nota sobre CI, hooks e privilegios
- referencia aos checks obrigatorios do repo

## 14. Logging, auditability and incident response

- [ ] Confirmar que logs nao gravam senha, cookie, token, segredo, payload de pagamento ou PII desnecessaria.
- [ ] Confirmar trilha minima para auth, pedido, pagamento, dispatch e override operacional.
- [ ] Confirmar correlacao minima entre pedido, checkout, pagamento e webhook.
- [ ] Confirmar alertas ou consultas operacionais para falha de webhook, erro de checkout e excecoes criticas.
- [ ] Confirmar procedimento de triagem para incidente de auth, pagamento ou isolamento multi-tenant.

Prova minima:

- amostra de logs revisados
- lista curta dos eventos auditados
- runbook curto de resposta para incidente critico

## 15. Data protection, backup and recovery

- [ ] Confirmar backup de banco e assets criticos.
- [ ] Confirmar restore testado ou, no minimo, procedimento de restore ensaiado e documentado.
- [ ] Confirmar estrategia de recovery para pedidos, pagamentos e notificacoes apos incidente.
- [ ] Confirmar retencao minima e descarte seguro para dados sensiveis e temporarios.
- [ ] Confirmar rollback operacional para deploy com regressao em auth, checkout ou webhook.

Prova minima:

- evidencia de backup/restore
- nota sobre recovery de pagamento/pedido
- passo a passo curto de rollback

## 16. Proportional offensive validation

Executar uma rodada ofensiva curta, focada nas superficies de maior risco:

- [ ] brute force e enumeration em `/auth/login`, `/auth/register` e `/api/auth/[...all]`
- [ ] IDOR/horizontal access em enderecos, pedidos, lotes, entregas, usuarios e admin
- [ ] tampering em checkout, order e metadata Stripe
- [ ] replay/duplicacao em `/api/webhooks/stripe`
- [ ] upload malicioso, oversize e mime spoofing em `/api/uploadthing`
- [ ] burst e abuso em `/api/trpc/[trpc]` e rotas publicas de catalogo

Saida esperada:

- nenhum achado bloqueador aberto
- ou lista objetiva de achados com severidade, rota/arquivo e plano de remediacao antes do go-live

## Final Sign-off

Registrar ao final:

- data da rodada
- ambiente usado
- responsavel tecnico
- evidencias coletadas
- bloqueadores encontrados
- decisao final: `GO`, `GO WITH FIXES SCHEDULED`, ou `NO-GO`
