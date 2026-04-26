# SDD - Polimento visual de Minha Conta

**Goal:** elevar a experiencia visual de `Minha Conta` para um padrao premium, rapido e responsivo, removendo linguagem interna e reduzindo o aspecto utilitario atual sem alterar a arquitetura funcional da area.

**Architecture:** o contrato funcional de ` /conta ` permanece igual ao definido nos documentos anteriores. Este SDD atua somente sobre apresentacao, microcopy, hierarquia visual, navegacao interna e responsividade. O redesign preserva as rotas, os roles, os formularios e as mutacoes existentes, mas troca a experiencia de "painel tecnico" por uma experiencia de conta pessoal mais limpa, confiavel e orientada ao usuario.

**Tech Stack:** Next.js 16 App Router, React 19, `@frescari/ui`, Tailwind utilities existentes, `sonner`, tRPC e Better Auth.

**Execution Note:** este documento complementa `docs/plans/2026-04-09-change-password-authenticated-user-sdd.md` e `docs/plans/2026-04-09-minha-conta-navbar-360-implementation-plan.md`. Eles continuam sendo a fonte de verdade para rotas, ownership de dados, role gating e seguranca. Este SDD trata apenas da camada visual e de UX da area `Minha Conta`.

---

## 1. Resumo do problema

A nova area `Minha Conta` ja resolveu a arquitetura de navegacao, mas a experiencia ainda parece interna demais.

Hoje a UI ainda transmite:

- linguagem de implementacao em vez de linguagem de produto
- excesso de cards explicativos e paines laterais
- cabecalhos grandes com pouco refinamento emocional
- hierarquia visual parecida com dashboard tecnico, nao com area pessoal
- comportamento responsivo correto, mas sem elegancia mobile-first

O resultado e uma area funcional, porem ainda distante do nivel premium ja perseguido em catalogo, autenticacao e componentes compartilhados.

---

## 2. O que esta tornando a UI "interna"

Os arquivos atuais de `Minha Conta` ainda expoem conceitos que fazem sentido para o time, nao para o usuario:

- `tenant`
- `role`
- `escopo desta fase`
- `persistencia via account.updateRegistration`
- `atualizacao autenticada`
- explicacoes sobre limites tecnicos do backend quando isso nao ajuda a concluir a tarefa

Esse tipo de copy produz tres efeitos negativos:

1. reduz sensacao de acabamento
2. aumenta carga cognitiva
3. faz a pagina parecer uma tela de homologacao, nao um produto final

---

## 3. Objetivo de design

Transformar `Minha Conta` em uma superficie com cara de produto pronto:

- mais pessoal
- mais silenciosa
- mais clara
- mais elegante
- mais rapida de percorrer
- mais responsiva em telas pequenas

O usuario deve sentir:

- "aqui eu administro meus dados"
- nao "aqui eu vejo como o sistema foi implementado"

---

## 4. Direcao estetica

### 4.1 Nome da direcao

**Quiet Premium Account**

Uma leitura mais refinada da identidade Frescari:

- tons naturais e sofisticados
- tipografia forte, mas menos gritante
- superficies leves
- densidade reduzida
- foco em clareza, confianca e calma

### 4.2 O que preservar

- paleta principal da marca (`cream`, `soil`, `forest`, `sage`)
- tipografia de display ja existente
- linguagem de superficies premium ja evoluida em outras areas
- foco em acessibilidade e foco visivel

### 4.3 O que evitar

- visual de dashboard administrativo
- excesso de bordas e caixas dentro de caixas
- explicacoes tecnicas longas
- badges e blocos informativos sem relevancia para a decisao do usuario
- sidebars pesadas em mobile

### 4.4 Ancora de diferenciacao

Se a tela for capturada em screenshot sem logo, ela ainda deve parecer:

- mais proxima de uma area de conta premium de marca confiavel
- menos parecida com um CRUD interno ou um backoffice generico

---

## 5. Escopo

### 5.1 Dentro do escopo

- redesign visual do shell de `Minha Conta`
- limpeza total da microcopy interna
- revisao de rotulos de navegacao interna
- nova hierarquia de cabecalho e subtitulos
- refinamento de formularios de `Perfil`, `Cadastro`, `Seguranca` e `Enderecos`
- contrato responsivo desktop/tablet/mobile
- refinamento de estados de erro, sucesso, vazio e carregamento

### 5.2 Fora do escopo

- alterar regras de acesso por role
- mudar contratos tRPC ou Better Auth
- adicionar campos novos
- alterar ownership entre `user`, `tenant`, `addresses` ou auth
- mover `Minha Fazenda` para dentro de `Minha Conta`
- redesenhar a navbar principal fora do necessario para coerencia visual local

---

## 6. Principios de UX

### 6.1 Linguagem de produto, nao linguagem de sistema

A UI deve falar sobre:

