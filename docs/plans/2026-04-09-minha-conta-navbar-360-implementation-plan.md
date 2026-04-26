# Minha Conta + Navbar 360 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** implementar a reformulacao completa de `Minha Conta` e da navegacao pessoal do usuario com separacao clara entre perfil pessoal, cadastro organizacional, enderecos e seguranca, reduzindo ambiguidade de ownership e eliminando caminhos legados confusos na navbar.

**Architecture:** a experiencia passa a ter uma superficie compartilhada em ` /conta ` com navegacao interna role-aware. O dominio de dados fica dividido em quatro blocos estaveis: `perfil` persiste em `user`, `cadastro` persiste em `tenant`, `enderecos` persiste em `addresses`, e `seguranca` conversa com Better Auth. A navbar deixa de expor entradas isoladas como `Meus Enderecos` e passa a expor uma unica entrada semantica `Minha Conta`. `Minha Fazenda` continua fora dessa superficie e permanece sendo area operacional.

**Tech Stack:** Next.js 16 App Router, React 19, tRPC, Better Auth 1.6.1, Drizzle ORM, `@frescari/ui`, Node.js test runner com JSDOM, Playwright, pnpm workspace.

---

## 1. Project Context to Preserve

1. O SDD base desta iniciativa e `docs/plans/2026-04-09-change-password-authenticated-user-sdd.md`.
2. Buyer hoje usa ` /dashboard/perfil ` como pagina de enderecos; essa experiencia deve continuar funcionando durante a transicao.
3. O schema atual ja contem os campos necessarios para separar:
   - dados pessoais em `users`
   - dados cadastrais de produtor em `tenants`
   - enderecos de entrega em `addresses`
4. Esta fase nao deve criar migration nem alterar contrato estrutural do banco.
5. Esta fase nao deve incluir:
   - troca de email
   - MFA
   - gerenciamento de sessoes
   - reforma visual ampla fora do escopo de `Minha Conta` e menu pessoal
6. `Minha Fazenda` e qualquer fluxo operacional de produtor permanecem fora de ` /conta `.

## 2. Persistence Contract

### 2.1 Perfil pessoal

- Ownership: `users`
- Campos desta fase:
  - `name`
  - `image` ou avatar, se a superficie ja suportar isso sem ampliar escopo
- Campos explicitamente fora:
  - `email`
  - `role`
  - `tenantId`

### 2.2 Cadastro

- Ownership: `tenants`
- Buyer:
  - nesta fase, a tela existe e consome o read model comum, mas so expoe informacoes que facam sentido sem inventar novos campos
- Producer:
  - `producerLegalEntityType`
  - `producerDocumentId`
  - `producerLegalName`
  - `producerContactName`
  - `producerPhone`
- Admin:
  - acessa a estrutura de conta, mas nao ganha formulario de cadastro organizacional se nao houver semantica clara

### 2.3 Enderecos

- Ownership: `addresses`
- Disponivel apenas para buyer
- A UI rica existente em ` /dashboard/perfil ` deve ser reaproveitada, sem reescrever o fluxo inteiro na mesma task

### 2.4 Seguranca

- Ownership: Better Auth
- Operacao principal:
  - `authClient.changePassword(...)`
- Gateway server-side:
  - endurecer `POST /change-password` no wrapper `apps/web/src/app/api/auth/[...all]/route.ts`

## 3. Navigation Contract

### 3.1 Entrada global

- O menu pessoal desktop e mobile deve expor `Minha Conta`
- `Minha Conta` deve apontar para ` /conta `
- O destino real de ` /conta ` deve ser resolvido por role:
  - buyer -> ` /conta/perfil `
  - producer -> ` /conta/perfil `
  - admin -> ` /conta/perfil `

### 3.2 Secoes por role

- Buyer:
  - `Perfil`
  - `Cadastro`
  - `Enderecos`
  - `Seguranca`
- Producer:
  - `Perfil`
  - `Cadastro`
  - `Seguranca`
- Admin:
  - `Perfil`
  - `Seguranca`

### 3.3 Regras de legado

- ` /dashboard/perfil ` nao deve quebrar.
- Durante esta fase, ` /dashboard/perfil ` deve redirecionar para ` /conta/enderecos `.
- Nao manter dois fluxos ativos com comportamentos divergentes.

## 4. Assumptions and Decisions

