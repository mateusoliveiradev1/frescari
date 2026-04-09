import type { Metadata } from "next";

import { sanitizeEnvValue } from "./env";
import { buildCanonicalUrl, buildSeoMetadata } from "./seo";

export const LEGAL_VERSION = "2026-04-08-v3";

export type LegalDocumentSlug =
  | "termos"
  | "privacidade"
  | "marketplace"
  | "pagamentos-e-repasses"
  | "cancelamento-estorno-e-chargeback"
  | "cookies";

type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocument = {
  slug: LegalDocumentSlug;
  title: string;
  eyebrow: string;
  description: string;
  summary: string;
  status: string;
  effectiveDate: string;
  effectiveDateIso: string;
  updatedAt: string;
  updatedAtIso: string;
  reviewNote: string;
  sections: LegalSection[];
};

type LegalDocumentDraft = Omit<
  LegalDocument,
  "effectiveDateIso" | "updatedAtIso"
>;

const LEGAL_PUBLICATION_DATE = "8 de abril de 2026";
const LEGAL_PUBLICATION_DATE_ISO = "2026-04-08";
const LEGAL_STATUS = "Versao vigente - V3";
const LEGAL_OPERATOR_NAME =
  sanitizeEnvValue(process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME) ||
  "Titular responsavel pela operacao Frescari";
const LEGAL_OPERATOR_DOCUMENT_KIND =
  sanitizeEnvValue(
    process.env.NEXT_PUBLIC_LEGAL_OPERATOR_DOCUMENT_KIND,
  )?.toUpperCase() === "CNPJ"
    ? "CNPJ"
    : "CPF";
const LEGAL_OPERATOR_DOCUMENT = sanitizeEnvValue(
  process.env.NEXT_PUBLIC_LEGAL_OPERATOR_DOCUMENT,
);
const LEGAL_OPERATOR_ADDRESS = sanitizeEnvValue(
  process.env.NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS,
);
const LEGAL_SUPPORT_EMAIL =
  sanitizeEnvValue(process.env.NEXT_PUBLIC_LEGAL_SUPPORT_EMAIL) ||
  "suporte@frescari.com.br";
const LEGAL_PRIVACY_EMAIL =
  sanitizeEnvValue(process.env.NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL) ||
  LEGAL_SUPPORT_EMAIL;
const LEGAL_OPERATOR_REGISTRY_LINE = LEGAL_OPERATOR_DOCUMENT
  ? LEGAL_OPERATOR_DOCUMENT_KIND === "CNPJ"
    ? `inscrita no CNPJ sob o numero ${LEGAL_OPERATOR_DOCUMENT}`
    : `inscrito(a) no CPF sob o numero ${LEGAL_OPERATOR_DOCUMENT}`
  : LEGAL_OPERATOR_DOCUMENT_KIND === "CNPJ"
    ? "identificada pelo CNPJ informado nos canais oficiais de atendimento"
    : "identificado(a) pelo CPF informado nos canais oficiais de atendimento";
const LEGAL_OPERATOR_ADDRESS_LINE = LEGAL_OPERATOR_ADDRESS
  ? `com endereco em ${LEGAL_OPERATOR_ADDRESS}`
  : "com endereco comercial informado pelos canais oficiais de atendimento";
const LEGAL_OPERATOR_LEGAL_LINE = `${LEGAL_OPERATOR_NAME}, ${LEGAL_OPERATOR_REGISTRY_LINE}, ${LEGAL_OPERATOR_ADDRESS_LINE}`;
const LEGAL_DOCUMENT_FALLBACK = `${LEGAL_OPERATOR_DOCUMENT_KIND} informado nos canais oficiais de atendimento`;
const CONSUMER_FORUM_PARAGRAPH =
  "Sem prejuizo do foro especial previsto em lei para consumidores, eventuais controversias serao submetidas ao foro competente definido pela legislacao brasileira aplicavel.";
const GENERAL_FORUM_PARAGRAPH =
  "Eventuais controversias serao submetidas ao foro competente definido pela legislacao brasileira aplicavel.";

