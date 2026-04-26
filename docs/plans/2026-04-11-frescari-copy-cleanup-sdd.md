# SDD - Sistema Verbal Frescari

**Goal:** criar um sistema editorial completo para a Frescari, removendo toda copy interna, placeholders e linguagem de bastidor das superficies visiveis, e substituindo esse material por uma voz unica, clara, comercial e fiel ao posicionamento do produto.

**Architecture:** contrato editorial transversal para o `apps/web`, com separacao entre linguagem de dominio interno e copy visivel, sustentado por tese de marca, pilares de voz, glossario, biblioteca de copy, governanca e validacao de regressao.

**Tech Stack:** Next.js App Router, TypeScript, tRPC, `@frescari/ui`, copy distribuida entre `app/`, `components/` e `lib/`, com documentos legais em `apps/web/src/lib/legal-documents.ts`.

**Execution Note:** este SDD regula texto visivel ao usuario. Ele nao pede renomear enums, tabelas, tipos ou contratos de API. O backend pode continuar tecnico. A interface nao.

## 1. Tese central

A Frescari nao pode soar como software interno. Ela precisa soar como mercado real.

O repositorio ja deixa claro qual e a verdade do produto:

- a Frescari e um marketplace de hortifruti direto do produtor;
- a proposta e conectar compradores a produtores com catalogo vivo e leitura rapida de oferta;
- o modelo e de "SaaS invisivel": o produtor quer vender mais, nao aprender um sistema complexo;
- a experiencia precisa carregar origem, oferta, ritmo de abastecimento, margem, lote, pedido e entrega;
- o software existe para organizar a operacao, mas nao deve aparecer como protagonista da linguagem.

Em outras palavras:

**o usuario deve sentir campo, oferta, compra e operacao comercial; nunca tenancy, setup, health, role ou placeholders.**

## 2. O que significa "copy perfeita para a Frescari"

Nao significa escrever bonito. Significa escrever certo para este negocio.

A copy perfeita para a Frescari:

- fala do mercado de hortifruti, nao do software pelo software;
- usa linguagem de compra, venda, oferta, lote, origem, entrega e abastecimento;
- faz o produtor sentir que a ferramenta ajuda a vender mais;
- faz o comprador sentir que a plataforma ajuda a comprar com mais clareza e agilidade;
- faz o admin operar com precisao sem expor nomenclatura de modelagem;
- sustenta confianca institucional e juridica sem placeholders ou improviso;
- mantem unidade verbal entre home, catalogo, auth, conta, dashboard, admin e documentos.

## 3. Verdades de produto extraidas do repositorio

Este SDD nao inventa uma marca do zero. Ele organiza o que o proprio projeto ja sugere como direcao correta.

### 3.1 Verdades encontradas na home

Em `apps/web/src/app/page.tsx`, a melhor direcao verbal atual aparece em expressoes como:

- `hortifruti direto do produtor`
- `catalogo vivo`
- `leitura rapida de oferta`
- `oferta regional`
- `ritmo real`
- `compra com linguagem comercial do hortifruti`
- `sem transformar o produtor em operador de software`

Isso aponta para uma marca que precisa soar:

- comercial;
- proxima da operacao real;
- regional e concreta;
- anti-burocratica;
- sofisticada sem parecer corporativa.

### 3.2 Verdades encontradas na documentacao estrategica

Em `README.md`, `docs/ARCHITECTURE.md` e `docs/guides/seo-and-growth-strategy.md`, surgem fundamentos importantes:

- marketplace B2B/B2C de hortifruti;
- camada digital que organiza a operacao;
- modelo de "SaaS invisivel";
- foco em vender mais;
- catalogos publicos e descoberta organica;
- menos friccao entre oferta, pedido e exposicao digital.

Esses fundamentos confirmam que a copy nao deve parecer:

- software generico;
- dashboard de ERP;
- painel de monitoramento abstrato;
- interface de administracao sem camada de marca.

## 4. Publicos e leitura verbal esperada

### 4.1 Comprador

Quem e:

- restaurante;
- varejo;
- distribuidor;
- operador de compras de FLV;
- negocio que compra com frequencia e precisa responder rapido.

O que ele quer sentir:

- oferta confiavel;
- leitura rapida do que esta disponivel;
- menos distancia entre origem e pedido;
- menos improviso de ultima hora;
- clareza de preco, unidade, contexto e procedencia.

### 4.2 Produtor

Quem e:

- produtor rural;
- fornecedor que quer expor lote e vender melhor;
- parceiro que nao quer virar usuario avancado de software.

O que ele quer sentir:

- a plataforma ajuda a vender mais;
- o trabalho digital nao criou burocracia nova;
- a operacao esta organizada;
- a oferta ficou apresentavel e comercial;
- a ferramenta trabalha a favor do negocio, nao contra o tempo dele.

### 4.3 Admin e operacao

Quem e:

- time interno;
- operador de catalogo;
- pessoa que acompanha pendencias, ativacao, pedidos e qualidade de base.

O que essa pessoa precisa:

- clareza;
- velocidade de leitura;
- linguagem objetiva;
- sinalizacao de prioridade;
- nomes que expliquem o problema sem expor o modelo tecnico.

Importante: admin pode ser mais direto, mas nao pode ser "linguagem de banco com UI em volta".

## 5. Sistema de voz da marca

### 5.1 Pilar 1 - Mercado real

A Frescari fala como quem entende abastecimento, oferta, lote e compra profissional.

Escrever assim:

- `oferta disponivel agora`
- `abastecimento`
- `origem por fazenda`
- `resposta rapida do produtor`
- `compra em ritmo profissional`

Nao escrever assim:

- `asset`
- `entidade`
- `objeto`
- `tenant`
- `instancia`
- `setup`

### 5.2 Pilar 2 - Clareza sem jargao

A interface precisa ser simples sem ser simploria.

Escrever assim:

- `cadastro pendente`
- `conta conectada pendente`
- `dados da fazenda incompletos`
- `lotes disponiveis agora`

Nao escrever assim:

- `needs setup`
- `health`
- `base operacional minima`
- `lotes vivos`

### 5.3 Pilar 3 - Comercial, nao corporativo

A Frescari precisa soar como negocio que gera venda e compra, nao como suite administrativa.

Escrever assim:

- `vender mais`
- `comprar com mais clareza`
- `organizar a oferta`
- `aproximar origem e pedido`

Nao escrever assim:

- `cockpit operacional`
- `analytics de vaidade`
- `torre de prontidao`
- `painel administrativo interno da operacao`

### 5.4 Pilar 4 - Sofisticacao sem frieza

A marca pode ser premium sem ser distante.

Escrever assim:

- `leitura rapida`
- `oferta confiavel`
- `camada operacional sem ruido`
- `catalogo vivo`

Nao escrever assim:

- `solucao robusta`
- `ecossistema omnichannel`
- `stack de performance`
- `framework de governanca`

### 5.5 Pilar 5 - Invisibilidade do software

O software existe, mas nao deve aparecer como personagem principal.

Escrever assim:

- `o produtor atualiza a oferta`
- `o catalogo fica pronto para descoberta`
- `mais ponte entre estoque disponivel, pedido e exposicao digital`

Nao escrever assim:

- `usuario completa onboarding do sistema`
- `tenant avanca no fluxo`
- `operador conclui setup da entidade`

## 6. Promessa verbal da Frescari

Se a marca precisasse caber em uma frase, a frase seria:

**A Frescari organiza a oferta do produtor e encurta a distancia entre origem e pedido.**

Promessas derivadas:

- para quem compra: oferta mais clara, mais proxima e mais facil de ler;
- para quem vende: uma operacao digital feita para vender mais, nao para aprender sistema;
- para a marca: hortifruti direto do produtor com linguagem comercial do setor.

## 7. Arquitetura da mensagem

Toda copy do produto deve derivar destas quatro mensagens-mestras:

### 7.1 Oferta viva

O que esta disponivel agora importa mais do que catalogo estatico.

### 7.2 Origem com contexto