1. O componente de navegacao interna de conta sera um shell simples baseado em `Link`, nao um tabs customizado novo, porque `@frescari/ui` nao expoe um primitive de tabs pronto no contexto analisado.
2. O read model de conta deve nascer em `packages/api/src/routers/account.ts` para evitar que a UI monte estado espalhado em varios routers.
3. A task de `enderecos` deve reaproveitar o client atual de buyer em vez de mover logica demais de uma vez.
4. Validacao de documento e telefone deve reutilizar o que ja existe em onboarding sempre que possivel, para impedir duplicacao silenciosa de regra.
5. Se algum campo de buyer para `cadastro` nao tiver semantica clara no banco atual, a tela deve mostrar somente o que for suportado e deixar claro no codigo que a extensao de schema e futura, em vez de improvisar persistencia incorreta.

## 5. Guardrails For Any Implementing Agent

1. Nao alterar schema do banco nesta fase.
2. Nao mover `Minha Fazenda` para dentro de ` /conta `.
3. Nao adicionar novos routers sem antes verificar se o `accountRouter` pode agregar o caso.
4. Nao duplicar regra de validacao de documento e telefone se `onboarding.ts` e `producer-profile.ts` ja cobrirem a normalizacao.
5. Nao substituir a UI inteira de enderecos; reaproveitar o fluxo existente.
6. Nao marcar task como concluida sem executar o comando de verificacao definido nela.

## 6. Relevant Skills During Execution

- `writing-plans`
- `executing-plans`
- `test-driven-development`
- `verification-before-completion`
- `react-patterns`
- `typescript-pro`

## 7. Atomic Execution Order

1. Definir contrato central de secoes, role gating e redirects.
2. Criar shell compartilhado de ` /conta `.
3. Refatorar navbar para usar o contrato central.
4. Migrar a experiencia de enderecos e fechar o caminho legado.
5. Criar `accountRouter` com read model estavel.
6. Adicionar mutacoes e validacoes de `cadastro`.
7. Implementar ` /conta/perfil `.
8. Implementar ` /conta/cadastro `.
9. Implementar ` /conta/seguranca ` e endurecer gateway.
10. Cobrir navegacao e fluxos criticos com testes finais.

## 8. Detailed Tasks

### Task 1. Centralize section rules, role gating, and redirects

**Objective:** criar uma unica fonte de verdade para quais secoes existem em `Minha Conta`, quem pode ver cada secao e qual e o landing path por role.

**Files to create:**

- `apps/web/src/app/conta/account-sections.ts`
- `apps/web/src/app/conta/account-sections.test.ts`

**Files to update:** nenhum.

**Implementation steps:**

1. Criar um modulo puro com tipos estaveis para `AccountSectionKey`, `AccountSectionDefinition` e funcoes auxiliares.
2. Declarar as secoes base:
   - `perfil`
   - `cadastro`
   - `enderecos`
   - `seguranca`
3. Declarar helpers puros:
   - `getAccountSectionsForRole(role)`
   - `getDefaultAccountPathForRole(role)`
   - `canAccessAccountSection(role, section)`
4. Garantir que:
   - buyer recebe `enderecos`
   - producer nao recebe `enderecos`
   - admin nao recebe `cadastro` se nao houver semantica valida
5. Cobrir testes de tabela para cada role.

**Definition of done:**

- Nenhuma regra de role para `Minha Conta` precisa ficar hardcoded na navbar ou nas paginas.
- Existe uma API pura e testada para resolver landing path e secoes visiveis.

**Verification commands:**

- `pnpm --filter web test -- account-sections.test.ts`
- `pnpm --filter web typecheck`

### Task 2. Create the shared ` /conta ` shell and route scaffold

**Objective:** criar a estrutura de layout compartilhada da area de conta para que todas as subrotas usem o mesmo container, a mesma navegacao local e a mesma logica de acesso.

**Files to create:**

- `apps/web/src/app/conta/account-shell.tsx`
- `apps/web/src/app/conta/account-shell.test.tsx`
- `apps/web/src/app/conta/layout.tsx`
- `apps/web/src/app/conta/page.tsx`
- `apps/web/src/app/conta/perfil/page.tsx`
- `apps/web/src/app/conta/cadastro/page.tsx`
- `apps/web/src/app/conta/enderecos/page.tsx`
- `apps/web/src/app/conta/seguranca/page.tsx`

**Files to update:** nenhum.

**Implementation steps:**

