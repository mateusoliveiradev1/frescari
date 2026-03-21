# Stripe Go-Live Runbook

> Checklist operacional exata para abrir o Stripe em producao no Frescari.
> Atualizado em 2026-03-21.
> Escopo desta versao: Checkout hospedado + webhook + Stripe Connect Express.
> Fase 1 de pagamentos: somente cartao.

## 0. Leitura correta do status

### O que ja esta pronto no codigo

- [x] O checkout cria `Checkout Session` no backend.
- [x] O pedido por peso usa autorizacao + captura manual.
- [x] O webhook valida assinatura Stripe.
- [x] O `business_profile.url` do onboarding agora deve usar `NEXT_PUBLIC_APP_URL`, nao dominio hardcoded.

### O que continua aberto antes de abrir produtores PJ

- [ ] Persistir CPF/CNPJ ou um tipo juridico explicito no banco para definir `business_type` dinamicamente no Stripe Connect.

Observacao importante:

- Ate existir esse campo no modelo de dados, o onboarding continua com fallback tecnico para `individual`.
- Se voce tiver produtores PJ/CNPJ na primeira onda de go-live, pare aqui e resolva essa lacuna antes de executar onboarding real dessas contas.

## 1. Objetivo

Subir o Stripe live do Frescari com o menor risco operacional possivel, respeitando exatamente o que o codigo atual suporta.

## 2. Regra de saida

O go-live Stripe so pode acontecer quando:

- a plataforma Stripe estiver ativada em live
- as chaves live estiverem configuradas no ambiente correto
- o webhook live estiver criado e assinando apenas eventos suportados
- os quatro cenarios de teste abaixo estiverem ticados
- nenhum produtor PJ dependa do fallback atual de `business_type`

## 3. Painel Stripe: ativar live e gerar as chaves

Observacao de navegacao:

- A UI da Stripe muda com frequencia.
- Os nomes abaixo seguem o fluxo atual da documentacao oficial.
- Se o painel aparecer em ingles, use os labels em ingles listados abaixo.

Checklist:

- [ ] Abrir [https://dashboard.stripe.com/](https://dashboard.stripe.com/).
- [ ] Confirmar que voce esta na conta da plataforma correta.
- [ ] No topo do painel, desligar `Test mode` ou sair do ambiente `Sandbox` para entrar em live.
- [ ] Se aparecer o banner `Activate payments` ou `Activate your account`, clicar nele.
- [ ] Preencher os blocos exigidos pela Stripe:
- [ ] dados da empresa
- [ ] dados do representante legal
- [ ] conta bancaria de payouts
- [ ] dados publicos do negocio
- [ ] suporte ao cliente
- [ ] status fiscal/regulatorio exigido pela Stripe

Geracao de chaves:

- [ ] No menu lateral, abrir `Developers`.
- [ ] Clicar em `API keys`.
- [ ] Em `Standard keys`, localizar a `Secret key` live.
- [ ] Copiar a chave live e guardar como valor de `STRIPE_SECRET_KEY`.
- [ ] Ignorar qualquer chave `sk_test_...` ou `pk_test_...`.

Nota tecnica do projeto:

- O app atual nao usa Stripe Elements no frontend.
- Para o fluxo atual, a chave obrigatoria em producao e a `STRIPE_SECRET_KEY`.

## 4. Painel Stripe: configurar o webhook live

Objetivo desta fase:

- criar apenas o endpoint suportado pelo codigo atual
- evitar eventos/metodos que exigem processamento assíncrono extra

Checklist:

- [ ] No menu lateral, abrir `Developers`.
- [ ] Clicar em `Webhooks`.
- [ ] Clicar em `Add destination` ou `Add an endpoint`.
- [ ] Escolher `Webhook endpoint`.
- [ ] Informar a URL:

```text
https://SEU-DOMINIO/api/webhooks/stripe
```

- [ ] Clicar em `Select events`.
- [ ] Marcar apenas:

```text
checkout.session.completed
```

- [ ] Salvar o endpoint.
- [ ] Abrir o endpoint criado.
- [ ] Clicar em `Reveal` ou `Signing secret`.
- [ ] Copiar o valor e guardar como `STRIPE_WEBHOOK_SECRET`.

Fase 1: o que NAO habilitar agora

- [ ] Nao habilitar Pix.
- [ ] Nao habilitar boleto.
- [ ] Nao habilitar outros metodos com confirmacao assíncrona.

Motivo:

- O codigo atual processa somente `checkout.session.completed`.
- Metodos assíncronos exigiriam lidar com eventos como `checkout.session.async_payment_succeeded` e `checkout.session.async_payment_failed`, que ainda nao estao implementados.

## 5. Painel Stripe: Connect para produtores

Checklist:

- [ ] No painel live, abrir a area `Connect`.
- [ ] Concluir qualquer onboarding pendente da plataforma Connect.
- [ ] Confirmar que a plataforma esta apta a criar contas `Express`.

Importante para operacao:

- Cada produtor precisara fazer onboarding live de novo.
- Conta conectada de teste nao serve em live.
- O retorno do onboarding nao garante sozinho que a conta esta pronta para cobrar e sacar.

Conferencia recomendada apos cada onboarding:

- [ ] `charges_enabled = true`
- [ ] `payouts_enabled = true`
- [ ] conta bancaria do produtor cadastrada

## 6. Variaveis consumidas pelo script `setup-vercel-env.mjs`

Observacao:

- O script nao faz perguntas interativas.
- Ele le valores do shell atual e de arquivos `.env*`.

### Shared configs

- [ ] `DATABASE_URL`
- [ ] `BETTER_AUTH_SECRET`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `UPLOADTHING_TOKEN`
- [ ] `STRIPE_CONNECT_MODE`

### Production only configs

- [ ] `BETTER_AUTH_URL`
- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] `NEXT_PUBLIC_BETTER_AUTH_URL`
- [ ] `NEXT_PUBLIC_TRPC_URL`

