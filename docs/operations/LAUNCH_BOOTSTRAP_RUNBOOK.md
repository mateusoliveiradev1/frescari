# Launch Bootstrap Runbook

> Runbook operacional para bootstrap da base oficial do Frescari.
> Atualizado em 2026-03-23.
> Escopo: promover admin raiz, subir categorias/produtos mestres reais e auditar o legado Stripe antes de remover o fallback temporario.

## 1. Pre-requisitos

- ter `DATABASE_ADMIN_URL` apontando para o banco alvo correto
- ter uma conta real criada pelo fluxo normal do produto
- ter essa conta com email verificado antes da promocao para `admin`
- revisar o manifesto base em `docs/operations/launch-bootstrap.manifest.example.json`

## 2. Promover o admin raiz

Primeiro rode em modo de simulacao:

```bash
pnpm --filter @frescari/db launch:bootstrap -- --admin-only --admin-email seu-email@dominio.com --dry-run
```

Se o plano vier sem `adminMissing`, execute de verdade:

```bash
pnpm --filter @frescari/db launch:bootstrap -- --admin-only --admin-email seu-email@dominio.com
```

Resultado esperado:

- a conta existente muda de `buyer` ou `producer` para `admin`
- nenhuma conta inexistente e promovida por engano

## 3. Preparar o manifesto oficial de catalogo

Copie o exemplo e substitua pelos dados reais da operacao:

```bash
copy docs\\operations\\launch-bootstrap.manifest.example.json docs\\operations\\launch-bootstrap.manifest.json
```

Checklist do manifesto:

- slugs finais de categorias definidos antes da carga
- nomes oficiais de categorias aprovados
- produtos mestres sem duplicidade
- `pricingType` coerente com o uso operacional
- imagens padrao apontando para URLs definitivas ou ficando nulas

## 4. Subir categorias e produtos mestres

Rode primeiro a simulacao:

```bash
pnpm --filter @frescari/db launch:bootstrap -- --manifest docs/operations/launch-bootstrap.manifest.json --dry-run
```

Depois rode a carga real:

```bash
pnpm --filter @frescari/db launch:bootstrap -- --manifest docs/operations/launch-bootstrap.manifest.json
```

Resultado esperado:

- categorias entram por `slug`, sem duplicar
- produtos mestres entram por `name`, com update idempotente quando necessario
- nada depende de seed de teste antiga

## 5. Auditar o legado Stripe antes de remover o fallback

Enquanto existir produtor com `stripeAccountId` e sem primeiro sync, o fallback legado ainda protege o catalogo.

Auditoria normal:

```bash
pnpm --filter @frescari/api stripe:connect:audit-legacy
```

Auditoria bloqueante para fechamento:

```bash
pnpm --filter @frescari/api stripe:connect:audit-legacy -- --fail-on-legacy
```

Se ainda houver legado, rode primeiro o backfill:

```bash
pnpm --filter @frescari/api stripe:connect:backfill -- --limit 25
```

## 6. Criterio de saida desta frente

Esta frente so pode ser marcada como fechada quando:

- o admin raiz real existir no ambiente alvo
- o manifesto oficial tiver sido aplicado sem erro
- categorias reais estiverem publicadas
- produtos mestres reais estiverem publicados
- a auditoria Stripe estiver limpa ou com pendencias explicitamente aceitas

## 7. Observacoes

- nao reutilizar catalogo de teste
- nao promover usuario inexistente por atalho manual em SQL
- nao remover o fallback legado Stripe antes de uma auditoria limpa
- registrar no master plan a data da execucao real deste runbook
