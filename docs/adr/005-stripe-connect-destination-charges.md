# ADR 005 — Stripe Connect com Destination Charges

**Status:** Aceito
**Data:** 2026-01

---

## Contexto

A Frescari é um marketplace que precisa: (a) cobrar do comprador, (b) reter uma comissão, (c) repassar o restante ao produtor. O mecanismo de pagamento precisa suportar múltiplos produtores com contas bancárias próprias.

## Decisão

Usar **Stripe Connect com Destination Charges**:

- A Frescari é a plataforma (platform account)
- Cada produtor cria uma conta conectada (connected account) via Stripe Connect
- O comprador paga à plataforma
- A plataforma retém `application_fee_amount` (10%) e repassa o restante para a conta do produtor
- Fluxo: `checkout.sessions.create` com `payment_intent_data.application_fee_amount` e `payment_intent_data.transfer_data.destination`

## Alternativas consideradas

| Alternativa | Por que descartada |
|-------------|-------------------|
| Stripe Connect — Standard (separado por produtor) | Produtor gerencia sua própria conta Stripe; sem controle de fee pela plataforma |
| Stripe Connect — Express (split payments) | Modelo mais complexo para gerenciar splits em tempo real; Destination Charges é mais simples para o MVP |
| Transferência manual pós-pagamento | Risco operacional: requer processo manual; sujeito a falha humana; não escala |
| Outro gateway (PagSeguro, Mercado Pago) | Suporte a marketplace/connect mais limitado; Stripe tem melhor documentação e API |

## Consequências

- `application_fee_amount` é calculado server-side: frontend nunca define valores
- Webhook `checkout.session.completed` é a fonte de verdade para criação do pedido
- Assinatura do webhook verificada via `stripe.webhooks.constructEvent` antes de qualquer processamento
- Idempotência garantida por chaves de idempotência em cada chamada sensível
- Contas PF usam `individual` account type; PJ usam `company`
- Trade-off: produtor precisa completar onboarding Stripe antes de poder vender