- perfil
- empresa
- negocio
- enderecos
- seguranca

Ela nao deve falar sobre:

- ownership interno
- estrutura tecnica
- nomes de mutacoes
- limitacoes temporarias sem contexto

### 6.2 Menos explicacao, mais orientacao

Cada pagina deve ter:

- um titulo claro
- uma linha curta de contexto
- o formulario ou conteudo principal logo em seguida

Nao deve haver multiplos blocos ensinando ao usuario o que a engenharia ja sabe.

### 6.3 Uma superficie principal por pagina

Cada secao deve ter um "bloco principal" dominante.

Suportes secundarios podem existir, mas com papel claro:

- alerta
- contexto
- ajuda curta

Nao como decoracao repetitiva.

### 6.4 Mobile first de verdade

No mobile, `Minha Conta` precisa parecer pensada para toque:

- navegacao local simples
- zero sidebar fixa
- formularios em coluna unica
- espacamento generoso
- CTAs sempre visiveis no fluxo

### 6.5 Calma visual

A pagina deve reduzir ruido:

- menos contrastes concorrentes
- menos caixas com peso igual
- menos textos auxiliares repetidos
- menos labels longas em uppercase sem necessidade

---

## 7. Novo contrato visual do shell

### 7.1 Cabecalho da area

O cabecalho atual deve deixar de ser um "hero de sistema" e virar um cabecalho de conta mais limpo.

Novo comportamento:

- label superior pequena: `Minha Conta`
- titulo direto e humano, por exemplo:
  - `Seus dados e preferencias`
  - `Gerencie sua conta`
- subtitulo curto, sem mencionar implementacao
- nome do usuario, se exibido, como detalhe discreto e nao como destaque funcional

### 7.2 Navegacao interna

Desktop:

- navegacao lateral compacta, leve e sticky
- visual de lista premium ou pills verticais
- menos caixa pesada ao redor
- destaque ativo claro, sem parecer botao de admin panel

Mobile:

- substituir a barra lateral por navegacao horizontal scrollavel no topo do conteudo
- tabs/pills com alvo de toque confortavel
- sem ocupar largura com um painel separado

### 7.3 Container de conteudo

O painel principal deve:

- ter mais respiro
- reduzir nesting de cards
- priorizar um fluxo de leitura vertical
- parecer uma "conta pessoal premium", nao uma grade tecnica

---

## 8. Novo contrato de rotulos e copy

### 8.1 Navegacao interna por role

Buyer:

- `Perfil`
- `Empresa`
- `Enderecos`
- `Seguranca`

Producer:

- `Perfil`
- `Negocio`
- `Seguranca`

Admin:

- `Perfil`
- `Seguranca`

Observacao:

- as rotas podem continuar iguais
- a mudanca aqui e de label visual, nao necessariamente de URL

### 8.2 Termos a remover da UI

Remover completamente do texto visivel:

- `tenant`
- `role`
- `escopo desta fase`
- `persistencia`
- `updateRegistration`
- `autenticada`

### 8.3 Tom de voz

Tom recomendado:

- confiante
- claro
- discreto
- premium

Tom a evitar:

- burocratico
- tecnico
- autoexplicativo demais
- "documentacao de tela"

---

## 9. Direcao por secao

### 9.1 ` /conta/perfil `

Problema atual:

- a tela tem boa base, mas ainda explica demais o que ela nao faz
- o painel lateral ocupa espaco com texto tecnico e pouco valor
- a experiencia ainda parece um formulario administrativo

Direcao nova:

- header mais curto e mais humano
- card de identidade mais compacto e sofisticado
- foco em:
  - nome
  - email em leitura
  - avatar
- remover blocos como `Escopo desta fase`
- remover explicacoes sobre backend ou verificacao de email

O usuario deve entender em segundos:

- quem ele e na plataforma
- o que pode editar agora

### 9.2 ` /conta/cadastro `

Problema atual:

- a tela e a que mais expoe linguagem interna
- mistura conceitos tecnicos com labels de formulario
- buyer e producer compartilham uma estrutura que ainda soa como backoffice

Direcao nova:

Buyer:

- rotulo visual: `Empresa`
- texto voltado a dados do negocio comprador
- esconder qualquer referencia a `tenant`

Producer:

- rotulo visual: `Negocio`
- foco em nome publico, nome legal, documento e contato
- linguagem mais comercial e menos cadastral

Elementos a remover:

- `Escopo desta fase`
- `Persistencia via account.updateRegistration`
- `Perfil autenticado`
- qualquer bloco que fale para a pessoa como o dado e salvo

Elementos a manter:

- diferenca entre PF e PJ
- validacao clara
- hierarquia organizada do formulario

### 9.3 ` /conta/seguranca `

Problema atual:

