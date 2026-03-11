# 📖 Frescari - Project Bible (System Prompt)

**O SaaS Invisível B2B (Marketplace) para o setor de hortifruti.**
Nós não operamos galpões nem estoques; somos a infraestrutura digital que conecta produtores a compradores e lucramos via taxa de intermediação (Take Rate).

*Este documento serve como a "Constituição" do projeto e o System Prompt definitivo para guiar o desenvolvimento por qualquer engenheiro de software ou agente de IA, garantindo a política de "Erro Zero".*

---

## 1. Regras de Negócio e Monetização

### Modelo Financeiro
- Usamos exclusivamente o **Stripe Connect (Destination Charges)**.
- O sistema deve sempre cobrar do comprador, reter a comissão da plataforma (`application_fee_amount`) e enviar o valor restante para o `stripe_account_id` do produtor.

### Lógica de Precificação (Hortifruti)
O sistema lida com 2 tipos de produtos:
- **`UNIT` (Caixa fechada):** Cobrança imediata e status `paid`.
- **`WEIGHT` (Granel):** Fluxo adaptativo com **pré-autorização**. O sistema aguarda a pesagem real do item antes de fazer a captura exata dos centavos.

---

## 2. Engenharia de Alta Integridade (Segurança e Tipagem)

- **Validação Estrita:** Nunca confie em dados do frontend. Toda entrada (pesos, preços, etc.) DEVE passar por esquemas rígidos do **Zod** integrados ao **tRPC** para tipagem End-to-End.
- **Prevenção de Falhas:** O TypeScript deve operar em modo estrito máximo, incluindo a flag `noUncheckedIndexedAccess` no `tsconfig.json` para evitar erros de runtime.
- **Idempotência Financeira:** Toda chamada à API do Stripe deve possuir chaves de idempotência para evitar cobranças duplicadas em caso de falha de rede do operador.

---

## 3. Banco de Dados (Drizzle ORM + PostgreSQL)

- **Multi-Tenant:** Todas as queries devem respeitar o isolamento de inquilinos (`seller_tenant_id` e `buyer_tenant_id`) usando **Row-Level Security (RLS)** no PostgreSQL.
- **Rastreabilidade (No Hard Deletes):** Proibido apagar dados (Hard Delete). Usar apenas **Soft Deletes** (`ativo = false` ou `deleted_at`) e manter trilhas de auditoria para resolução de disputas financeiras e operacionais.

---

## 4. DevOps & Qualidade

- **Husky & lint-staged:** Exigir o uso de Husky e lint-staged para rodar `tsc --noEmit` e linters antes de qualquer executarmos um commit, bloqueando com eficácia código quebrado.
- **Detecção de Dead Code:** Uso obrigatório de **Knip** para detecção contínua e eliminação de códigos, exports e dependências não utilizadas em todo o ecossistema.
