# SDD - Reformulacao de Minha Conta e da navegacao do usuario

**Goal:** redesenhar a arquitetura de informacao da navbar e da area de conta para que buyer, producer e admin tenham uma experiencia coerente de `Minha Conta`, com separacao clara entre dados pessoais, seguranca e areas operacionais. A troca de senha deixa de ser uma tela isolada e passa a ser uma parte da nova area de conta.

**Architecture:** a navegacao passa a ter dois niveis semanticos. O primeiro nivel continua sendo a navegacao operacional por role no topo. O segundo nivel passa a ser o menu pessoal do usuario, com uma entrada unica `Minha Conta`. A nova area compartilhada fica em ` /conta ` e contem subrotas role-aware como ` /conta/perfil `, ` /conta/seguranca ` e ` /conta/enderecos `, enquanto areas operacionais como ` /dashboard/fazenda ` continuam fora dessa superficie. A tela de seguranca usa `authClient.changePassword(...)` do Better Auth, o perfil usa o endpoint nativo `updateUser` para dados pessoais suportados, e o wrapper de `apps/web/src/app/api/auth/[...all]/route.ts` endurece `POST /change-password` com rate limit e sanitizacao de `token`.

**Tech Stack:** Next.js 16 App Router, React 19, Better Auth 1.6.1, Drizzle adapter, `@frescari/ui`, Node.js test runner com JSDOM e Playwright.

**Execution Note:** este SDD continua sendo a fonte de verdade da arquitetura de informacao. A execucao detalhada desta iniciativa, com tasks atomicas, ownership por dominio e criterios de verificacao, esta descrita em `docs/plans/2026-04-09-minha-conta-navbar-360-implementation-plan.md`. Esse plano expande a implementacao com a subrota ` /conta/cadastro ` para separar claramente dados pessoais (`user`) de dados cadastrais/organizacionais (`tenant`), sem alterar o principio central deste documento: `Minha Fazenda` continua fora de `Minha Conta`.

---

## 1. O que significa "nova IA da navbar"

Neste contexto, `IA` significa **arquitetura da informacao**.

Nao e sobre visual apenas. E sobre:

- quais entradas existem
- em que nivel elas aparecem
- como sao agrupadas
- o que pertence a `Minha Conta`
- o que continua como area operacional

Em termos praticos, a nova IA define:

- o que fica no menu principal
- o que fica no menu do avatar
- quais paginas pertencem a `Minha Conta`
- como buyer, producer e admin chegam nessas paginas

---

## 2. Problema

Hoje a experiencia esta fragmentada:

- buyer tem ` /dashboard/perfil `, mas essa pagina e apenas de enderecos
- producer e admin nao possuem uma area equivalente de conta pessoal
- o menu do avatar nao oferece um conceito de `Minha Conta`; ele expoe uma acao isolada de `Meus Enderecos` so para buyer
- dados pessoais, dados cadastrais e seguranca nao estao organizados sob uma mesma superficie
- a troca de senha seria implementada em cima de uma estrutura que ja nasceu incompleta

Isso cria uma experiencia que funciona por remendos, nao por sistema.

---

## 3. Estado atual relevante

### 3.1 Navegacao

- `apps/web/src/components/global-nav.tsx` concentra a navbar desktop e mobile
- a navegacao principal ja muda por role
- o menu de avatar desktop e o bloco final do menu mobile hoje possuem:
  - `Meus Enderecos` apenas para buyer
  - `Sair`

### 3.2 Conta do usuario

No schema de usuario em `packages/db/src/schema.ts`, os dados pessoais centrais sao enxutos:

- `name`
- `email`
- `image`
- `role`
- timestamps

Isso indica que a area `Minha Conta` deve focar em **identidade pessoal e seguranca**, nao em dados operacionais amplos.

### 3.3 Buyer