- a tela esta funcional, mas ainda tem tom tecnico
- o card lateral com `01` e checklist parece onboarding interno
- a copy fala mais do fluxo de sessao do que do beneficio para o usuario

Direcao nova:

- foco em tranquilidade e confianca
- explicar em linguagem simples:
  - senha atual
  - nova senha
  - confirmacao
  - encerramento de outras sessoes
- substituir o bloco `01` por um card de seguranca mais elegante e menos mecanico
- tornar feedbacks mais polidos e menos utilitarios

### 9.4 ` /conta/enderecos `

Problema atual:

- e a secao visualmente mais madura, mas ainda conversa muito em termos de checkout/frete
- pode ganhar mais cara de "enderecos da conta"

Direcao nova:

- enquadrar a pagina primeiro como gerenciamento de enderecos
- deixar contexto de entrega e frete como apoio, nao como cabecalho dominante
- manter robustez funcional atual
- melhorar a relacao entre lista de enderecos e formulario no mobile

---

## 10. Contrato responsivo

### 10.1 Mobile - 360 a 767

- shell em coluna unica
- navegacao local horizontal scrollavel no topo
- cabecalho com titulo menor e mais direto
- zero grid com coluna lateral fixa
- formularios sempre em coluna unica
- cards com menos padding horizontal excessivo

### 10.2 Tablet - 768 a 1199

- opcionalmente manter navegacao horizontal
- formularios podem usar duas colunas apenas quando isso realmente reduz scroll
- suporte visual pode aparecer abaixo do conteudo principal, nao ao lado

### 10.3 Desktop - 1200+

- permitir rail lateral compacta e sticky
- conteudo principal com largura confortavel
- uso de duas colunas apenas quando a leitura continuar clara
- evitar que o lado esquerdo pareca um segundo bloco igualmente pesado

---

## 11. Motion, performance e acessibilidade

### 11.1 Motion

Usar animacao minima:

- hover states curtos
- transicoes de cor, sombra e transform apenas quando agregarem leitura
- nada de `transition-all`
- nada de animacoes decorativas constantes

### 11.2 Performance

O redesign nao deve:

- adicionar bibliotecas novas de animacao
- aumentar o numero de fetches
- transformar mais superficies em client components sem necessidade

### 11.3 Acessibilidade

Manter e reforcar:

- labels reais em todos os campos
- `aria-current` na navegacao interna
- `aria-live` para erro e sucesso
- contraste suficiente em pills, botoes e mensagens
- alvos de toque confortaveis no mobile

---

## 12. Arquitetura de codigo recomendada

### 12.1 Arquivos a revisar

- `apps/web/src/app/conta/account-shell.tsx`
- `apps/web/src/app/conta/account-sections.ts`
- `apps/web/src/app/conta/perfil/profile-form.tsx`
- `apps/web/src/app/conta/cadastro/registration-form.tsx`
- `apps/web/src/app/conta/seguranca/change-password-form.tsx`
- `apps/web/src/app/dashboard/perfil/profile-page-client.tsx`

### 12.2 Componentes compartilhados opcionais

Se o redesign ficar repetitivo, extrair:

- `account-page-header.tsx`
- `account-surface.tsx`
- `account-section-nav.tsx`
- `account-status-banner.tsx`

Objetivo:

- consolidar o visual premium da area
- reduzir repeticao de wrappers e estilos

---

## 13. Criterios de aceite

- nenhuma pagina de `Minha Conta` exibe termos internos como `tenant`, `role` ou nomes de mutacao
- a area passa a parecer uma superficie pessoal e premium, nao um CRUD tecnico
- a navegacao interna funciona com elegancia em mobile, sem sidebar fixa
- `Perfil`, `Empresa/Negocio`, `Enderecos` e `Seguranca` ficam visualmente coerentes entre si
- a hierarquia visual melhora sem alterar os contratos funcionais existentes
- estados de erro, sucesso, vazio e carregamento ficam mais refinados e menos utilitarios
- o redesign nao adiciona complexidade desnecessaria nem regressao de acessibilidade

---

## 14. Ordem recomendada de execucao

1. Refatorar o shell de `Minha Conta`
2. Ajustar labels e microcopy da navegacao interna
3. Polir `Perfil`
4. Polir `Cadastro` com foco em remover copy interna
5. Polir `Seguranca`
6. Ajustar `Enderecos` para a nova linguagem visual
7. Validar responsividade em 360, 768 e 1280+

---

## 15. Decisao central deste SDD

Esta iniciativa nao e uma refacao funcional.

Ela e um **polimento de produto**:

- menos sistema
- mais conta pessoal
- menos explicacao interna
- mais clareza
- menos peso visual
- mais qualidade percebida

Em resumo:

- a arquitetura atual continua
- a experiencia visual sobe de nivel
- `Minha Conta` passa a parecer uma area pronta para producao, nao uma fase em construcao