### Geracao automatica / apoio

- [ ] `CRON_SECRET` e alinhada/gerada pelo proprio script quando necessario.
- [ ] Em preview, o script tambem aproveita:
- [ ] `VERCEL_PREVIEW_APP_URL`
- [ ] `VERCEL_PREVIEW_AUTH_URL`
- [ ] `VERCEL_PREVIEW_TRPC_URL`

### Minimo para o go-live Stripe

- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_CONNECT_MODE`
- [ ] `NEXT_PUBLIC_APP_URL`

## 7. Sequencia operacional de configuracao no projeto

### 7.1 Linkar a Vercel, se necessario

```powershell
cd C:\Users\Liiiraa\Documents\estudos\frescari\apps\web
vercel link
cd C:\Users\Liiiraa\Documents\estudos\frescari
```

### 7.2 Exportar os valores no shell

Marketplace com Connect:

```powershell
$env:STRIPE_SECRET_KEY="<SUA_CHAVE_LIVE>"
$env:STRIPE_WEBHOOK_SECRET="<SEU_WEBHOOK_SECRET_LIVE>"
$env:STRIPE_CONNECT_MODE="connect"
$env:NEXT_PUBLIC_APP_URL="https://seu-dominio.com"
$env:BETTER_AUTH_URL="https://seu-dominio.com"
$env:NEXT_PUBLIC_BETTER_AUTH_URL="https://seu-dominio.com"
$env:NEXT_PUBLIC_TRPC_URL="https://seu-dominio.com/api/trpc"
```

Checkout sem Connect:

```powershell
$env:STRIPE_CONNECT_MODE="platform_only"
```

### 7.3 Rodar o bootstrap das envs

```powershell
pnpm vercel:env:setup
```

## 8. Plano de testes: 4 cenarios obrigatorios

## Cenario 1: compra normal com captura automatica

- [ ] Usar um produto vendido por unidade.
- [ ] Criar checkout.
- [ ] Concluir pagamento com cartao.
- [ ] Confirmar que o usuario caiu na tela de sucesso.
- [ ] Confirmar no Stripe que o pagamento foi capturado automaticamente.
- [ ] Confirmar no app que o pedido foi criado e vinculado ao pagamento.

Resultado esperado:

- [ ] `checkout.session.completed` chega no webhook.
- [ ] pedido confirmado no sistema.
- [ ] nenhum erro no painel de entregas do webhook.

## Cenario 2: produtor apto para receber via Connect

- [ ] Executar o onboarding live de um produtor real de teste.
- [ ] Confirmar que o produtor possui `stripeAccountId` no sistema.
- [ ] Criar uma compra de um lote desse produtor.
- [ ] Confirmar que o checkout abre normalmente.
- [ ] Confirmar no Stripe que a cobranca usa o fluxo esperado de Connect.

Resultado esperado:

- [ ] checkout nao falha por ausencia de conta conectada
- [ ] taxa da plataforma e destino do repasse seguem o desenho atual

## Cenario 3: pedido por peso com captura manual

- [ ] Usar um item vendido por peso.
- [ ] Criar checkout.
- [ ] Concluir autorizacao no cartao.
- [ ] Confirmar no Stripe que o pagamento ficou em estado de captura pendente.
- [ ] No app, executar a acao operacional que dispara `captureWeighedOrder`.
- [ ] Capturar o valor final correto.

Resultado esperado:

- [ ] o pedido entra no fluxo de peso
- [ ] a captura manual funciona sem erro
- [ ] o valor final capturado bate com o peso final validado

Observacao operacional:

- [ ] executar esse teste dentro da janela de autorizacao da Stripe
- [ ] nao deixar pedido por peso sem captura expirar

## Cenario 4: webhook live entregue e assinado

- [ ] Abrir `Developers` -> `Webhooks`.
- [ ] Localizar o endpoint live do Frescari.
- [ ] Executar uma compra real de teste em live controlado.
- [ ] Verificar a entrega do evento `checkout.session.completed`.
- [ ] Confirmar status `200` no endpoint.
- [ ] Confirmar ausencia de retries e de erro de assinatura.

Resultado esperado:

- [ ] assinatura validada
- [ ] evento processado apenas uma vez
- [ ] pedido reconciliado com a sessao Stripe

## 9. Regras operacionais da Fase 1

- [ ] Lancar apenas com cartao.
- [ ] Nao habilitar metodos assíncronos ate o webhook suportar eventos adicionais.
- [ ] Nao fazer onboarding de produtores PJ enquanto o sistema nao armazenar CPF/CNPJ ou tipo juridico explicito.
- [ ] Validar o primeiro produtor live manualmente.
- [ ] Validar o primeiro pedido por peso manualmente.

## 10. Arquivos de referencia no repositorio

- `scripts/setup-vercel-env.mjs`
- `packages/api/src/routers/checkout.ts`
- `packages/api/src/routers/stripe.ts`
- `packages/api/src/routers/order.ts`
- `apps/web/src/app/api/webhooks/stripe/route.ts`

## 11. Fontes oficiais

- [Stripe API keys](https://docs.stripe.com/keys)
- [Stripe go-live checklist](https://docs.stripe.com/get-started/checklist/go-live)
- [Stripe webhooks](https://docs.stripe.com/webhooks)
- [Stripe Express accounts](https://docs.stripe.com/connect/express-accounts)
- [Stripe destination charges](https://docs.stripe.com/connect/destination-charges)