- a tela atual em `apps/web/src/app/dashboard/perfil/profile-page-client.tsx` e uma experiencia rica de enderecos
- ela ja pode ser reaproveitada como a futura subpagina ` /conta/enderecos `

### 3.4 Producer

- dados de operacao do produtor vivem em `apps/web/src/app/dashboard/fazenda/farm-page-client.tsx`
- isso inclui fazenda, localizacao, entrega, frete e frota
- portanto, `Minha Fazenda` deve continuar separada de `Minha Conta`

### 3.5 Better Auth

O Better Auth ja fornece:

- `POST /change-password`
- `POST /update-user`

Observacoes relevantes:

- `change-password` usa `sensitiveSessionMiddleware`
- `change-password` pode retornar `token`
- `update-user` suporta atualizar `name` e `image`
- `update-user` **nao** permite atualizar `email`

---

## 4. Objetivo do design

Entregar uma base de conta e navegacao que:

- crie um ponto unico e claro de `Minha Conta`
- funcione para todos os usuarios autenticados
- separe conta pessoal de area operacional
- acomode a troca de senha da forma certa
- absorva a tela de enderecos do buyer sem manter o acoplamento com ` /dashboard/perfil `
- deixe o sistema pronto para crescer com perfil, preferencias e futuras configuracoes

---

## 5. Principios de produto

### 5.1 Conta pessoal e diferente de area operacional

`Minha Conta` deve reunir:

- perfil
- dados pessoais de conta
- seguranca
- enderecos, quando fizer sentido para a jornada pessoal do usuario

`Minha Fazenda` deve continuar reunindo:

- dados operacionais do produtor
- localizacao da fazenda
- frete
- raio de entrega
- frota

### 5.2 Um unico ponto de entrada pessoal

O usuario nao deve procurar "senha" em um lugar, "enderecos" em outro e "perfil" em outro. O ponto de entrada pessoal passa a ser `Minha Conta`.

### 5.3 Mesmo conceito, variacao por role

Todos os roles entram em `Minha Conta`, mas cada role ve apenas as secoes que fazem sentido.

### 5.4 Migracao com compatibilidade

A tela atual de buyer nao deve quebrar. O caminho legado deve redirecionar para a nova estrutura.

---

## 6. Nova IA proposta

### 6.1 Modelo de navegacao

**Nivel 1 - navegacao principal**

Continua focada na operacao do role:

- buyer:
  - `Visao Geral`
  - `Mercado`
  - `Historico e Faturas`
- producer:
  - `Dashboard`
  - `Minha Fazenda`
  - `Estoque e Lotes`
  - `Vendas`
  - `Entregas`
  - `Vitrine`
- admin:
  - `Plataforma`
  - `Catalogo`
  - `Usuarios`
  - `Marketplace`

**Nivel 2 - menu pessoal**

No avatar desktop e no rodape do menu mobile:

- `Minha Conta`
- `Sair`

Sai de cena:

- `Meus Enderecos` como atalho solto na navbar

Ele passa a existir dentro de `Minha Conta`.

### 6.2 Estrutura da area `Minha Conta`

Rota container:

- ` /conta `

Subrotas:

- ` /conta/perfil `
- ` /conta/seguranca `
- ` /conta/enderecos ` - buyer only

Rotas futuras possiveis:

- ` /conta/preferencias `
- ` /conta/sessoes `

### 6.3 Landing por role

**Decisao recomendada:** ` /conta ` redireciona para ` /conta/perfil ` para todos os roles.

Justificativa:

- cria um ponto de entrada consistente
- evita que buyer caia direto em enderecos e esconda o conceito de conta
- deixa a area escalavel para o futuro

### 6.4 Conteudo por role

**Buyer**

- `Perfil`
- `Enderecos`
- `Seguranca`

**Producer**

- `Perfil`
- `Seguranca`
- card de referencia para `Minha Fazenda` dentro de `Perfil`, sem mover a operacao para dentro de conta

**Admin**

