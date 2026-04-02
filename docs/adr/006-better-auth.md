# ADR 006 — Better Auth sobre NextAuth/Auth.js

**Status:** Aceito
**Data:** 2026-02

---

## Contexto

A autenticação precisava suportar: e-mail/senha, verificação de e-mail obrigatória, campos customizados no usuário (`role`, `tenantId`), persistência em PostgreSQL via Drizzle e controle total sobre os tokens de sessão.

## Decisão

Usar **Better Auth v1.5.x** com o adapter oficial do Drizzle. A sessão é gerenciada via cookie `HttpOnly; Secure; SameSite=Lax`. O token de sessão é removido da resposta JSON para evitar exposição (apenas via cookie).

## Alternativas consideradas

| Alternativa | Por que descartada |
|-------------|-------------------|
| NextAuth / Auth.js | API em transição entre v4 e v5 no momento da decisão; adapter Drizzle experimental; customização de campos de usuário mais complexa |
| Clerk | Serviço externo pago com lock-in; dados de usuário fora do nosso banco; overhead de setup para MVP |
| Implementação própria (JWT + cookies) | Risco de segurança por erro de implementação; duplica trabalho já feito por bibliotecas maduras |
| Lucia Auth | Descontinuado em 2025 |

## Consequências

- Schema de usuário, sessão, conta e verificação é gerado pelo Better Auth e integrado ao schema Drizzle
- Verificação de e-mail obrigatória antes de acesso completo à plataforma
- Rate limiting aplicado externamente na route handler (`/api/auth/[...all]`): 10 req/min por IP
- Token de sessão mascarado na resposta JSON (apenas enviado via cookie) para evitar XSS
- Erros de "usuário já existe" mascarados com mensagem genérica (anti-enumeração)
- Aceitação legal versionada (`userLegalAcceptances`) capturada no hook de signup