O comprador precisa entender de onde vem, como vem e em que unidade compra.

### 7.3 Operacao sem ruido

O produtor precisa organizar lote, estoque e pedido sem virar operador de software.

### 7.4 Mercado local e resposta rapida

A Frescari valoriza abastecimento regional, logistica curta e velocidade comercial.

## 8. Glossario aprovado

### 8.1 Expressoes preferidas

| Contexto | Preferir |
| --- | --- |
| Posicionamento | marketplace B2B de hortifruti |
| Oferta | catalogo vivo |
| Venda do produtor | levar a producao para a Frescari |
| Descoberta | ver oferta disponivel |
| Compra | abastecer o negocio |
| Operacao | camada operacional |
| Contexto geografico | oferta regional |
| Valor de origem | direto do produtor |
| Ritmo | resposta rapida |
| Admin | leitura operacional |

### 8.2 Expressoes proibidas

| Categoria | Proibido |
| --- | --- |
| Dominio interno | tenant, tenants, role, health |
| Fluxo tecnico | setup, needs setup, onboarding quando for nome interno |
| Placeholder | qualquer token entre colchetes |
| Painel generico | cockpit operacional, analytics de vaidade |
| Mistura de idioma | Last Chance (Qty) |
| Rotulo cru | lotes vivos, produto desconhecido sem contexto |

## 9. Regras de escrita por tipo de superficie

### 9.1 Headlines

Devem:

- falar de resultado;
- usar substantivos concretos;
- evitar abstrações de software;
- soar como frase de negocio.

Bom:

- `Abasteca seu negocio com hortifruti direto do produtor`
- `Oferta regional para compra em ritmo profissional`
- `Organize sua venda sem complicar a operacao`

Ruim:

- `Painel operacional da plataforma`
- `Suite integrada de abastecimento`
- `Gestao multi-tenant de hortifruti`

### 9.2 CTAs

Devem:

- dizer o que a pessoa vai fazer;
- usar verbo concreto;
- carregar contexto comercial.

Bom:

- `Entrar no catalogo`
- `Ver oferta disponivel`
- `Levar minha producao para a Frescari`
- `Publicar lote`

Ruim:

- `Acessar painel`
- `Entrar no fluxo`
- `Criar tenant`
- `Executar setup`

### 9.3 Labels de metricas

Devem:

- nomear algo legivel por humano;
- refletir o negocio, nao a query.

Bom:

- `Lotes disponiveis agora`
- `Produtores com oferta ativa`
- `Pedidos que pedem atencao`
- `Pendencias do catalogo`

Ruim:

- `Lotes vivos`
- `Alertas de catalogo` se o que existe sao problemas de cadastro, imagem e vencimento;
- `GMV na janela` sem contexto adicional, quando a leitura pode ser mais humana em torno de `volume movimentado`.

### 9.4 Estados vazios

Devem:

- explicar o que esta faltando;
- indicar proximo passo;
- evitar tom de erro tecnico.

Bom:

- `Ainda nao ha lotes publicados para este produtor.`
- `Nenhum pedido pede atencao nesta leitura.`
- `Complete os dados da fazenda para liberar a operacao.`

Ruim:

- `Nenhuma entidade encontrada`
- `Nenhum tenant apareceu nesta leitura`
- `Objeto nao identificado`

### 9.5 Erros

Devem:

- assumir a responsabilidade da plataforma;
- dizer o que o usuario pode fazer agora.

Bom:

- `Nao conseguimos carregar esses dados agora. Tente novamente em instantes.`
- `Ainda nao foi possivel salvar sua alteracao. Revise os campos e tente de novo.`

Ruim:

- `Unexpected failure`
- `Request invalid`
- `Falha na operacao do tenant`

### 9.6 Admin

Admin pode ser seco e direto, mas precisa continuar humano.

Regra:

- falar em `produtor`, `comprador`, `conta`, `fazenda`, `catalogo`, `pedido`, `pendencia`, `ativacao`, `conta conectada`, `dado incompleto`;
- nunca falar em `tenant`, `role`, `health`, `setup`, `base operacional minima`.