function resolveLegalContent(value: string): string {
  return value
    .replaceAll(
      "Para exercicio de direitos ou duvidas sobre privacidade, o titular pode entrar em contato com o encarregado de dados (DPO) pelo endeco de e-mail: [EMAIL DE PRIVACIDADE].",
      `Para exercicio de direitos ou duvidas sobre privacidade, o titular pode entrar em contato pelo canal de privacidade da Frescari: ${LEGAL_PRIVACY_EMAIL}.`,
    )
    .replaceAll(
      "Solicitacoes relacionadas ao exercicio de direitos, duvidas sobre tratamento e reclamacoes de privacidade devem ser encaminhadas ao encarregado de dados da Frescari pelo e-mail: [EMAIL DE PRIVACIDADE]. A Frescari se compromete a responder dentro do prazo razoavel exigido pela LGPD.",
      `Solicitacoes relacionadas ao exercicio de direitos, duvidas sobre tratamento e reclamacoes de privacidade devem ser encaminhadas ao canal de privacidade da Frescari: ${LEGAL_PRIVACY_EMAIL}. A Frescari se compromete a responder dentro de prazo razoavel, observado o regime aplicavel da LGPD.`,
    )
    .replaceAll(
      "Fica eleito o foro da comarca de [CIDADE/UF] como competente para dirimir eventuais controversias oriundas deste instrumento, sem prejuizo da competencia de foro especial prevista em lei para consumidores.",
      CONSUMER_FORUM_PARAGRAPH,
    )
    .replaceAll(
      "Fica eleito o foro da comarca de [CIDADE/UF] como competente para dirimir eventuais controversias, sem prejuizo do foro especial previsto em lei para consumidores.",
      CONSUMER_FORUM_PARAGRAPH,
    )
    .replaceAll(
      "Fica eleito o foro da comarca de [CIDADE/UF] para dirimir eventuais controversias, sem prejuizo do foro especial do consumidor.",
      CONSUMER_FORUM_PARAGRAPH,
    )
    .replaceAll(
      "O foro competente para eventuais controversias e o da comarca de [CIDADE/UF].",
      GENERAL_FORUM_PARAGRAPH,
    )
    .replaceAll(
      "Fica eleito o foro da comarca de [CIDADE/UF] para dirimir eventuais controversias.",
      GENERAL_FORUM_PARAGRAPH,
    )
    .replaceAll(
      "[RAZAO SOCIAL], inscrita no CNPJ sob o numero [XX.XXX.XXX/XXXX-XX], com sede em [ENDERECO COMPLETO, CIDADE/UF]",
      LEGAL_OPERATOR_LEGAL_LINE,
    )
    .replaceAll(
      "[RAZAO SOCIAL], CNPJ [XX.XXX.XXX/XXXX-XX], com sede em [ENDERECO COMPLETO, CIDADE/UF]",
      LEGAL_OPERATOR_LEGAL_LINE,
    )
    .replaceAll("[RAZAO SOCIAL]", LEGAL_OPERATOR_NAME)
    .replaceAll(
      "[ENDERECO COMPLETO, CIDADE/UF]",
      LEGAL_OPERATOR_ADDRESS ||
        "endereco comercial informado pelos canais oficiais de atendimento",
    )
    .replaceAll(
      "[XX.XXX.XXX/XXXX-XX]",
      LEGAL_OPERATOR_DOCUMENT || LEGAL_DOCUMENT_FALLBACK,
    )
    .replaceAll("[EMAIL DE SUPORTE]", LEGAL_SUPPORT_EMAIL)
    .replaceAll("[EMAIL DE PRIVACIDADE]", LEGAL_PRIVACY_EMAIL)
    .replaceAll(
      "[CIDADE/UF]",
      "localidade informada nos canais oficiais de atendimento",
    );
}