1. Criar `account-shell.tsx` como componente server ou client somente se necessario para hooks; preferir server shell com children.
2. Consumir `account-sections.ts` para renderizar navegacao lateral ou horizontal sem reimplementar regras.
3. Criar `layout.tsx` para envelopar todas as subrotas em um shell unico.
4. Criar `page.tsx` de ` /conta ` com redirect para `getDefaultAccountPathForRole(role)`.
5. Criar as quatro pages iniciais:
   - `perfil`
   - `cadastro`
   - `enderecos`
   - `seguranca`
6. Nesta task, as pages podem ser placeholders minimos, mas precisam respeitar:
   - controle de acesso por role
   - titulo consistente
   - integracao com o shell
7. Se o usuario tentar acessar uma secao proibida por role, redirecionar para o landing path valido da conta, nao retornar UI quebrada.

**Definition of done:**

- A arvore ` /conta ` existe e renderiza com shell compartilhado.
- ` /conta ` resolve para a subrota correta por role.
- Secoes proibidas por role nao ficam acessiveis por URL direta.

**Verification commands:**

- `pnpm --filter web test -- account-shell.test.tsx`
- `pnpm --filter web typecheck`

### Task 3. Refactor the personal navbar menu to use the new contract

**Objective:** substituir a entrada legacy `Meus Enderecos` por `Minha Conta` sem deixar branchs soltas entre menu desktop e mobile.

**Files to create:**

- `apps/web/src/components/global-nav.model.ts`
- `apps/web/src/components/global-nav.model.test.ts`

**Files to update:**

- `apps/web/src/components/global-nav.tsx`

**Implementation steps:**

1. Extrair a modelagem do menu pessoal para um modulo puro, deixando a view em `global-nav.tsx` mais declarativa.
2. Criar helper puro que receba a sessao ou role atual e devolva as entradas do menu pessoal.
3. Garantir que:
   - desktop e mobile consomem a mesma fonte de verdade
   - `Minha Conta` sempre aparece para usuario autenticado
   - `Sair` continua como ultima acao
   - `Meus Enderecos` deixa de existir como entrada isolada
4. Atualizar `global-nav.tsx` sem mexer na navegacao operacional principal.
5. Cobrir testes da model com foco em regressao de role e rotas.

**Definition of done:**

- Desktop e mobile usam o mesmo contrato para o menu pessoal.
- Nenhum branch visual antigo aponta mais para ` /dashboard/perfil ` diretamente.

**Verification commands:**

- `pnpm --filter web test -- global-nav.model.test.ts`
- `pnpm --filter web typecheck`

### Task 4. Migrate buyer addresses into ` /conta/enderecos ` and preserve legacy compatibility

**Objective:** reaproveitar a experiencia real de enderecos do buyer dentro da nova IA sem reescrever o fluxo inteiro.

**Files to update:**

- `apps/web/src/app/conta/enderecos/page.tsx`
- `apps/web/src/app/dashboard/perfil/page.tsx`
- `apps/web/src/app/dashboard/perfil/profile-page-client.tsx`

**Files to create:** nenhum obrigatorio, salvo se um wrapper pequeno for necessario.

**Implementation steps:**

1. Inspecionar `profile-page-client.tsx` e confirmar se ele pode ser reutilizado sem acoplamento forte ao path legado.
2. Fazer ` /conta/enderecos ` renderizar esse fluxo existente.
3. Transformar ` /dashboard/perfil ` em redirect explicito para ` /conta/enderecos `.
4. Garantir que somente buyer acessa ` /conta/enderecos `.
5. Se houver breadcrumb, titulo ou copy com nome legado incorreto, corrigir para refletir `Minha Conta`.
6. Nao mover queries tRPC desta task para outro lugar alem do necessario para o reuso.

**Definition of done:**

- O fluxo real de enderecos passa a viver semanticamente em ` /conta/enderecos `.
- O caminho legado continua funcional, mas apenas como redirect.

**Verification commands:**

- `pnpm --filter web test`
- `pnpm --filter web typecheck`

### Task 5. Create `accountRouter` and a stable account read model

**Objective:** agregar os dados necessarios da area de conta em um router proprio para evitar montagem fragmentada no frontend.

**Files to create:**

- `packages/api/src/routers/account.ts`
- `packages/api/src/account.router.test.ts`

**Files to update:**

- `packages/api/src/root.ts`
- `packages/api/src/index.ts`

**Implementation steps:**