### 9.7 Juridico

Juridico nao precisa soar poetico. Precisa soar completo, serio e final.

Regra:

- zero placeholders;
- zero dados internos pendentes;
- zero metadados de rascunho;
- linguagem precisa e institucional.

## 10. Diagnostico do repositorio

### 10.1 Prioridade critica

**`apps/web/src/lib/legal-documents.ts`**

Problema:

- placeholders juridicos;
- dependencia de informacao institucional ainda nao consolidada na propria origem textual.

Impacto:

- quebra de confianca;
- documento final com cara de rascunho;
- incompatibilidade com a barra de qualidade da marca.

**`apps/web/src/app/admin/usuarios/tenant-operations-client.tsx`**

Problema:

- vazamento direto de termos internos;
- foco excessivo no modelo tecnico;
- copy parcialmente em tom de bastidor.

Impacto:

- a interface denuncia a arquitetura;
- a marca some atras do dominio interno.

### 10.2 Prioridade alta

**`apps/web/src/app/admin/admin-overview.tsx`**

Problema:

- linguagem de cockpit;
- enquadramento muito interno;
- rotulos operacionais com pouca camada de marca.

**`apps/web/src/app/dashboard/dashboard-client.tsx`**

Problema:

- labels genericos;
- mistura de idioma;
- pouca sofisticacao comercial para a area do produtor.

### 10.3 Prioridade media

**`apps/web/src/app/conta/cadastro/registration-form.tsx`**

Problema:

- funcional, mas neutro demais;
- correto, porem sem assinatura verbal forte da Frescari.

**`apps/web/src/app/auth/*`, `apps/web/src/app/page.tsx`, `apps/web/src/app/catalogo/page.tsx`**

Problema:

- necessidade de harmonizacao;
- ja estao perto da direcao certa, mas ainda sem um sistema editorial formalizado.

## 11. Matriz de reescrita por superficie

### `apps/web/src/lib/legal-documents.ts`

- objetivo: sair de placeholders para institucionalidade final;
- nova voz: juridica, precisa, completa e definitiva;
- criterio: nenhum colchete, nenhum dado temporario, nenhuma dependencia editorial aberta.

### `apps/web/src/app/admin/usuarios/tenant-operations-client.tsx`

- objetivo: tirar a arquitetura da frente e trazer a operacao real para a frente;
- nova voz: leitura operacional clara, com foco em produtor, comprador, cadastro, fazenda e conta conectada;
- criterio: nenhum termo de tenancy na UI.

### `apps/web/src/app/admin/admin-overview.tsx`

- objetivo: trocar o painel de bastidor por visao geral da operacao Frescari;
- nova voz: forte, objetiva, comercial e util;
- criterio: cada card deve soar como decisao de negocio, nao como log de sistema.

### `apps/web/src/app/dashboard/dashboard-client.tsx`

- objetivo: fazer o produtor sentir acompanhamento comercial, nao apenas monitoramento;
- nova voz: oferta, giro, entrega, oportunidade, saldo, resposta;
- criterio: remover labels genericos e qualquer ingles sobrando.

### `apps/web/src/app/conta/cadastro/registration-form.tsx`

- objetivo: elevar a experiencia de conta;
- nova voz: orientadora, calma e confiante;
- criterio: clareza total sem linguagem fria.

### `apps/web/src/app/auth/*`

- objetivo: fazer login e cadastro soarem como porta de entrada da marca;
- nova voz: direta, acolhedora e profissional;
- criterio: nada de copy de SaaS generico.

### `apps/web/src/app/page.tsx` e `apps/web/src/app/catalogo/page.tsx`

- objetivo: consolidar a melhor voz que o projeto ja ensaia;
- nova voz: marketplace de hortifruti com operacao inteligente e comercial;
- criterio: consistencia fina entre promessa, CTA e linguagem de descoberta.

## 12. Exemplos de antes e depois

Os exemplos abaixo nao sao decorativos. Eles definem o tipo de transformacao esperada.