const legalDocuments = {
  termos: {
    slug: "termos",
    title: "Termos de Uso",
    eyebrow: "Base contratual geral",
    description:
      "Regras gerais de acesso e uso da plataforma Frescari por compradores, produtores e administradores.",
    summary:
      "Estes Termos de Uso disciplinam o acesso ao aplicativo, a criacao de conta, o uso das funcionalidades da plataforma e as regras gerais de conduta dentro da Frescari.",
    status: "Versao final — V2",
    effectiveDate: "2 de abril de 2026",
    updatedAt: "2 de abril de 2026",
    reviewNote: "",
    sections: [
      {
        title: "1. Identificacao da plataforma",
        paragraphs: [
          "A plataforma Frescari e operada por [RAZAO SOCIAL], inscrita no CNPJ sob o numero [XX.XXX.XXX/XXXX-XX], com sede em [ENDERECO COMPLETO, CIDADE/UF] (doravante 'Frescari').",
          "Para duvidas, suporte ou exercicio de direitos, o usuario pode entrar em contato pelo canal oficial de atendimento: [EMAIL DE SUPORTE].",
        ],
      },
      {
        title: "2. Plataforma e escopo",
        paragraphs: [
          "A Frescari opera como plataforma digital de intermediacao entre produtores, compradores e administradores do marketplace, oferecendo infraestrutura de cadastro, descoberta, negociacao, pagamento e gestao operacional.",
          "A utilizacao da plataforma depende de conta valida, observancia destes Termos de Uso e respeito a todas as politicas complementares publicadas pela Frescari.",
        ],
      },
      {
        title: "3. Cadastro e acesso",
        paragraphs: [
          "O usuario deve fornecer informacoes verdadeiras, atualizadas e suficientes para identificacao e funcionamento regular da conta.",
          "A conta e pessoal e nao pode ser compartilhada com terceiros sem autorizacao expressa da Frescari. O usuario responde pela guarda de suas credenciais e pela atividade realizada a partir da propria conta.",
        ],
        bullets: [
          "A Frescari pode exigir verificacao de email, telefone, identidade ou dados complementares antes de liberar funcionalidades sensiveis.",
          "Cadastros incompletos, inconsistentes ou potencialmente fraudulentos podem ser suspensos preventivamente.",
        ],
      },
      {
        title: "4. Regras de conduta",
        paragraphs: [
          "E vedado usar a plataforma para fraudar operacoes, manipular precos, burlar controles de acesso, publicar conteudo enganoso ou praticar qualquer conduta contraria a lei, a boa-fe ou as politicas da Frescari.",
          "Tambem e vedado tentar explorar falhas tecnicas, automatizar acessos nao autorizados, utilizar dados de terceiros sem base legal ou praticar condutas que comprometam a confianca do marketplace.",
        ],
      },
      {
        title: "5. Direito de arrependimento",
        paragraphs: [
          "O consumidor que realizar compra por meio da plataforma Frescari tem o direito de se arrepender e solicitar o cancelamento em ate 7 (sete) dias corridos contados da data de recebimento do produto, sem necessidade de justificativa, nos termos do artigo 49 do Codigo de Defesa do Consumidor e do artigo 5o do Decreto no 7.962/2013.",
          "Para exercer o direito de arrependimento, o usuario deve entrar em contato com o suporte da Frescari pelo canal oficial dentro do prazo. O reembolso sera processado conforme os fluxos descritos na Politica de Cancelamento, Estorno e Chargeback.",
        ],
      },
      {
        title: "6. Disponibilidade e alteracoes",
        paragraphs: [
          "A Frescari podera evoluir, ajustar, restringir ou descontinuar funcionalidades para fins de seguranca, adequacao regulatoria, manutencao tecnica ou melhoria de produto.",
          "Quando houver alteracoes materiais nestes Termos, a plataforma podera exigir novo aceite antes da continuidade da operacao.",
        ],
      },
      {
        title: "7. Suspensao, limitacao e encerramento",
        paragraphs: [
          "A Frescari podera limitar funcionalidades, bloquear acessos, suspender contas ou encerrar relacoes de uso quando houver descumprimento contratual, risco de fraude, exigencia regulatoria, disputa operacional relevante ou uso indevido da plataforma.",
          "Sempre que possivel e compativel com a seguranca do sistema, a plataforma apresentara comunicacao do motivo e orientacao sobre eventual regularizacao.",
        ],
      },
      {
        title: "8. Responsabilidade geral",
        paragraphs: [
          "A Frescari envidara esforcos tecnicos e operacionais razoaveis para manter a plataforma disponivel, segura e funcional, sem assumir garantia absoluta de funcionamento ininterrupto ou livre de erros.",
          "Cada usuario responde pelas informacoes que fornece, pelas obrigacoes legais e tributarias que lhe cabem e pela regularidade da propria atuacao dentro do marketplace.",
        ],
      },
      {
        title: "9. Reclamacoes e canais de atendimento",
        paragraphs: [
          "O usuario pode registrar reclamacoes, sugestoes e solicitacoes pelo canal oficial de suporte da Frescari em [EMAIL DE SUPORTE]. A Frescari compromete-se a responder em prazo razoavel conforme a natureza da solicitacao.",
          "Caso a demanda nao seja resolvida diretamente com a Frescari, o usuario tambem pode recorrer ao Procon de sua municipalidade ou ao portal consumidor.gov.br, conforme previsto na legislacao de defesa do consumidor.",
        ],
      },
      {
        title: "10. Lei aplicavel e foro",
        paragraphs: [
          "Estes Termos de Uso sao regidos pela legislacao brasileira, em especial pelo Codigo Civil, pelo Codigo de Defesa do Consumidor (Lei no 8.078/1990) e pelo Marco Civil da Internet (Lei no 12.965/2014).",
          "Fica eleito o foro da comarca de [CIDADE/UF] como competente para dirimir eventuais controversias oriundas deste instrumento, sem prejuizo da competencia de foro especial prevista em lei para consumidores.",
        ],
      },
    ],
  },
  privacidade: {
    slug: "privacidade",
    title: "Aviso de Privacidade",
    eyebrow: "Dados pessoais e LGPD",
    description:
      "Como a Frescari coleta, utiliza, compartilha e protege dados pessoais no contexto da plataforma.",
    summary:
      "Este Aviso de Privacidade descreve as principais atividades de tratamento de dados pessoais realizadas pela Frescari, os direitos do titular e os canais de contato para assuntos de privacidade.",
    status: "Versao final — V2",
    effectiveDate: "2 de abril de 2026",
    updatedAt: "2 de abril de 2026",
    reviewNote: "",
    sections: [
      {
        title: "1. Controlador de dados",
        paragraphs: [
          "O controlador responsavel pelo tratamento dos dados pessoais coletados por esta plataforma e [RAZAO SOCIAL], inscrita no CNPJ sob o numero [XX.XXX.XXX/XXXX-XX], com sede em [ENDERECO COMPLETO, CIDADE/UF] (doravante 'Frescari').",
          "Para exercicio de direitos ou duvidas sobre privacidade, o titular pode entrar em contato com o encarregado de dados (DPO) pelo endeco de e-mail: [EMAIL DE PRIVACIDADE].",
        ],
      },
      {
        title: "2. Dados tratados",
        paragraphs: [
          "A Frescari pode tratar dados cadastrais, dados de contato, dados de autenticacao, dados operacionais de pedidos e dados necessarios para viabilizar pagamentos, repasses, suporte, seguranca e prevencao a fraude.",
          "Para produtores, a plataforma podera tratar tambem dados de perfil profissional, nome publico da fazenda ou marca, informacoes de onboarding e dados minimos para prefill de integracoes financeiras.",
        ],
      },
      {
        title: "3. Finalidades e bases legais (LGPD)",
        paragraphs: [
          "Os dados pessoais sao tratados para finalidades especificas, cada uma amparada por uma base legal prevista na Lei Geral de Protecao de Dados (Lei no 13.709/2018):",
        ],
        bullets: [
          "Criacao e manutencao de conta, autenticacao e acesso ao servico: execucao de contrato (Art. 7o, V).",
          "Processamento de pagamentos e repasses ao produtor: execucao de contrato e cumprimento de obrigacao legal (Art. 7o, V e II).",
          "Prevencao a fraude, seguranca da informacao e integridade do marketplace: legitimo interesse (Art. 7o, IX).",
          "Cumprimento de obrigacoes regulatorias, fiscais e de prevencao a lavagem de dinheiro: obrigacao legal (Art. 7o, II).",
          "Comunicacoes transacionais (confirmacao de pedido, atualizacao de status): execucao de contrato (Art. 7o, V).",
          "Aperfeicoamento do servico e analise de uso anonimizado: legitimo interesse (Art. 7o, IX), com respeito ao direito de oposicao.",
        ],
      },
      {
        title: "4. Compartilhamento e transferencia internacional",
        paragraphs: [
          "A Frescari podera compartilhar dados com operadores e parceiros estritamente necessarios para a prestacao do servico, incluindo provedores de autenticacao, infraestrutura em nuvem, armazenamento de arquivos e processamento financeiro.",
          "Para viabilizar pagamentos e repasses, dados necessarios ao onboarding e validacoes regulatorias sao compartilhados com a Stripe, Inc. (Estados Unidos). Esse compartilhamento constitui transferencia internacional de dados pessoais, realizada com base nas garantias adequadas aplicaveis nos termos da LGPD e das regulamentacoes da ANPD.",
        ],
        bullets: [
          "O compartilhamento observa os principios de necessidade, adequacao e minimizacao.",
          "A Frescari nao compartilha dados para fins alheios ao funcionamento regular do produto sem base legal adequada.",
        ],
      },
      {
        title: "5. Retencao e seguranca",
        paragraphs: [
          "Os dados serao conservados pelo prazo necessario para cumprir as finalidades de tratamento e, apos o encerramento da relacao contratual, pelo prazo prescricional aplicavel, que pode chegar a 5 (cinco) anos nos termos do artigo 206 do Codigo Civil, salvo prazo maior exigido por lei especifica.",
          "A Frescari adota medidas tecnicas e organizacionais razoaveis para proteger dados pessoais contra acesso nao autorizado, alteracao indevida, perda, vazamento e uso abusivo, incluindo criptografia em transito, autenticacao segura e controles de acesso por funcao.",
        ],
      },
      {
        title: "6. Direitos do titular",
        paragraphs: [
          "Nos termos da LGPD, o titular tem os seguintes direitos em relacao aos seus dados pessoais tratados pela Frescari:",
        ],
        bullets: [
          "Confirmacao da existencia de tratamento e acesso aos dados.",
          "Correcao de dados incompletos, inexatos ou desatualizados.",
          "Anonimizacao, bloqueio ou eliminacao de dados desnecessarios, excessivos ou tratados em desconformidade com a lei.",
          "Portabilidade dos dados a outro fornecedor de servico, quando aplicavel.",
          "Informacao sobre entidades publicas e privadas com as quais a Frescari realizou uso compartilhado de dados.",
          "Revogacao do consentimento, quando o tratamento for baseado nessa base legal.",
          "Oposicao ao tratamento realizado com fundamento em outras bases legais, em caso de descumprimento da lei.",
        ],
      },
      {
        title: "7. Contato, DPO e autoridade regulatoria",
        paragraphs: [
          "Solicitacoes relacionadas ao exercicio de direitos, duvidas sobre tratamento e reclamacoes de privacidade devem ser encaminhadas ao encarregado de dados da Frescari pelo e-mail: [EMAIL DE PRIVACIDADE]. A Frescari se compromete a responder dentro do prazo razoavel exigido pela LGPD.",
          "Caso o titular considere que seus direitos nao foram adequadamente atendidos, pode apresentar reclamacao perante a Autoridade Nacional de Protecao de Dados (ANPD), conforme previsto no artigo 18, paragrafo 1o da LGPD.",
        ],
      },
      {
        title: "8. Atualizacoes e lei aplicavel",
        paragraphs: [
          "Este Aviso podera ser atualizado para refletir evolucoes regulatorias, tecnicas ou operacionais. Mudancas materiais serao destacadas com antecedencia razoavel e, quando exigirem novo consentimento, serao apresentadas ao titular antes da continuidade do tratamento.",
          "Este Aviso e regido pela Lei Geral de Protecao de Dados (Lei no 13.709/2018) e pela legislacao brasileira aplicavel. O foro competente para eventuais controversias e o da comarca de [CIDADE/UF].",
        ],
      },
    ],
  },
  marketplace: {
    slug: "marketplace",
    title: "Termos do Marketplace",
    eyebrow: "Regras da operacao comercial",
    description:
      "Regras especificas para compradores, produtores e operacao comercial dentro do marketplace Frescari.",
    summary:
      "Estes Termos do Marketplace regulam a utilizacao comercial da plataforma, definindo papeis, responsabilidades, limites operacionais e regras de publicacao, negociacao e execucao das operacoes.",
    status: "Versao final — V2",
    effectiveDate: "2 de abril de 2026",
    updatedAt: "2 de abril de 2026",
    reviewNote: "",
    sections: [
      {
        title: "1. Identificacao e escopo",
        paragraphs: [
          "O marketplace Frescari e operado por [RAZAO SOCIAL], CNPJ [XX.XXX.XXX/XXXX-XX], com sede em [ENDERECO COMPLETO, CIDADE/UF].",
          "Estes Termos do Marketplace regulam especificamente as relacoes comerciais entre produtores e compradores intermediadas pela plataforma, complementando os Termos de Uso gerais.",
        ],
      },
      {
        title: "2. Papeis das partes",
        paragraphs: [
          "A Frescari disponibiliza a infraestrutura do marketplace e nao substitui a responsabilidade legal, comercial, tributaria e operacional das partes pelos atos que lhes competem.",
          "O produtor e responsavel pela regularidade do cadastro, pela legitimidade da oferta, pela veracidade das informacoes do item e pela capacidade de cumprir a operacao. O comprador responde pela veracidade das informacoes de compra, pagamento e recebimento.",
        ],
      },
      {
        title: "3. Ofertas, publicacao e disponibilidade",
        paragraphs: [
          "A publicacao de itens depende do atendimento aos requisitos tecnicos, cadastrais e financeiros definidos pela plataforma. A Frescari podera restringir publicacoes quando houver pendencias cadastrais, financeiras, documentais ou de seguranca.",
          "Informacoes de produto, lote, disponibilidade, origem, peso, unidade de venda e prazo estimado devem ser mantidas atualizadas pelo produtor nos termos operacionais da plataforma.",
        ],
      },
      {
        title: "4. Produtos proibidos ou condicionados",
        paragraphs: [
          "Nao e permitido utilizar a Frescari para anunciar, negociar ou circular itens vedados por lei, produtos sem regularidade minima exigivel, mercadorias de origem ilicita ou itens em desacordo com as politicas de seguranca e qualidade da plataforma.",
          "Sao exemplos de produtos proibidos ou condicionados: alimentos sem registro sanitario aplicavel, produtos de origem animal sem inspecao competente (SIF/SIE/SIM), agrotoxicos nao registrados, embalagens irregulares e qualquer item cuja comercializacao requeira licenca nao apresentada pelo produtor.",
        ],
      },
      {
        title: "5. Disputas, cancelamentos e medidas de controle",
        paragraphs: [
          "Conflitos relacionados a pedido, divergencia de informacoes, indisponibilidade, atraso relevante, suspeita de fraude, chargeback ou descumprimento contratual poderao levar a bloqueio preventivo de funcionalidades, retencao temporaria de valores e abertura de analise interna. A Frescari buscara responder a disputas em ate 10 (dez) dias uteis contados da abertura formal da ocorrencia.",
          "A Frescari podera solicitar documentos, comprovacoes e registros adicionais para apuracao, conciliacao e resolucao de disputas entre as partes.",
        ],
      },
      {
        title: "6. Compliance operacional",
        paragraphs: [
          "A utilizacao comercial do marketplace depende da manutencao de conta regular, onboarding financeiro compativel com a categoria do usuario e respeito aos fluxos de pagamento e repasse definidos pela plataforma.",
          "Produtores que nao atenderem aos requisitos de cadastro, verificacao, aceite e recebimentos poderao ter a operacao limitada ate regularizacao.",
        ],
      },
      {
        title: "7. Lei aplicavel e foro",
        paragraphs: [
          "Estes Termos do Marketplace sao regidos pela legislacao brasileira, incluindo o Codigo de Defesa do Consumidor (Lei no 8.078/1990), o Marco Civil da Internet (Lei no 12.965/2014) e demais normas aplicaveis.",
          "Fica eleito o foro da comarca de [CIDADE/UF] como competente para dirimir eventuais controversias, sem prejuizo do foro especial previsto em lei para consumidores.",
        ],
      },
    ],
  },
  "pagamentos-e-repasses": {
    slug: "pagamentos-e-repasses",
    title: "Politica de Pagamentos, Comissoes e Repasses",
    eyebrow: "Financeiro do marketplace",
    description:
      "Como pagamentos, comissoes, repasses, cancelamentos, estornos e chargebacks devem funcionar na Frescari.",
    summary:
      "Esta politica define a logica financeira da plataforma, incluindo intermediacao de pagamentos, cobranca de comissao, repasse ao produtor e tratamento de eventos financeiros excepcionais.",
    status: "Versao final — V2",
    effectiveDate: "2 de abril de 2026",
    updatedAt: "2 de abril de 2026",
    reviewNote: "",
    sections: [
      {
        title: "1. Identificacao",
        paragraphs: [
          "Esta Politica e publicada por [RAZAO SOCIAL], CNPJ [XX.XXX.XXX/XXXX-XX], operadora da plataforma Frescari, com sede em [ENDERECO COMPLETO, CIDADE/UF].",
        ],
      },
      {
        title: "2. Intermediacao financeira",
        paragraphs: [
          "Os pagamentos realizados na Frescari sao processados pela Stripe, Inc., parceiro financeiro habilitado pela plataforma, via Stripe Connect, conforme o fluxo tecnico e regulatorio aplicavel.",
          "Para produtores, o recebimento depende da criacao e manutencao regular da conta conectada (Stripe Connect), do onboarding financeiro e do atendimento aos requisitos do parceiro de pagamento.",
        ],
      },
      {
        title: "3. Comissao da plataforma",
        paragraphs: [
          "A Frescari cobra uma comissao de 10% (dez por cento) sobre o valor bruto de cada transacao intermediada pela plataforma. Esse percentual incide sobre o total pago pelo comprador, incluindo o valor dos itens, antes do desconto do frete.",
          "A comissao e deduzida automaticamente no momento do repasse ao produtor. Taxas adicionais da Stripe (processamento de cartao, chargeback) podem ser descontadas conforme os termos da Stripe e serao comunicadas ao produtor no dashboard ou por comunicado especifico.",
        ],
      },
      {
        title: "4. Repasse ao produtor",
        paragraphs: [
          "O repasse ao produtor ocorre em ate 7 (sete) dias uteis contados da confirmacao da entrega do pedido, sujeito ao calendario operacional da Stripe e a ausencia de bloqueios previstos nesta politica.",
          "A Frescari podera reter temporariamente valores quando houver necessidade de conciliacao, investigacao de fraude, contestacao de pagamento, determinacao regulatoria ou descumprimento material das politicas da plataforma.",
        ],
      },
      {
        title: "5. Cancelamentos, estornos e chargebacks",
        paragraphs: [
          "Operacoes canceladas, estornadas ou objeto de chargeback poderao afetar a disponibilidade de repasse e gerar compensacoes, ajustes ou debitamentos conforme o caso concreto e a responsabilidade identificada.",
          "A plataforma podera priorizar a preservacao da integridade financeira do marketplace, inclusive com bloqueio temporario de saque, ajuste de saldo ou exigencia de informacoes adicionais.",
        ],
      },
      {
        title: "6. Limitacoes de operacao financeira",
        paragraphs: [
          "A Frescari nao garante liberacao imediata de valores nem continuidade irrestrita de recebimentos quando o produtor estiver em estado de pendencia cadastral, verificacao, risco elevado, inconsistencias documentais ou restricoes impostas pelo parceiro financeiro.",
          "A conta so deve ser tratada como apta para receber quando o estado operacional indicar habilitacao efetiva de cobranca e repasse (charges_enabled e payouts_enabled ativos no Stripe Connect).",
        ],
      },
      {
        title: "7. Lei aplicavel e foro",
        paragraphs: [
          "Esta Politica e regida pela legislacao brasileira, incluindo o Codigo de Defesa do Consumidor, a Lei de Meios de Pagamento e normas do Banco Central quando aplicaveis.",
          "Fica eleito o foro da comarca de [CIDADE/UF] para dirimir eventuais controversias, sem prejuizo do foro especial do consumidor.",
        ],
      },
    ],
  },
  "cancelamento-estorno-e-chargeback": {
    slug: "cancelamento-estorno-e-chargeback",
    title: "Politica de Cancelamento, Estorno e Chargeback",
    eyebrow: "Excecoes financeiras e operacionais",
    description:
      "Regras de tratamento para cancelamentos, estornos, contestacoes e chargebacks dentro da operacao Frescari.",
    summary:
      "Esta politica organiza os criterios minimos para cancelamento de operacoes, estorno de valores, tratamento de chargebacks e medidas preventivas de integridade financeira no marketplace.",
    status: "Versao final — V2",
    effectiveDate: "2 de abril de 2026",
    updatedAt: "2 de abril de 2026",
    reviewNote: "",
    sections: [
      {
        title: "1. Identificacao e escopo",
        paragraphs: [
          "Esta Politica e publicada por [RAZAO SOCIAL], CNPJ [XX.XXX.XXX/XXXX-XX], operadora da plataforma Frescari, com sede em [ENDERECO COMPLETO, CIDADE/UF].",
          "Este documento complementa os Termos do Marketplace e a Politica de Pagamentos, Comissoes e Repasses, detalhando como a Frescari trata eventos de cancelamento, estorno, contestacao e chargeback.",
        ],
      },
      {
        title: "2. Cancelamentos de operacao",
        paragraphs: [
          "Pedidos poderao ser cancelados quando houver indisponibilidade material do item, divergencia relevante de informacoes, falha de pagamento, suspeita de fraude, impossibilidade operacional comprovada ou acordo valido entre as partes.",
          "A Frescari podera suspender temporariamente a continuidade do pedido enquanto apura documentos, historico de comunicacao, comprovacoes logisticas e demais evidencias necessarias para decidir sobre a manutencao ou cancelamento da operacao.",
        ],
        bullets: [
          "Cancelamentos antes da confirmacao financeira podem resultar apenas em encerramento do pedido sem repasse.",
          "Cancelamentos apos confirmacao financeira poderao exigir estorno, ajuste de saldo, retencao temporaria ou compensacao posterior.",
        ],
      },
      {
        title: "3. Direito de arrependimento e devolucao",
        paragraphs: [
          "O consumidor tem direito ao arrependimento em ate 7 (sete) dias corridos do recebimento do produto, conforme o artigo 49 do Codigo de Defesa do Consumidor e o artigo 5o do Decreto no 7.962/2013. Nesse caso, o reembolso integral sera processado, descontadas eventuais taxas irrecuperaveis do parceiro financeiro.",
          "Para alimentos e produtos perecíveis, o exercicio do direito de arrependimento esta sujeito ao estado de conservacao do produto no momento da devolucao e as restricoes sanitarias e logisticas aplicaveis.",
        ],
      },
      {
        title: "4. Estornos e ajustes",
        paragraphs: [
          "Quando houver devolucao de valor ao comprador, a plataforma podera realizar estorno integral ou parcial conforme a natureza do evento, a extensao do prejuizo identificado e as limitacoes do parceiro de pagamento.",
          "Custos de intermediacao, taxas de terceiros, despesas operacionais e outros encargos associados ao evento poderao compor o calculo final de ajuste quando isso estiver alinhado com a regra comercial vigente e com a responsabilidade apurada.",
        ],
      },
      {
        title: "5. Chargebacks e contestacoes",
        paragraphs: [
          "Chargebacks, contestacoes bancarias ou disputas abertas junto ao parceiro financeiro poderao levar a bloqueio preventivo de repasses, reserva de saldo, solicitacao de documentos e restricao temporaria de funcionalidades da conta envolvida.",
          "A Frescari podera consolidar comprovantes, historico transacional, registros de entrega e evidencias operacionais para subsidiar a defesa da transacao ou reconhecer a necessidade de ajuste financeiro.",
        ],
      },
      {
        title: "6. Medidas de integridade financeira",
        paragraphs: [
          "Sempre que houver risco razoavel de perda, fraude, reincidencia ou inconsistencias materiais, a plataforma podera reter valores, interromper novos recebimentos, exigir regularizacao documental ou limitar saques e repasses ate a conclusao da analise.",
          "Essas medidas poderao ser adotadas mesmo antes da definicao final da disputa quando forem necessarias para proteger compradores, produtores, a propria operacao da Frescari e o equilibrio financeiro do marketplace.",
        ],
      },
      {
        title: "7. Cooperacao das partes",
        paragraphs: [
          "Compradores e produtores devem colaborar com a apuracao, apresentando informacoes verdadeiras, documentos solicitados e historico suficiente para conciliacao da ocorrencia em prazo razoavel.",
          "A omissao de dados, a apresentacao de informacoes inveridicas ou a recusa injustificada em cooperar poderao influenciar a decisao operacional da plataforma e a manutencao das medidas preventivas aplicadas.",
        ],
      },
      {
        title: "8. Lei aplicavel e foro",
        paragraphs: [
          "Esta Politica e regida pela legislacao brasileira, em especial pelo Codigo de Defesa do Consumidor (Lei no 8.078/1990) e pelo Decreto no 7.962/2013.",
          "Fica eleito o foro da comarca de [CIDADE/UF] para dirimir eventuais controversias, sem prejuizo do foro especial do consumidor.",
        ],
      },
    ],
  },
  cookies: {
    slug: "cookies",
    title: "Politica de Cookies",
    eyebrow: "Sessao, autenticacao e seguranca",
    description:
      "Como a Frescari utiliza cookies estritamente necessarios para autenticacao, continuidade da sessao e protecao basica da operacao.",
    summary:
      "Na versao atual da Frescari, o uso de cookies esta concentrado em autenticacao, continuidade de sessao e seguranca operacional. Nao ha, nesta etapa, ativacao de cookies de publicidade ou analytics nao essenciais no app web.",
    status: "Versao final — V2",
    effectiveDate: "2 de abril de 2026",
    updatedAt: "2 de abril de 2026",
    reviewNote: "",
    sections: [
      {
        title: "1. Identificacao",
        paragraphs: [
          "Esta Politica de Cookies e publicada por [RAZAO SOCIAL], CNPJ [XX.XXX.XXX/XXXX-XX], operadora da plataforma Frescari, com sede em [ENDERECO COMPLETO, CIDADE/UF].",
        ],
      },
      {
        title: "2. O que sao cookies",
        paragraphs: [
          "Cookies sao pequenos arquivos ou identificadores associados ao navegador para viabilizar funcionalidades tecnicas, lembrar estados de navegacao e reforcar controles de seguranca.",
          "No contexto atual da Frescari, eles sao usados de forma restrita para manter a experiencia autenticada e proteger fluxos sensiveis do produto.",
        ],
      },
      {
        title: "3. Cookies atualmente utilizados",
        paragraphs: [
          "A aplicacao web utiliza exclusivamente cookies estritamente necessarios para autenticar o usuario, manter a sessao ativa, encerrar o acesso com seguranca e apoiar controles basicos contra abuso do fluxo autenticado.",
          "Esses cookies nao sao usados, nesta versao do produto, para publicidade comportamental, remarketing ou analytics nao essenciais no front-end publico da aplicacao.",
        ],
        bullets: [
          "Cookies de sessao e autenticacao para manter o usuario conectado (HttpOnly, Secure, SameSite=Lax).",
          "Cookies tecnicos para continuidade do login e encerramento seguro da sessao.",
          "Cookies relacionados a seguranca operacional do fluxo autenticado, quando aplicavel.",
        ],
      },
      {
        title: "4. Base legal para uso de cookies essenciais",
        paragraphs: [
          "O uso de cookies estritamente necessarios nao requer consentimento previo, pois e indispensavel para a prestacao do servico solicitado pelo usuario, conforme o artigo 7o, inciso V da LGPD (execucao de contrato) e as diretrizes da ANPD sobre cookies tecnicos.",
          "Sem esses cookies, funcionalidades como entrar na conta, permanecer autenticado, concluir verificacoes de acesso e navegar por areas protegidas podem deixar de funcionar corretamente.",
        ],
      },
      {
        title: "5. Preferencias futuras e atualizacoes",
        paragraphs: [
          "Caso a Frescari venha a introduzir cookies nao estritamente necessarios — como mensuracao, analytics, personalizacao opcional ou publicidade — esta politica sera atualizada com transparencia e, quando exigido, sera solicitado consentimento especifico antes da ativacao desses recursos.",
          "Mudancas materiais nesta politica serao destacadas no produto ou em canais oficiais.",
        ],
      },
      {
        title: "6. Lei aplicavel e foro",
        paragraphs: [
          "Esta Politica e regida pela legislacao brasileira, em especial pela LGPD (Lei no 13.709/2018) e pelo Marco Civil da Internet (Lei no 12.965/2014).",
          "Fica eleito o foro da comarca de [CIDADE/UF] para dirimir eventuais controversias.",
        ],
      },
    ],
  },
} satisfies Record<LegalDocumentSlug, LegalDocumentDraft>;