- `Perfil`
- `Seguranca`

---

## 7. O que entra em cada pagina

### 7.1 ` /conta/perfil `

Pagina compartilhada para dados pessoais e cadastrais de conta.

Conteudo v1:

- nome editavel
- email visivel em modo read-only
- tipo de conta
- membro desde
- imagem/avatar preparada para evolucao, se o projeto quiser expor isso nesta fase

Observacoes:

- usar `authClient.updateUser(...)` para campos suportados
- nao tentar incluir mudanca de email nesta fase
- para producer, exibir um bloco do tipo:
  - `Dados da operacao do produtor sao gerenciados em Minha Fazenda`
  - CTA para ` /dashboard/fazenda `

### 7.2 ` /conta/enderecos `

Buyer only.

Conteudo:

- migracao da experiencia atual de ` /dashboard/perfil `
- manter a tela rica de enderecos praticamente intacta
- adaptar cabecalho e breadcrumbs ao novo contexto de conta

### 7.3 ` /conta/seguranca `

Pagina compartilhada para:

- senha atual
- nova senha
- confirmar nova senha
- checklist da policy
- `Encerrar outras sessoes`
- submit `Atualizar senha`

A implementacao usa:

- `authClient.changePassword(...)`
- `apps/web/src/lib/password-policy.ts`

---

## 8. Escopo revisado

### 8.1 Dentro do escopo

- reformulacao da IA do menu pessoal da navbar
- criacao do container ` /conta `
- layout de conta compartilhado com navegacao interna
- pagina `Perfil`
- pagina `Seguranca`
- migracao da tela de enderecos do buyer para ` /conta/enderecos `
- redirect legado de ` /dashboard/perfil `
- endurecimento de `POST /change-password`
- testes de navegacao, role gating, redirect e seguranca

### 8.2 Fora do escopo

- mover `Minha Fazenda` para dentro de `Minha Conta`
- refatorar profundamente a navegacao principal por role
- mudanca de email
- MFA / 2FA
- gerenciamento detalhado de sessoes
- alteracoes amplas em schema de banco

---

## 9. Decisoes de arquitetura

### 9.1 `Minha Conta` fica no menu pessoal, nao na navegacao operacional

**Decisao recomendada:** manter `Minha Conta` no avatar desktop e no bloco pessoal do menu mobile.

**Justificativa:**

- reforca que e uma area pessoal, nao uma area de trabalho
- evita competir com as entradas principais de negocio
- simplifica a navbar

### 9.2 ` /dashboard/perfil ` vira legado

**Decisao recomendada:** redirecionar:

- ` /dashboard/perfil ` -> ` /conta/enderecos `

**Justificativa:**

- preserva links antigos
- evita duas casas para o mesmo conceito

### 9.3 Producer continua com `Minha Fazenda` separada

**Decisao recomendada:** nao absorver dados operacionais do producer em `Minha Conta`.

**Justificativa:**

- esses dados pertencem ao dominio da operacao
- misturar conta com fazenda aumentaria ambiguidade
- a separacao melhora manutencao e entendimento

### 9.4 Perfil v1 foca no que ja existe bem modelado

**Decisao recomendada:** em `Perfil`, editar apenas o que a plataforma ja suporta com clareza:

- nome
- imagem, se exposto nesta fase

Mostrar em modo informativo:

- email
- role
- data de cadastro

**Justificativa:**

- evita inventar backend paralelo
- aproveita `update-user` nativo do Better Auth
- reduz risco e mantem a entrega elegante

### 9.5 Seguranca segue com hardening de gateway

**Decisao recomendada:** manter no SDD:

- rate limit para ` /change-password `
- sanitizacao de `token`
- tratamento explicito de `SESSION_NOT_FRESH`

---

## 10. UX proposta

### 10.1 Desktop

**Navbar**

- links principais por role permanecem
- avatar abre dropdown com:
  - resumo do usuario
  - `Minha Conta`
  - `Sair`