| Antes | Depois proposto | Motivo |
| --- | --- | --- |
| `Operacao admin em uma tela.` | `Visao geral da operacao Frescari.` | menos painel generico, mais identidade |
| `Produtores em setup` | `Produtores com cadastro pendente` | remove jargao interno |
| `Tenants que ainda nao chegaram na base operacional minima` | `Parceiros que ainda nao estao prontos para operar` | traduz o conceito para negocio |
| `Lotes vivos` | `Lotes disponiveis agora` | linguagem humana e comercial |
| `Last Chance (Qty)` | `Ultimo saldo` ou `ultimas unidades` | remove ingles e fica mais claro |
| `Painel do Produtor` | `Sua operacao na Frescari` ou `Visao da sua oferta` | menos genrico, mais marca |
| `Produto Desconhecido` | `Item sem identificacao` ou `Produto sem cadastro completo` | contexto operacional real |
| `Needs setup` | `Configuracao inicial pendente` ou `Cadastro inicial pendente` | remove ingles tecnico |
| `Nenhum produtor esta travado na etapa de onboarding.` | `Todos os produtores desta leitura ja avancaram na ativacao inicial.` | mais humano, menos processo interno |
| `Painel administrativo interno da operacao Frescari.` | `Area interna para acompanhar catalogo, pedidos e pendencias da operacao.` | menos seco e menos autoexplicacao corporativa |

## 13. Biblioteca inicial de copy aprovada

Esta biblioteca serve como norte para implementacao e revisao.

### 13.1 Posicionamento principal

- `Marketplace B2B de hortifruti direto do produtor.`
- `Catalogo vivo para quem compra em ritmo profissional.`
- `Oferta regional com leitura rapida e operacao sem ruido.`

### 13.2 Frases para quem compra

- `Abasteca seu negocio com mais clareza entre origem, unidade e preco.`
- `Veja a oferta disponivel agora e compre mais perto da operacao real.`
- `Menos distancia entre o que voce precisa e a resposta do produtor.`

### 13.3 Frases para quem vende

- `Leve sua producao para uma operacao digital feita para vender mais.`
- `Organize catalogo, lote e pedido sem virar refem de software.`
- `Sua oferta pronta para descoberta, consulta e negociacao com menos friccao.`

### 13.4 Frases para admin

- `Pedidos que pedem atencao`
- `Pendencias de ativacao`
- `Contas conectadas pendentes`
- `Dados de fazenda incompletos`
- `Pendencias do catalogo`

### 13.5 CTA library

- `Entrar no catalogo`
- `Ver oferta disponivel`
- `Levar minha producao para a Frescari`
- `Publicar lote`
- `Completar cadastro`
- `Revisar pendencias`

## 14. Decisao arquitetural

O projeto deve operar com duas camadas explicitas.

### 14.1 Camada de dominio interno

Serve ao codigo.

Pode conter:

- `tenantId`
- `role`
- `BUYER`
- `PRODUCER`
- `masterProduct`

### 14.2 Camada de copy visivel

Serve ao humano.

Deve:

- traduzir o dominio para linguagem de negocio;
- usar o glossario aprovado;
- bloquear vazamento de termos internos;
- preservar a voz da marca em qualquer superficie.

## 15. Governanca necessaria

Para a copy nao voltar a piorar, este trabalho precisa deixar lastro.

### 15.1 Fonte canonica de dados institucionais

Precisamos de origem unica para:

- razao social;
- CNPJ;
- endereco;
- email de suporte;
- email de privacidade;
- vigencia juridica.

### 15.2 Glossario versionado

O projeto deve manter um documento ou modulo editorial com:

- termos aprovados;
- termos proibidos;
- substituicoes orientadas por contexto;
- biblioteca de headlines, CTA, labels e estados.

### 15.3 Guardrail de regressao

Deve existir verificacao simples sobre strings visiveis para bloquear:

- `tenant`
- `tenants`
- `role`
- `health`
- `Needs setup`
- placeholders entre colchetes
- `Last Chance (Qty)`

Regra importante:

o guardrail precisa mirar copy visivel, nao nomes internos de implementacao.

