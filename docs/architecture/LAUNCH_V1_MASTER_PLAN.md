# Launch V1 Master Plan

> Plano mestre do pre-lancamento fechado do Frescari.
> Atualizado em 2026-03-23.
> Status: EM EXECUCAO; FASE 2 FECHADA EM CODIGO, REPOSITORIO NO FIM DA FASE 5 E GO-LIVE REAL AINDA EM NO-GO.
> Escopo desta versao: base juridica, operacional e tecnica para liberar o dominio publico com seguranca.
> Referencia operacional final de go-live: `docs/architecture/GO_LIVE_SECURITY_CHECKLIST.md`.

## 0. Decisao do momento

O Frescari ainda nao esta aberto em dominio publico final. Isso muda a estrategia a nosso favor:

- podemos colocar a V1 completa no produto agora
- podemos deixar as paginas juridicas, aceites e fluxos operacionais ja funcionando
- podemos manter o ambiente fechado, com `noindex`, enquanto o advogado revisa o pacote
- podemos tratar esta fase como construcao de base definitiva, nao como remendo de MVP

Regra pratica desta fase:

- entrar rapido continua importante
- operar dinheiro, dados sensiveis e marketplace exige rigidez maxima

## 0.1 Status implementado em codigo

Em `2026-03-23`, o pacote inicial de endurecimento juridico, auth e onboarding de produtor ficou pronto no repositorio:

- paginas juridicas V1 publicadas no app para `Termos de Uso`, `Aviso de Privacidade`, `Termos do Marketplace`, `Pagamentos, Comissoes e Repasses`, `Politica de Cancelamento, Estorno e Chargeback` e `Politica de Cookies`
- versao juridica centralizada em `LEGAL_VERSION`, agora em `2026-03-23-v1`
- aceite obrigatorio validado no backend para cadastro por email e senha
- trilha de auditoria preparada com persistencia versionada em `user_legal_acceptances`
- redirecionamento server-side para impedir usuario autenticado de abrir `/auth/login` e `/auth/register`
- regra de pos-auth centralizada para encaminhar o usuario para `admin`, `dashboard` ou `onboarding`
- a verificacao real de email foi implementada no auth, com `requireEmailVerification` e jornada dedicada de pendencia/confirmacao
- cadastro agora envia o usuario para a etapa de confirmacao de email antes do onboarding
- login com email nao verificado passa a redirecionar para a jornada de verificacao, com reenvio de link
- entrega de email de verificacao ganhou helper dedicado e contrato de ambiente para provedor real
- workflow de staging ajustado para aplicar migracoes versionadas com `db:migrate`, evitando `push --force`
- onboarding de produtor agora coleta `PF/PJ`, documento, nome legal, nome publico, contato principal e telefone
- o tenant do produtor passa a persistir o perfil basico necessario para onboarding financeiro
- a criacao de conta Stripe Connect agora deriva `business_type` de `PF/PJ` e preenche nome legal/comercial de forma coerente
- o app passa a sincronizar e persistir um snapshot do status real do Stripe Connect (`details_submitted`, `charges_enabled`, `payouts_enabled` e `requirements`)
- o dashboard do produtor ganhou feedback orientado por estado real da conta Stripe, com CTA coerente para iniciar, retomar, revisar ou operar
- o checkout deixa de depender apenas de `stripeAccountId` e valida o estado operacional real do produtor antes de abrir pagamento
- o catalogo ganhou compatibilidade temporaria para produtores legados com `stripeAccountId` e sem primeiro sync, evitando regressao antes do backfill
- foi criado um CLI operacional para backfill/sync em lote de contas Stripe antigas, com limite, filtro por tenant e relatorio de sucesso/falha
- o email de verificacao ganhou fallback visual inline com monograma da marca, evitando dependencia de logo remoto no corpo da mensagem
- o contrato de ambiente de email passou a declarar tambem `AUTH_EMAIL_FROM_NAME`
- a regressao de onboarding agora cobre explicitamente que conta nova nasce `buyer` e so vira `producer` por escolha explicita no fluxo

Pendencias que continuam fora do codigo:

- executar a migracao `0010_user_legal_acceptances` no banco real do ambiente alvo
- executar a migracao `0011_producer_profile_fields` no banco real do ambiente alvo
- executar a migracao `0012_stripe_connect_status_fields` no banco real do ambiente alvo
- configurar `RESEND_API_KEY`, `AUTH_EMAIL_FROM` e `AUTH_EMAIL_FROM_NAME` no ambiente alvo para entrega real dos emails de verificacao
- validar envio real, callback e reenvio da verificacao de email em `staging` antes de promover
- rodar o backfill de Stripe Connect no `staging` e validar o resultado antes de promover
- validar o pacote juridico com revisao de advogado antes do go-live
- repetir o rollout no ambiente de producao quando a branch final for promovida

