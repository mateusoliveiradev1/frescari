# Frescari - Project Bible

**O SaaS invisivel B2B do hortifruti.**
Nao operamos galpoes nem estoques; somos a infraestrutura digital que conecta produtores a compradores e monetiza via taxa de intermediacao.

Este documento e a constituicao operacional do projeto. Ele existe para manter as decisoes de produto, monetizacao e integridade tecnica coerentes entre codigo, operacao e documentacao.

---

## 1. Regras de negocio e monetizacao

### Modelo financeiro

- Usamos exclusivamente **Stripe Connect (Destination Charges)**.
- O sistema sempre cobra do comprador, retem a comissao da plataforma (`application_fee_amount`) e envia o restante para a conta conectada do produtor.

### Modelo de catalogo e oferta comercial

- O `admin` e responsavel pelo **catalogo mestre**: categorias e produtos-base.
- O `producer` nao cria uma taxonomia paralela; ele publica **lotes** vinculados a um produto-base existente.
- O lote e a oferta comercial real do produtor: quantidade, foto, preco, unidade, colheita e validade.
- Na versao atual do produto, a unidade escolhida no lote/produto (`kg`, `un`, `cx`, `maco`) e a referencia efetiva usada por catalogo, carrinho e checkout.
- O `pricingType` do produto mestre deve ser tratado como orientacao operacional e compatibilidade de dominio, nao como a unica trava comercial enquanto o fluxo do produtor continuar permitindo definir a unidade no lote.

### Logica de precificacao e captura

- Itens vendidos por **unidade/caixa** seguem captura imediata do pagamento.
- Itens vendidos por **peso** usam autorizacao inicial e captura manual apos a pesagem final.
- O sistema nunca deve confiar em preco, nome de produto ou taxa enviados pelo frontend quando estiver montando pedido ou sessao de pagamento.

---

## 2. Engenharia de alta integridade

- **Validacao estrita:** nunca confiar em dados do frontend. Toda entrada de peso, preco, unidade, endereco e identificadores deve passar por schemas Zod integrados ao tRPC.
- **Prevencao de falhas:** TypeScript deve operar em modo estrito maximo, incluindo `noUncheckedIndexedAccess`, para reduzir erro de runtime.
- **Idempotencia financeira:** toda chamada sensivel ao Stripe deve usar chaves de idempotencia para evitar cobrancas duplicadas.
- **Fonte unica de verdade:** a experiencia publica e os dashboards devem refletir o estado real calculado no backend, nao inferencias locais do cliente.

---

## 3. Banco de dados

- **Multi-tenant:** toda query deve respeitar isolamento por tenant usando **Row-Level Security (RLS)** no PostgreSQL.
- **Isolamento estrito:** tabelas core multi-tenant como `products`, `product_lots`, `orders`, `farms` e `addresses` devem manter RLS habilitada e validada.
- **Policies obrigatorias:** policies de `SELECT`, `INSERT`, `UPDATE` e `DELETE` devem checar a variavel de contexto `app.current_tenant`.
- **Principio do menor privilegio:** o runtime da aplicacao nunca deve usar credenciais com `BYPASSRLS`.
- **Runtime restrito:** `DATABASE_URL` deve apontar para uma role restrita de aplicacao.
- **Admin separado:** `DATABASE_ADMIN_URL` fica reservado para migrations, bootstrap e operacoes administrativas.
- **Rastreabilidade:** evitar hard delete; preferir soft delete e trilha auditavel para pedidos, pagamentos, lotes e operacao.

---

## 4. DevOps e qualidade

- **Husky e lint-staged:** bloquear commit com codigo quebrado via `tsc --noEmit`, lint e checks minimos.
- **Deteccao de dead code:** uso continuo de **Knip** para remover exports, arquivos e dependencias mortos.
- **Release gate:** o projeto precisa passar por `pnpm check`, build e evidencias operacionais antes de qualquer go-live.
- **Documentacao viva:** qualquer mudanca estrutural de fluxo comercial ou operacional deve atualizar README, planos centrais e runbooks no mesmo ciclo.