### 15.4 Responsabilidade editorial

Para este sistema verbal funcionar em nivel enterprise, toda decisao de copy precisa ter dono claro.

Modelo recomendado:

- **Product/Founder:** aprova a promessa principal, tom da marca e mensagens-mestras;
- **Design/Product Design:** valida consistencia entre copy, hierarquia visual e UX;
- **Engineering:** implementa a copy na superficie correta sem vazar linguagem de dominio;
- **Legal/Operations:** aprova textos institucionais e juridicos;
- **QA editorial:** revisa clareza, consistencia e regressao antes de publicar.

Sem ownership, o texto volta a degradar.

### 15.5 Criticidade editorial

Nem toda copy tem o mesmo risco. O projeto deve classificar severidade:

- **Classe A:** juridico, termos, politicas, metadata institucional, checkout, pagamentos, dados de conta;
- **Classe B:** dashboard, admin, conta, auth, mensagens de erro;
- **Classe C:** marketing, apoio contextual, microcopy secundaria.

Regra:

- Classe A exige aprovacao institucional;
- Classe B exige aprovacao de produto/design;
- Classe C pode seguir fluxo normal de PR com checklist editorial.

### 15.6 Padrao de implementacao

Para evitar degradacao, a copy deve seguir um contrato tecnico:

- strings compartilhadas devem sair de constantes ou modulos de conteudo quando fizer sentido;
- textos juridicos devem vir de uma fonte canonica e auditavel;
- copy repetida em varias telas nao deve ser duplicada manualmente;
- labels internas nunca podem nascer de nomes de enum sem uma camada de traducao.

### 15.7 Lint editorial

Nivel enterprise pede prevencao, nao so revisao manual.

O projeto deve introduzir verificacoes como:

- denylist de termos proibidos em arquivos de UI;
- alerta para placeholders entre colchetes;
- alerta para mistura de ingles em copy primaria;
- alerta para uso de palavras tecnicas em labels visiveis.

## 16. Matriz de qualidade enterprise

Para este SDD operar em nivel alto, a copy precisa ser julgada por criterios objetivos.

### 16.1 Clareza

- a frase e entendida em uma leitura;
- nao exige conhecimento interno;
- nao usa abstração desnecessaria.

### 16.2 Precisao

- o texto descreve o estado real do negocio;
- o rótulo combina com a acao ou dado exibido;
- nao simplifica tanto a ponto de mentir.

### 16.3 Marca

- soa como Frescari;
- carrega o universo de mercado, oferta, origem, lote, compra e venda;
- evita tom generico de SaaS.

### 16.4 Elegancia

- a frase nao parece improvisada;
- o texto tem ritmo, sobriedade e boa hierarquia;
- nao ha excesso de palavras, nem secura mecanica.

### 16.5 Escalabilidade

- a regra de escrita pode ser reaplicada em outras superficies;
- a decisao nao depende de memoria informal;
- o texto pode ser governado, testado e revisado.

## 17. Biblioteca de transformacao suprema

Esta secao existe para reduzir subjetividade e elevar o padrao de execucao.

### 17.1 Principio de reescrita

Toda copy nova deve obedecer a esta formula:

**estado real do negocio + leitura humana + voz Frescari**

Exemplo:

- errado: `Produtores em setup`
- certo: `Produtores com cadastro pendente`

Porque:

- preserva o estado real;
- remove o jargao;
- continua objetivo.

### 17.2 Regra de traducao de dominio

Quando o backend falar em:

- `tenant` -> traduzir para `conta`, `parceiro`, `produtor` ou `comprador`, conforme contexto;
- `health` -> traduzir para `situacao`, `status da operacao` ou `pendencias`;
- `setup` -> traduzir para `cadastro inicial`, `ativacao inicial` ou `configuracao pendente`;
- `master product` -> traduzir para `catalogo base` ou `produto base`, se o conceito precisar existir na UI.

### 17.3 Regra de densidade

Copy de nivel alto nao pode ser:

- fria demais;
- prolixa demais;
- rebuscada demais.