function resolveLegalSection(section: LegalSection): LegalSection {
  const resolvedSection: LegalSection = {
    ...section,
    paragraphs: section.paragraphs.map(resolveLegalContent),
  };

  if (section.bullets) {
    resolvedSection.bullets = section.bullets.map(resolveLegalContent);
  }

  return resolvedSection;
}

const resolvedLegalDocuments = Object.fromEntries(
  Object.entries(legalDocuments).map(([slug, document]) => [
    slug,
    {
      ...document,
      status: LEGAL_STATUS,
      effectiveDate: LEGAL_PUBLICATION_DATE,
      effectiveDateIso: LEGAL_PUBLICATION_DATE_ISO,
      updatedAt: LEGAL_PUBLICATION_DATE,
      updatedAtIso: LEGAL_PUBLICATION_DATE_ISO,
      sections: document.sections.map(resolveLegalSection),
    },
  ]),
) as Record<LegalDocumentSlug, LegalDocument>;

export const legalDocumentLinks = [
  { href: "/termos", label: "Termos de Uso", slug: "termos" },
  { href: "/privacidade", label: "Aviso de Privacidade", slug: "privacidade" },
  { href: "/marketplace", label: "Termos do Marketplace", slug: "marketplace" },
  {
    href: "/pagamentos-e-repasses",
    label: "Pagamentos, Comissoes e Repasses",
    slug: "pagamentos-e-repasses",
  },
  {
    href: "/cancelamento-estorno-e-chargeback",
    label: "Cancelamento, Estorno e Chargeback",
    slug: "cancelamento-estorno-e-chargeback",
  },
  {
    href: "/cookies",
    label: "Politica de Cookies",
    slug: "cookies",
  },
] as const;