## 0.2 Status real do repositorio em 2026-03-23

- `Fase 0 - Parcial`: migrations, RLS e rehearsal de recovery estao versionados, mas banco limpo de producao, snapshots gerenciados e evidencia operacional continuam fora do repositorio.
- `Fase 1 - Fechada em codigo`: pacote juridico V1 esta publicado e versionado com documentos dedicados para cancelamento/chargeback e cookies; a revisao juridica final permanece como trava operacional da `Fase 7`.
- `Fase 2 - Fechada em codigo`: aceite versionado, trilha auditavel, verificacao real de email, callback e reenvio estao prontos; falta apenas configuracao/env e validacao operacional em ambiente alvo.
- `Fase 3 - Fechada em codigo`: o onboarding do produtor distingue `PF/PJ`, persiste dados minimos reais e sustenta prefill coerente para Stripe; a V1 passa a tratar a prontidao operacional pelo snapshot real do Stripe Connect, sem introduzir um estado interno paralelo extra nesta rodada.
- `Fase 4 - Fechada em codigo`: o app coleta dados minimos antes da Stripe, cria connected account com prefill coerente, retoma onboarding incompleto sem erro e expoe o estado correto da configuracao no dashboard principal.
- `Fase 5 - Parcial forte`: checkout, dashboard principal e catalogo ja estao protegidos por estado real ou fallback legado controlado; ainda falta executar o backfill das contas antigas em ambiente real e remover a compatibilidade temporaria quando a base estiver sincronizada.
- `Fase 6 - Parcial`: admin, categorias e produtos mestres existem, mas o bootstrap real da base oficial continua sendo tarefa operacional.
- `Fase 7 - Aberta`: revisao juridica, abertura de dominio publico e checklist final seguem em `NO-GO` operacional.

## 0.3 Etapa atual

Marco pratico em `2026-03-23`:

- em codigo, o repositorio esta no fim da `Fase 5`
- em operacao real, ainda nao viramos a `Fase 6`

Motivo:

- as travas principais de auth, onboarding e Stripe ja existem no produto
- ainda faltam tarefas operacionais reais para consolidar a base oficial: migracoes no ambiente alvo, configuracao real do envio de email, backfill de Stripe Connect, bootstrap manual da base e revisao juridica final

Leitura curta:

- `produto/repositorio`: entre `Fase 5` e pre-`Fase 6`
- `go-live real`: ainda em `NO-GO`, porque as pendencias operacionais e juridicas continuam abertas

## 0.4 Fechamento fase a fase em 2026-03-23

Para fechar todas as fases da V1 sem ambiguidade, a leitura operacional passa a ser:

- `Fase 0`: segue aberta; fecha quando a base oficial estiver limpa no ambiente alvo, com migrations aplicadas, RLS reaplicada e evidencia minima de recovery/restore registrada
- `Fase 1`: fechada em codigo em `2026-03-23`; a trava remanescente do pacote juridico migra para revisao final dentro da `Fase 7`
- `Fase 2`: fechada em codigo; falta a validacao operacional de `staging` com envio real de verificacao, callback e reenvio de ponta a ponta
- `Fase 3`: fechada em codigo em `2026-03-23`; para esta V1, a prontidao do produtor fica ancorada em onboarding minimo + snapshot Stripe Connect, sem criar um estado interno paralelo adicional
- `Fase 4`: fechada em codigo em `2026-03-23`; a validacao manual final do fluxo Frescari -> Stripe -> retorno segue no checklist operacional
- `Fase 5`: segue aberta; fecha quando o backfill das contas Stripe antigas rodar no ambiente real e a compatibilidade temporaria para contas legadas sem sync puder ser removida
- `Fase 6`: segue aberta; fecha quando a base oficial tiver admin raiz real, categorias reais e produtos mestres reais criados manualmente
- `Fase 7`: segue aberta; fecha quando houver revisao juridica aplicada, custom domain pronto para abertura controlada e checklist final de go-live assinado

## 1. Objetivo

Construir a primeira versao realmente pronta para operacao do Frescari, com:

- banco de producao limpo
- auth minimamente seguro e auditavel
- documentos juridicos V1 prontos para revisao
- onboarding de produtor com PF/PJ
- Stripe integrada ao onboarding sem friccao desnecessaria
- travas reais para impedir operacao irregular
- catalogo mestre criado manualmente com base limpa

## 2. Principios do produto

### Velocidade sem descontrole

- comprador continua com fluxo curtissimo
- produtor entra rapido, mas nao opera sem verificacoes
- o app coleta contexto de negocio
- a Stripe valida identidade, banco e exigencias regulatarias

### Clareza juridica antes de dinheiro