1. Criar `accountRouter` com `protectedProcedure`.
2. Adicionar um endpoint inicial de leitura, por exemplo `getOverview`, que retorne um payload estavel com:
   - dados de `user`
   - dados de `tenant` relevantes para conta
   - flags de role
   - capacidade de acessar `enderecos`
3. Evitar trazer dados operacionais de fazenda para esse payload.
4. Manter shape simples, previsivel e focado em consumo de UI.
5. Escrever teste de router caller cobrindo buyer, producer e admin.
6. Exportar o router no barrel e registrar em `root.ts`.

**Definition of done:**

- A UI consegue ler um unico payload inicial para montar `Minha Conta`.
- O router tem testes claros de role e shape basico.

**Verification commands:**

- `pnpm --filter @frescari/api test -- account.router.test.ts`
- `pnpm --filter @frescari/api typecheck`

### Task 6. Add `cadastro` validation helpers and write mutations in `accountRouter`

**Objective:** garantir que a escrita de dados cadastrais use validacao reutilizavel e ownership correto em `tenant`.

**Files to create:**

- `packages/api/src/utils/account-profile.ts`
- `packages/api/src/utils/account-profile.test.ts`

**Files to update:**

- `packages/api/src/routers/account.ts`

**Implementation steps:**

1. Extrair para `account-profile.ts` as regras de normalizacao e validacao realmente necessarias para `cadastro`.
2. Reutilizar utilitarios e convencoes ja existentes em:
   - `packages/api/src/routers/onboarding.ts`
   - `packages/api/src/utils/producer-profile.ts`
3. Evitar duplicar regex, parse e limpeza de documento ou telefone.
4. Adicionar mutation em `accountRouter` para atualizar cadastro do producer.
5. Se buyer nao tiver campos adicionais persistiveis nesta fase, retornar contrato consistente e manter mutation limitada ao que o banco suporta.
6. Cobrir testes unitarios do utilitario e testes de router para casos validos e invalidos.

**Definition of done:**

- Existe um helper reutilizavel para validacao de `cadastro`.
- `accountRouter` consegue atualizar os dados cadastrais validos sem escrever campos no owner errado.

**Verification commands:**

- `pnpm --filter @frescari/api test -- account-profile.test.ts`
- `pnpm --filter @frescari/api test -- account.router.test.ts`
- `pnpm --filter @frescari/api typecheck`

### Task 7. Build ` /conta/perfil ` on top of `user`

**Objective:** criar a tela de perfil pessoal focada em dados do usuario autenticado, sem misturar dados de organizacao ou endereco.

**Files to create:**

- `apps/web/src/app/conta/perfil/profile-form.tsx`
- `apps/web/src/app/conta/perfil/profile-form.test.tsx`

**Files to update:**

- `apps/web/src/app/conta/perfil/page.tsx`

**Implementation steps:**

1. Consumir `accountRouter.getOverview` para preencher o estado inicial da pagina.
2. Criar formulario com foco em campos de `user`.
3. Persistir usando o endpoint nativo de atualizacao suportado pelo auth layer para dados pessoais, nao via mutation arbitraria em `tenant`.
4. Tratar loading, erro e success state.
5. Tornar explicito na UI que email nao e editavel nesta fase, se ele aparecer.
6. Cobrir teste do formulario para submissao valida e renderizacao inicial.

**Definition of done:**

- ` /conta/perfil ` edita somente dados pessoais.
- Nenhum campo de organizacao ou endereco aparece misturado nessa tela.

**Verification commands:**

- `pnpm --filter web test -- profile-form.test.tsx`
- `pnpm --filter web typecheck`

### Task 8. Build ` /conta/cadastro ` on top of `tenant`

**Objective:** criar a tela que separa explicitamente os dados cadastrais/organizacionais dos dados pessoais.

**Files to create:**

- `apps/web/src/app/conta/cadastro/registration-form.tsx`
- `apps/web/src/app/conta/cadastro/registration-form.test.tsx`

**Files to update:**

- `apps/web/src/app/conta/cadastro/page.tsx`

**Implementation steps:**

1. Consumir `accountRouter.getOverview` para estado inicial.
2. Para producer, exibir e persistir os campos de cadastro existentes no schema.
3. Para buyer, exibir apenas a versao suportada pelo banco atual; se o contrato for somente leitura nesta fase, isso deve ser intencional e documentado no componente.
4. Para admin, bloquear ou simplificar a tela conforme o contrato definido em `account-sections.ts`.
5. Conectar submissao a `accountRouter` sem tocar em `users`.
6. Cobrir testes para:
   - render por role
   - submissao valida do producer
   - bloqueio de secao quando aplicavel