Padrao:

- headline curta e forte;
- subtitulo explicativo;
- label ultra claro;
- estado vazio orientador;
- erro objetivo com proximo passo.

### 17.4 Regra de anti-regressao

Se um texto novo:

- parece ter vindo de nome de enum;
- parece ter sido escrito por quem conhece a query e nao o usuario;
- parece genrico o bastante para qualquer SaaS;
- parece rascunho interno;

entao ele falhou no padrao Frescari.

## 18. Plano de execucao

### Fase 1 - Fundacao editorial

Entregas:

- glossario Frescari;
- denylist de termos proibidos;
- biblioteca inicial de copy aprovada;
- definicao institucional canonica.

### Fase 2 - Saneamento P0

Entregas:

- `legal-documents.ts` sem placeholders;
- `tenant-operations-client.tsx` sem termos de tenancy na UI.

### Fase 3 - Reescrita operacional

Entregas:

- `admin-overview.tsx`;
- `dashboard-client.tsx`;
- rotulos, estados e metricas reescritos em voz Frescari.

### Fase 4 - Reescrita da jornada autenticada

Entregas:

- login;
- cadastro;
- conta;
- feedbacks e empty states.

### Fase 5 - Polimento publico

Entregas:

- home;
- catalogo;
- navegacao;
- metadata;
- consistencia de CTA e promessa.

### Fase 6 - Blindagem

Entregas:

- checklist editorial;
- validacao juridica;
- verificador de regressao;
- aprovacao final de marca.

## 19. Checklist de entrega enterprise

Antes de considerar qualquer superficie pronta, confirmar:

- a copy foi revisada contra o glossario aprovado;
- nenhum termo proibido ficou visivel;
- a tela soa como Frescari em leitura corrida;
- labels, CTA, erros e estados vazios conversam entre si;
- o texto nao esta apenas "menos ruim", mas realmente melhor;
- o texto ficou mais claro sem perder verdade operacional;
- a decisao pode ser defendida por criterio, e nao por gosto.

## 20. Definicao de pronto

Esta iniciativa so termina quando:

1. Nenhuma superficie visivel expuser linguagem interna sem traducao de negocio.
2. Nenhum documento legal contiver placeholder ou dado temporario.
3. A Frescari soar igual em home, catalogo, auth, conta, dashboard e admin.
4. O produtor se sentir ajudado a vender mais, nao obrigado a operar software.
5. O comprador sentir clareza de oferta, origem e compra profissional.
6. O admin operar com precisao sem ver termos de tenancy na interface.
7. Houver um mecanismo claro para impedir a volta da copy interna.

## 21. Limites honestos deste SDD

Para ser completamente honesto: nenhum SDD sozinho torna a copy "perfeita". Ele cria a estrutura para isso.

O que este documento garante:

- direcao de marca;
- criterio de qualidade;
- governanca;
- exemplos reais;
- base forte para implementacao.

O que ainda depende de execucao:

- reescrever as telas;
- revisar juridico com dados oficiais;
- validar a leitura real com uso interno;
- ajustar microcopy fina depois de ver tudo aplicado.

Ou seja:

**o SDD agora esta em nivel alto e serio. A copy ainda nao esta no nivel supremo no produto porque ela ainda nao foi aplicada em toda a interface.**

## 22. Checklist de revisao editorial

- Isso parece linguagem de mercado ou linguagem de sistema?
- O texto ajuda a comprar, vender ou operar?
- Existe algum termo que so faz sentido para quem conhece o backend?
- O texto parece Frescari ou parece painel generico?
- O produtor entenderia isso sem se sentir em um ERP?
- O comprador entenderia isso sem treinamento?
- O admin entenderia isso sem perder objetividade?
- Existe placeholder, ingles sobrando ou termo cru de implementacao?

## 23. Frase-guia final

Se houver duvida sobre qualquer texto do produto, aplicar esta pergunta:

**isso foi escrito para o cliente e para o parceiro, ou foi escrito para o sistema?**

Se a resposta for "para o sistema", a copy ainda nao esta pronta.