- nenhuma conta de produtor deve operar sem aceite de termos relevantes
- comissao, repasse, estorno e chargeback devem estar claros em documento e interface
- a plataforma nao pode depender de texto ambiguo para defender uma disputa

### Dados sensiveis com minimizacao

- CPF/CNPJ so devem ser coletados quando realmente necessarios
- documentos e comprovacoes devem ficar preferencialmente na Stripe, nao na Frescari
- o app deve registrar o minimo necessario para operacao, auditoria e suporte

### Banco de producao comecando certo

- producao nasce limpa
- nada de usuarios, pedidos, produtos ou contas Stripe herdadas de testes
- categorias e produtos mestres reais entram depois via admin

## 3. Escopo da V1

### Entra nesta V1

- banco de producao limpo
- pacote juridico V1
- aceite versionado
- verificacao de email
- modelo de produtor PF/PJ
- onboarding novo do produtor
- prefill de Stripe Connect
- status operacional real para recebimentos
- dashboard com travas de compliance
- bootstrap manual de admin, categorias e produtos mestres

### Nao entra nesta V1

- abrir dominio publico antes da revisao juridica e do checklist final
- guardar documentos de KYC fora da Stripe sem necessidade
- liberar produtores para vender so por ter `stripeAccountId`
- importar dados de teste para a base oficial

## 4. Fases de execucao

### Fase 0. Banco de producao limpo

#### Objetivo

Criar a base oficial de producao com a mesma estrutura tecnica do projeto, sem herdar lixo operacional.

#### Entregas

- branch ou database de producao limpa
- migrations aplicadas
- RLS e constraints replicadas
- isolamento total entre `dev`, `staging` e `production`
- separacao correta entre Stripe test e Stripe live

#### Regra de saida

- schema de producao bate com o estado esperado do repositorio
- nao existe dado de teste operacional
- ambiente de producao esta pronto para bootstrap real

### Fase 1. Pacote juridico V1

#### Objetivo

Criar a base documental e de aceite do marketplace antes da abertura publica.

#### Documentos V1

- `Termos de Uso`
- `Aviso de Privacidade`
- `Termos do Marketplace`
- `Politica de Pagamentos, Comissoes e Repasses`
- `Politica de Cancelamento, Estorno e Chargeback`
- `Politica de Cookies`, registrando o uso atual de cookies estritamente necessarios e o gatilho de revisao antes de qualquer cookie nao essencial

#### O que precisa estar explicito

- papel da Frescari como marketplace/intermediadora
- papel do produtor e do comprador
- comissao da plataforma
- base de calculo da comissao
- prazo e regra de repasse
- uso do Stripe Connect e onboarding financeiro
- cancelamentos e estornos
- chargebacks e retencoes
- produtos proibidos, restritos ou condicionados
- suspensao de conta, fraude e abuso
- tratamento de dados pessoais e compartilhamento com terceiros necessarios
- direitos do titular e canal de contato

#### Implementacao de produto

- paginas publicas ou semipublicas prontas no app
- aceite obrigatorio no cadastro
- aceite especifico de marketplace antes de ativar o produtor
- versao, data de vigencia e historico de mudancas

#### Regra de saida

- textos V1 prontos para uso interno
- paginas renderizadas no produto
- pacote enviado ao advogado para revisao

### Fase 2. Auth e governanca de aceite

#### Objetivo

Eliminar cadastro frouxo demais sem matar conversao.

#### Entregas

- validacao melhor de cadastro
- verificacao de email
- checkbox obrigatorio para termos relevantes
- aceite versionado com usuario, versao aceita, timestamp e IP ou metadata equivalente de auditoria
- reaceite quando houver mudanca material

#### Regras de negocio

- conta pode ser criada rapido
- conta nao vira produtora operacional sem email verificado
- conta nao opera sem aceite obrigatorio

#### Regra de saida

- existe trilha auditavel de aceite
- email verificado vira requisito para ativacao operacional

### Fase 3. Modelo de produtor PF/PJ

#### Objetivo

Parar de tratar todo produtor como caso generico e preparar o sistema para o Brasil real.

#### Entregas

- trilha `PF/CPF`
- trilha `PJ/CNPJ`
- campos minimos para onboarding e prefill
- prontidao operacional minima consolidada em onboarding + snapshot Stripe Connect
- separacao clara entre conta criada, conta em configuracao, conta em analise e conta apta para vender/receber

#### Dados base do produtor

- tipo de pessoa: PF ou PJ
- CPF ou CNPJ
- nome legal
- nome publico da fazenda ou marca
- telefone
- endereco base
- responsavel principal

#### Regra de saida

- backend consegue distinguir corretamente PF e PJ
- modelo suporta Stripe Connect sem fallback errado

### Fase 4. Onboarding do produtor com Stripe integrada

#### Objetivo

Transformar a Stripe em etapa final de validacao, nao em formulario do zero.

#### Fluxo alvo