### 10.2 Mobile

**Sheet menu**

- parte superior com links principais por role
- bloco inferior do usuario com:
  - nome
  - email
  - `Minha Conta`
  - `Sair da Conta`

### 10.3 Layout de `Minha Conta`

Cabecalho:

- titulo `Minha Conta`
- subtitulo explicando que ali ficam dados pessoais, seguranca e configuracoes da conta

Navegacao interna:

- tabs horizontais no desktop
- tabs scrollaveis ou lista segmentada no mobile

Tabs por role:

- buyer: `Perfil`, `Enderecos`, `Seguranca`
- producer: `Perfil`, `Seguranca`
- admin: `Perfil`, `Seguranca`

---

## 11. Contrato funcional da pagina de seguranca

### 11.1 Chamada cliente

```ts
authClient.changePassword(
  {
    currentPassword,
    newPassword,
    revokeOtherSessions: true,
  },
  {
    onSuccess: () => { ... },
    onError: (context) => { ... },
  },
);
```

### 11.2 Validacoes locais

- senha atual obrigatoria
- nova senha respeita `isStrongPassword(...)`
- confirmacao identica

### 11.3 Estados de erro

- `INVALID_PASSWORD`
- `SESSION_NOT_FRESH`
- `RATE_LIMITED`
- `TOO_MANY_REQUESTS`
- fallback generico

---

## 12. Requisitos de seguranca

### 12.1 Rate limit

Atualizar `apps/web/src/app/api/auth/[...all]/route.ts` para incluir:

- ` /change-password `

### 12.2 Sanitizacao de token

Para `POST /change-password`, qualquer `token` no JSON deve voltar como:

- `token: null`

### 12.3 Politica de senha

Reusar obrigatoriamente:

- `PASSWORD_MIN_LENGTH`
- `PASSWORD_POLICY_MESSAGE`
- `getPasswordCriteria(...)`
- `isStrongPassword(...)`

---

## 13. Arquitetura de codigo proposta

### 13.1 Novos arquivos

- `apps/web/src/app/conta/layout.tsx`
- `apps/web/src/app/conta/page.tsx`
- `apps/web/src/app/conta/conta-shell.tsx`
- `apps/web/src/app/conta/perfil/page.tsx`
- `apps/web/src/app/conta/perfil/profile-form.tsx`
- `apps/web/src/app/conta/seguranca/page.tsx`
- `apps/web/src/app/conta/seguranca/change-password-form.tsx`
- `apps/web/src/app/conta/enderecos/page.tsx`

### 13.2 Arquivos a modificar

- `apps/web/src/components/global-nav.tsx`
- `apps/web/src/app/dashboard/perfil/page.tsx`
- `apps/web/src/app/dashboard/perfil/profile-page-client.tsx`
- `apps/web/src/app/api/auth/[...all]/route.ts`
- testes associados

### 13.3 Reuso explicito

- experiencia atual de enderecos do buyer
- `apps/web/src/lib/password-policy.ts`
- `apps/web/src/lib/auth-client.ts`
- componentes visuais ja usados em auth e dashboard

---

## 14. Fluxo esperado

1. Usuario autenticado abre o menu do avatar.
2. Usuario clica em `Minha Conta`.
3. App navega para ` /conta `.
4. ` /conta ` redireciona para ` /conta/perfil `.
5. O layout monta as tabs permitidas para o role.
6. Buyer acessa `Enderecos` dentro da mesma area.
7. Qualquer role acessa `Seguranca` para trocar senha.
8. Producer ve em `Perfil` o resumo pessoal e o atalho para `Minha Fazenda`.

---

## 15. Casos de borda

- buyer abre link legado ` /dashboard/perfil ` e deve cair em ` /conta/enderecos `
- producer tenta acessar ` /conta/enderecos ` e recebe redirect para ` /conta/perfil `
- admin idem
- sessao antiga tenta trocar senha e recebe `SESSION_NOT_FRESH`
- perfil tenta editar email e isso nao deve ser oferecido na UI v1

