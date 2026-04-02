# Backup, Restore and Recovery Runbook

> Runbook operacional minimo para backup, restore e recovery do Frescari.
> Atualizado em 2026-03-22.
> Escopo desta versao: banco principal em Neon Postgres e superficies criticas do app web.

## 1. Objetivo

Definir a trilha operacional minima para recuperar auth, checkout, webhook e notificacoes sem depender de memoria informal ou acesso manual improvisado.

## 2. Fonte de backup assumida

- Banco principal hospedado em Neon Postgres.
- A trilha primaria de recovery do provedor deve usar a capacidade de restore por janela temporal e branch restore no Neon.
- Este repositório agora versiona um ensaio local de recovery para as tabelas criticas via `pnpm --filter @frescari/db db:recovery-rehearsal`.

Importante:

- O ensaio versionado abaixo nao substitui a confirmacao do restore window ou de snapshots agendados no console da Neon.
- Ele existe para provar que conseguimos reconstruir uma copia coerente das tabelas criticas em schema isolado usando a credencial administrativa atual.

## 3. Tabelas criticas desta rodada

- `tenants`
- `user`
- `account`
- `session`
- `verification`
- `addresses`
- `farms`
- `product_categories`
- `master_products`
- `products`
- `product_lots`
- `orders`
- `order_items`
- `notifications`
- `farm_vehicles`
- `delivery_dispatch_overrides`
- `delivery_dispatch_waves`
- `delivery_dispatch_wave_orders`

## 4. Ensaiar recovery agora

Pre-condicoes:

- `DATABASE_ADMIN_URL` configurada. Se nao existir, o script usa `DATABASE_URL`.
- O role usado precisa conseguir criar e remover schema temporario.
- Rodar fora de janela de alta sensibilidade operacional.

Comando:

```bash
pnpm --filter @frescari/db db:recovery-rehearsal
```

O que o comando faz:

1. Resolve os identificadores da branch Neon atual via `pg_settings`.
2. Cria um schema temporario `recovery_drill_YYYYMMDDHHMMSS`.
3. Replica estrutura e dados das tabelas criticas para esse schema isolado.
4. Compara a contagem da origem com a copia restaurada tabela por tabela.
5. Remove o schema temporario ao final, salvo quando `KEEP_RECOVERY_DRILL_SCHEMA=1`.

Saida esperada:

- JSON com timestamp, `neon.project_id`, `neon.branch_id`, schema do drill e contagem por tabela.
- Processo encerrando com `exit 0`.

Opcional:

```bash
$env:RECOVERY_DRILL_REPORT_PATH='C:\\temp\\frescari-recovery-drill.json'
pnpm --filter @frescari/db db:recovery-rehearsal
```

## 5. Recuperacao operacional do banco

Quando houver incidente de perda ou corrupcao de dados:

1. Congelar mudancas operacionais no app e pausar deploys.
2. Confirmar horario aproximado do incidente.
3. No Neon, criar branch de restore ou restaurar a branch alvo para um ponto anterior ao incidente.
4. Validar no branch restaurado:
   - auth basica
   - leitura de catalogo
   - checkout
   - webhook Stripe em replay controlado
   - notificacoes criticas
5. So depois alinhar conexoes da aplicacao para o alvo restaurado ou promover a recuperacao definida pelo time.

## 6. Recovery funcional minimo apos restore

Depois do restore do provedor, verificar:

- login
- sign-out
- leitura de pedidos
- consistencia `orders` x `order_items`
- notificacoes por tenant
- dashboard operacional
- integridade de lotes e estoque

## 7. Rollback de aplicacao

Em incidente causado por deploy e nao por perda de dados:

1. Reverter para o ultimo deploy estavel na Vercel.
2. Revalidar auth, catalogo, checkout e webhook.
3. Se houver escrita incorreta no banco, combinar rollback de app com restore na Neon.

## 8. Evidencia minima para fechar a checklist de go-live

- captura do restore window ativo na Neon
- confirmacao se snapshots agendados estao ativos ou nao
- saida do `db:recovery-rehearsal` com `exit 0`
- nota curta informando quem executou, ambiente, branch Neon alvo e horario