1. criar conta
2. escolher perfil
3. se for produtor, abrir onboarding proprio da Frescari
4. coletar dados minimos e validos
5. criar connected account com prefill coerente
6. redirecionar para Stripe para banco, documento e exigencias regulatarias
7. voltar para a Frescari com status claro

#### Regras de UX

- comprador nao ve nada de Stripe
- produtor recebe copy direta sobre recebimentos
- o app evita perguntar de novo o que ja sabe
- sair no meio do onboarding nao quebra a conta

#### Regra de saida

- PF e PJ criam onboarding coerente
- a conta da Stripe pode ser retomada sem erro
- o dashboard mostra o estado certo da configuracao

### Fase 5. Travamento operacional e dashboard de recebimentos

#### Objetivo

Impedir que o sistema trate conta incompleta como conta pronta.

#### Entregas

- area de `Recebimentos` no dashboard
- status claros para o produtor: configuracao pendente, em analise, pronto para receber e restrito
- travas de publicacao, venda e recebimento conforme estado real

#### Fonte da verdade

- `details_submitted`
- `charges_enabled`
- `payouts_enabled`
- `requirements`

#### Regra de saida

- `stripeAccountId` sozinho nao libera operacao
- a plataforma passa a depender do estado real da conta

### Fase 6. Bootstrap manual da operacao

#### Objetivo

Subir a base real de administracao e catalogo sem seeds de teste.

#### Ordem

1. criar sua conta real
2. promover sua conta para `admin`
3. criar categorias manualmente
4. criar produtos mestres manualmente
5. so depois abrir cadastro operacional real

#### Regras

- nada de reaproveitar catalogo de teste
- categorias antes de produtos mestres
- taxonomia definida antes do volume operacional

#### Regra de saida

- admin raiz operacional pronto
- categorias reais prontas
- produtos mestres reais prontos

### Fase 7. Revisao juridica e abertura controlada

#### Objetivo

Fechar o ciclo entre produto, operacao e juridico antes de abrir para trafego real.

#### Entregas

- pacote V1 enviado ao advogado
- lista de pontos comerciais e juridicos para decisao final
- ajustes aplicados no produto e nos textos
- checklist final de go-live revisado

#### Regra de saida

- textos revisados
- aceites versionados em producao
- onboarding e Stripe testados
- producao pronta para dominio publico

## 5. Ordem de implementacao recomendada

1. banco de producao limpo
2. pacote juridico V1
3. auth + aceite versionado + verificacao de email
4. modelo PF/PJ
5. onboarding novo do produtor
6. Stripe com prefill
7. dashboard e travas operacionais
8. bootstrap manual do catalogo
9. revisao juridica final
10. abertura controlada do dominio

## 6. Decisoes de produto que o advogado deve revisar

- texto exato sobre o papel da Frescari na intermediacao
- redacao da comissao da plataforma
- prazo de repasse e eventos que podem bloquear repasse
- responsabilidade em cancelamento e disputa
- politica de chargeback
- lista de itens proibidos ou condicionados
- redacao de privacidade e base legal de tratamento
- clausulas para produtores PF e produtores PJ

## 7. Definicao de pronto

O Frescari so pode ser considerado pronto para abrir dominio publico quando:

- existir banco de producao limpo e isolado
- o pacote juridico V1 estiver implementado no produto
- o aceite estiver versionado e auditavel
- o email verificado for requisito operacional
- o onboarding de produtor suportar PF/PJ
- a Stripe estiver integrada com prefill e retomada segura
- o dashboard usar estado real de recebimentos
- o catalogo mestre real estiver criado
- o advogado tiver revisado a V1 e os ajustes finais tiverem sido aplicados

## 8. Referencias oficiais para a V1

- LGPD: https://www.planalto.gov.br/ccivil_03/_Ato2015-2018/2018/Lei/L13709.htm
- Marco Civil da Internet: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm
- Codigo de Defesa do Consumidor: https://www.planalto.gov.br/ccivil_03/Leis/l8078compilado.htm
- Decreto do Comercio Eletronico: https://www.planalto.gov.br/ccivil_03/_Ato2011-2014/2013/Decreto/D7962.htm
- Orientacoes para elaboracao de Termos de Uso e Avisos de Privacidade: https://www.gov.br/gestao/pt-br/acesso-a-informacao/acoes-e-programas/integra/governanca/comites-tematicos-de-apoio-a-governanca/comite-tematico-de-protecao-de-dados-pessoais-ceppdp/documentos-ceppdp/documentos-do-ceppdp/OrientacoesParaElaboracaoDeTermosDeUsoAvisosDePrivacidadev1.1.pdf
- Stripe Connect Express: https://docs.stripe.com/connect/express-accounts
- Stripe hosted onboarding: https://docs.stripe.com/connect/hosted-onboarding