**Definition of done:**

- ` /conta/cadastro ` usa somente owner `tenant`.
- A separacao semantica entre `perfil` e `cadastro` fica evidente no codigo e na UI.

**Verification commands:**

- `pnpm --filter web test -- registration-form.test.tsx`
- `pnpm --filter web typecheck`
- `pnpm --filter @frescari/api test -- account.router.test.ts`

### Task 9. Build ` /conta/seguranca ` and harden authenticated password change

**Objective:** encaixar a troca de senha na nova area de conta e endurecer a borda server-side contra abuso e input malformado.

**Files to create:**

- `apps/web/src/app/conta/seguranca/change-password-form.tsx`
- `apps/web/src/app/conta/seguranca/change-password-form.test.tsx`

**Files to update:**

- `apps/web/src/app/conta/seguranca/page.tsx`
- `apps/web/src/app/api/auth/[...all]/route.ts`
- `apps/web/src/app/api/auth/[...all]/route.test.ts`

**Implementation steps:**

1. Criar formulario client-side para senha atual, nova senha e confirmacao.
2. Integrar com `authClient.changePassword(...)`.
3. Garantir feedback claro para:
   - senha atual incorreta
   - confirmacao divergente
   - erro generico
   - sucesso
4. Endurecer o wrapper server-side para `POST /change-password` com:
   - rate limiting
   - sanitizacao ou remocao defensiva de `token` no fluxo autenticado
   - rejeicao consistente de payload invalido
5. Cobrir testes de rota para casos de abuso e payload inesperado.
6. Cobrir teste do formulario para validacao client-side minima.

**Definition of done:**

- A troca de senha existe dentro de ` /conta/seguranca `.
- O endpoint autenticado fica mais resistente sem regressao funcional.

**Verification commands:**

- `pnpm --filter web test -- change-password-form.test.tsx`
- `pnpm --filter web test -- src/app/api/auth/[...all]/route.test.ts`
- `pnpm --filter web typecheck`

### Task 10. Add end-to-end coverage for navigation and critical account flows

**Objective:** provar que a nova IA funciona ponta a ponta e que nenhum caminho principal ficou quebrado por role.

**Files to create:**

- `apps/web/e2e/account-navigation.spec.ts`

**Files to update:** opcionalmente fixtures ou helpers de e2e, somente se estritamente necessario.

**Implementation steps:**

1. Criar spec Playwright cobrindo:
   - menu pessoal mostra `Minha Conta`
   - buyer navega para ` /conta ` e encontra as secoes corretas
   - producer nao encontra `Enderecos`
   - ` /dashboard/perfil ` redireciona para ` /conta/enderecos `
   - acesso proibido por role redireciona para secao valida
2. Reaproveitar fixtures existentes de autenticacao se o projeto ja tiver isso.
3. Nao introduzir acoplamento desnecessario de visual; focar em contrato de navegacao e fluxo.

**Definition of done:**

- Existe cobertura e2e do contrato principal de navegacao de conta.
- Regressao de role ou redirect passa a ser detectada automaticamente.

**Verification commands:**

- `pnpm --filter web test:e2e -- account-navigation.spec.ts`

## 9. Final Verification Matrix

Executar somente depois que todas as tasks anteriores estiverem verdes.

1. `pnpm --filter @frescari/api test`
2. `pnpm --filter @frescari/api typecheck`
3. `pnpm --filter web test`
4. `pnpm --filter web typecheck`
5. `pnpm --filter web test:e2e -- account-navigation.spec.ts`
6. `pnpm check`

## 10. Smoke Checklist Before Marking Complete

1. Buyer ve `Minha Conta` no menu pessoal e encontra `Perfil`, `Cadastro`, `Enderecos`, `Seguranca`.
2. Producer ve `Minha Conta` no menu pessoal e nao encontra `Enderecos`.
3. Admin ve `Minha Conta` no menu pessoal sem secao indevida de cadastro ou enderecos.
4. ` /conta ` sempre resolve para um destino valido.
5. ` /dashboard/perfil ` nao renderiza tela legacy divergente; ele redireciona.
6. `Perfil` escreve em `user`.
7. `Cadastro` escreve em `tenant`.
8. `Enderecos` continua escrevendo em `addresses`.
9. `Seguranca` usa Better Auth e passa pelo gateway endurecido.
10. Nenhuma migration foi criada para concluir esta fase.