---

## 16. Plano de testes

### 16.1 Navbar

- dropdown desktop mostra `Minha Conta`
- bloco mobile mostra `Minha Conta`
- `Meus Enderecos` deixa de existir como atalho isolado

### 16.2 Conta por role

- buyer ve `Perfil`, `Enderecos`, `Seguranca`
- producer ve `Perfil`, `Seguranca`
- admin ve `Perfil`, `Seguranca`
- role sem permissao para ` /conta/enderecos ` e redirecionado

### 16.3 Redirect legado

- ` /dashboard/perfil ` redireciona corretamente

### 16.4 Perfil

- submit do nome envia payload esperado
- email aparece em read-only

### 16.5 Seguranca

- validacao local
- envio correto de `changePassword`
- mapeamento de erros conhecidos
- hardening do gateway

---

## 17. Ordem de execucao recomendada

### Slice 1 - Container de conta

- criar ` /conta `
- criar layout shell compartilhado
- configurar redirecionamento inicial para ` /conta/perfil `

### Slice 2 - Refatorar navbar

- trocar `Meus Enderecos` por `Minha Conta`
- alinhar desktop e mobile ao mesmo conceito

### Slice 3 - Migrar enderecos do buyer

- mover experiencia atual para ` /conta/enderecos `
- adicionar redirect legado

### Slice 4 - Criar perfil

- implementar ` /conta/perfil `
- editar nome e exibir dados de conta
- bloco de CTA para `Minha Fazenda` no producer

### Slice 5 - Criar seguranca

- implementar ` /conta/seguranca `
- integrar `changePassword`

### Slice 6 - Endurecer gateway

- rate limit para ` /change-password `
- sanitizacao de `token`

### Slice 7 - Testes e verificacao

- unitarios
- integracao
- E2E

---

## 18. Riscos e mitigacoes

### Risco 1 - Escopo crescer demais

**Mitigacao:** manter a refatoracao focada no menu pessoal e na area `Minha Conta`, sem redesenhar toda a navegacao principal.

### Risco 2 - Misturar conta e operacao do produtor

**Mitigacao:** manter `Minha Fazenda` fora de `Minha Conta` e documentar isso explicitamente.

### Risco 3 - Perfil prometer dados que o backend nao suporta

**Mitigacao:** limitar a edicao v1 a campos suportados por `update-user`.

### Risco 4 - Regressao no fluxo atual do buyer

**Mitigacao:** reaproveitar a tela existente e manter redirect legado.

### Risco 5 - Seguranca da troca de senha ficar incompleta

**Mitigacao:** preservar no SDD o hardening do gateway e o tratamento explicito de sessao sensivel.

---

## 19. Criterios de aceite

- existe uma entrada unica `Minha Conta` no menu pessoal desktop e mobile
- buyer nao depende mais de um item isolado `Meus Enderecos` na navbar
- existe um container ` /conta ` compartilhado
- ` /conta/perfil ` existe para todos os usuarios autenticados
- ` /conta/enderecos ` existe apenas para buyer
- ` /conta/seguranca ` existe para todos os usuarios autenticados
- ` /dashboard/perfil ` redireciona para a nova estrutura
- producer continua gerenciando operacao em `Minha Fazenda`
- troca de senha usa o endpoint nativo do Better Auth com hardening no gateway

---

## 20. Premissa adotada neste SDD

Este SDD assume que a entrega correta nao e "adicionar uma tela de senha", mas sim **corrigir a arquitetura de conta do produto** e encaixar a seguranca dentro dela.

Em resumo:

- sim, a reformulacao entra neste SDD
- a troca de senha continua no escopo
- mas agora como parte de uma iniciativa maior e mais bem desenhada: `Minha Conta + navbar pessoal`