export function getLegalDocument(slug: LegalDocumentSlug): LegalDocument {
  return resolvedLegalDocuments[slug];
}

export function getLegalDocumentLastModifiedIso(
  slug: LegalDocumentSlug,
): string {
  return getLegalDocument(slug).updatedAtIso;
}

export function getLegalDocumentJsonLd(slug: LegalDocumentSlug) {
  const document = getLegalDocument(slug);
  const url = buildCanonicalUrl(`/${slug}`);

  return {
    "@context": "https://schema.org",
    "@id": `${url}#webpage`,
    "@type": "WebPage",
    about: {
      "@id": `${buildCanonicalUrl("/")}#organization`,
    },
    dateModified: document.updatedAtIso,
    datePublished: document.effectiveDateIso,
    description: document.description,
    inLanguage: "pt-BR",
    isPartOf: {
      "@id": `${buildCanonicalUrl("/")}#website`,
    },
    name: `${document.title} | Frescari`,
    publisher: {
      "@id": `${buildCanonicalUrl("/")}#organization`,
    },
    url,
  };
}

export function createLegalMetadata(slug: LegalDocumentSlug): Metadata {
  const document = getLegalDocument(slug);

  return buildSeoMetadata({
    description: document.description,
    path: `/${slug}`,
    title: `${document.title} | Frescari`,
  });
}
