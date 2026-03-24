# Launch Bootstrap Runbook

> Runbook operacional para bootstrap da base oficial do Frescari.
> Atualizado em 2026-03-24.
> Escopo: promover admin raiz, orientar o cadastro manual do catalogo inicial e auditar o legado Stripe antes de remover o fallback temporario.

## 1. Pre-requisitos

- ter `DATABASE_ADMIN_URL` apontando para o banco alvo correto
- ter uma conta real criada pelo fluxo normal do produto
- ter essa conta com email verificado antes da promocao para `admin`
- decidir se o catalogo inicial sera criado manualmente no painel ou por carga opcional em lote

## 2. Promover o admin raiz

Primeiro rode em modo de simulacao:

```bash
pnpm --filter @frescari/db launch:bootstrap --admin-only --admin-email seu-email@dominio.com --dry-run
```

Se o plano vier sem `adminMissing`, execute de verdade:

```bash
pnpm --filter @frescari/db launch:bootstrap --admin-only --admin-email seu-email@dominio.com
```

Resultado esperado:

- a conta existente muda de `buyer` ou `producer` para `admin`
- nenhuma conta inexistente e promovida por engano

## 3. Fluxo recomendado para o catalogo inicial

Para o Frescari, o fluxo recomendado de abertura e:

- subir a base oficial vazia, sem `seed`
- promover apenas a conta admin raiz
- criar categorias e produtos manualmente no painel admin
- validar a taxonomia real em operacao antes de automatizar qualquer carga

Checklist operacional:

- slugs finais de categorias definidos antes da carga
- nomes oficiais de categorias aprovados
- produtos iniciais sem duplicidade
- `pricingType` coerente com o uso operacional
- imagens padrao apontando para URLs definitivas ou ficando nulas
- nada de reaproveitar `seed` ou catalogo de teste

## 4. Carga por manifesto em lote (opcional)

Use esta opcao apenas se, no futuro, houver necessidade de:

- repetir a mesma carga em mais de um ambiente
- subir muitos itens de uma vez
- manter um catalogo base auditavel e reexecutavel

Se esse caso aparecer, copie o exemplo e substitua pelos dados reais da operacao:

```bash
copy docs\\operations\\launch-bootstrap.manifest.example.json docs\\operations\\launch-bootstrap.manifest.json
```

Rode primeiro a simulacao:

```bash
pnpm --filter @frescari/db launch:bootstrap --manifest docs/operations/launch-bootstrap.manifest.json --dry-run
```

Depois rode a carga real:

```bash
pnpm --filter @frescari/db launch:bootstrap --manifest docs/operations/launch-bootstrap.manifest.json
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
pnpm --filter @frescari/api stripe:connect:audit-legacy --fail-on-legacy
```

Se ainda houver legado, rode primeiro o backfill:

```bash
pnpm --filter @frescari/api stripe:connect:backfill --limit 25
```

## 5.1 Evidencia operacional em staging em 2026-03-24

- conta real validada: `warface01031999@gmail.com`
- login real no preview respondeu `EMAIL_NOT_VERIFIED`, com reenvio de email disparado pelo backend
- email da Resend foi recuperado e o callback real de verificacao foi consumido com sucesso
- o banco passou a registrar `emailVerified=true` para a conta validada
- `pnpm --filter @frescari/db launch:bootstrap --admin-only --admin-email warface01031999@gmail.com --dry-run` retornou `noop=1`
- a execucao real do mesmo comando completou sem escrita adicional depois do ajuste do CLI para driver transacional
- o proximo passo operacional desta frente, no fluxo recomendado, e criar categorias e produtos manualmente no painel quando a branch/base oficial de producao estiver pronta

## 6. Criterio de saida desta frente

Esta frente so pode ser marcada como fechada quando:

- o admin raiz real existir no ambiente alvo
- categorias reais estiverem publicadas
- produtos reais estiverem publicados
- a auditoria Stripe estiver limpa ou com pendencias explicitamente aceitas

## 7. Observacoes

- nao reutilizar catalogo de teste
- nao aplicar `seed` na branch/base oficial de producao
- nao promover usuario inexistente por atalho manual em SQL
- nao remover o fallback legado Stripe antes de uma auditoria limpa
- registrar no master plan a data da execucao real deste runbook
