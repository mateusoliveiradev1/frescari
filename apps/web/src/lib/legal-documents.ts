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
const LEGAL_STATUS = "Versão vigente";
const LEGAL_OPERATOR_NAME =
  sanitizeEnvValue(process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME) ||
  "Titular responsável pela operação Frescari";
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
    ? `inscrita no CNPJ sob o número ${LEGAL_OPERATOR_DOCUMENT}`
    : `inscrito(a) no CPF sob o número ${LEGAL_OPERATOR_DOCUMENT}`
  : LEGAL_OPERATOR_DOCUMENT_KIND === "CNPJ"
    ? "identificada pelo CNPJ informado nos canais oficiais de atendimento"
    : "identificado(a) pelo CPF informado nos canais oficiais de atendimento";
const LEGAL_OPERATOR_ADDRESS_LINE = LEGAL_OPERATOR_ADDRESS
  ? `com endereço em ${LEGAL_OPERATOR_ADDRESS}`
  : "com endereço comercial informado pelos canais oficiais de atendimento";
const LEGAL_OPERATOR_LEGAL_LINE = `${LEGAL_OPERATOR_NAME}, ${LEGAL_OPERATOR_REGISTRY_LINE}, ${LEGAL_OPERATOR_ADDRESS_LINE}`;
const LEGAL_DOCUMENT_FALLBACK = `${LEGAL_OPERATOR_DOCUMENT_KIND} informado nos canais oficiais de atendimento`;
const CONSUMER_FORUM_PARAGRAPH =
  "Sem prejuizo do foro especial previsto em lei para consumidores, eventuais controversias serão submetidas ao foro competente definido pela legislação brasileira aplicável.";
const GENERAL_FORUM_PARAGRAPH =
  "Eventuais controversias serão submetidas ao foro competente definido pela legislação brasileira aplicável.";

function resolveLegalContent(value: string): string {
  return (
    value
      .replaceAll(
        "Para exercicio de direitos ou dúvidas sobre privacidade, o titular pode entrar em contato com o encarregado de dados (DPO) pelo endeco de e-mail: [EMAIL DE PRIVACIDADE].",
        `Para exercicio de direitos ou dúvidas sobre privacidade, o titular pode entrar em contato pelo canal de privacidade da Frescari: ${LEGAL_PRIVACY_EMAIL}.`,
      )
      .replaceAll(
        "Solicitações relacionadas ao exercicio de direitos, dúvidas sobre tratamento e reclamações de privacidade devem ser encaminhadas ao encarregado de dados da Frescari pelo e-mail: [EMAIL DE PRIVACIDADE]. A Frescari se compromete a responder dentro do prazo razoável exigido pela LGPD.",
        `Solicitações relacionadas ao exercicio de direitos, dúvidas sobre tratamento e reclamações de privacidade devem ser encaminhadas ao canal de privacidade da Frescari: ${LEGAL_PRIVACY_EMAIL}. A Frescari se compromete a responder dentro de prazo razoável, observado o regime aplicável da LGPD.`,
      )
      .replaceAll(
        "Fica eleito o foro da comarca de [CIDADE/UF] como competente para dirimir eventuais controversias oriundas deste instrumento, sem prejuizo da competência de foro especial prevista em lei para consumidores.",
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
        "[RAZÃO SOCIAL], inscrita no CNPJ sob o número [XX.XXX.XXX/XXXX-XX], com sede em [ENDEREÇO COMPLETO, CIDADE/UF]",
        LEGAL_OPERATOR_LEGAL_LINE,
      )
      .replaceAll(
        "[RAZÃO SOCIAL], CNPJ [XX.XXX.XXX/XXXX-XX], com sede em [ENDEREÇO COMPLETO, CIDADE/UF]",
        LEGAL_OPERATOR_LEGAL_LINE,
      )
      .replaceAll(
        "[RAZÃO SOCIAL], CNPJ [XX.XXX.XXX/XXXX-XX], operadora da plataforma Frescari, com sede em [ENDEREÇO COMPLETO, CIDADE/UF]",
        `${LEGAL_OPERATOR_NAME}, ${LEGAL_OPERATOR_REGISTRY_LINE}, responsável pela operação da plataforma Frescari, ${LEGAL_OPERATOR_ADDRESS_LINE}`,
      )
      // Safety net for any other template sentence: never label a CPF as CNPJ.
      .replaceAll(
        "CNPJ [XX.XXX.XXX/XXXX-XX]",
        LEGAL_OPERATOR_DOCUMENT
          ? `${LEGAL_OPERATOR_DOCUMENT_KIND} ${LEGAL_OPERATOR_DOCUMENT}`
          : LEGAL_DOCUMENT_FALLBACK,
      )
      .replaceAll("[RAZÃO SOCIAL]", LEGAL_OPERATOR_NAME)
      .replaceAll(
        "[ENDEREÇO COMPLETO, CIDADE/UF]",
        LEGAL_OPERATOR_ADDRESS ||
          "endereço comercial informado pelos canais oficiais de atendimento",
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
      )
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
      "Estes Termos de Uso disciplinam o acesso ao aplicativo, a criação de conta, o uso das funcionalidades da plataforma e as regras gerais de conduta dentro da Frescari.",
    status: "Versão final — V2",
    effectiveDate: "2 de abril de 2026",
    updatedAt: "2 de abril de 2026",
    reviewNote: "",
    sections: [
      {
        title: "1. Identificação da plataforma",
        paragraphs: [
          "A plataforma Frescari e operada por [RAZÃO SOCIAL], inscrita no CNPJ sob o número [XX.XXX.XXX/XXXX-XX], com sede em [ENDEREÇO COMPLETO, CIDADE/UF] (doravante 'Frescari').",
          "Para dúvidas, suporte ou exercicio de direitos, o usuário pode entrar em contato pelo canal oficial de atendimento: [EMAIL DE SUPORTE].",
        ],
      },
      {
        title: "2. Plataforma e escopo",
        paragraphs: [
          "A Frescari opera como ambiente digital de intermediação entre produtores, compradores e administradores, oferecendo infraestrutura de cadastro, descoberta, negociação, pagamento e gestão operacional.",
          "A utilização da plataforma depende de conta valida, observância destes Termos de Uso e respeito a todas as políticas complementares publicadas pela Frescari.",
        ],
      },
      {
        title: "3. Cadastro e acesso",
        paragraphs: [
          "O usuário deve fornecer informações verdadeiras, atualizadas e suficientes para identificação e funcionamento regular da conta.",
          "A conta e pessoal e não pode ser compartilhada com terceiros sem autorização expressa da Frescari. O usuário responde pela guarda de suas credenciais e pela atividade realizada a partir da própria conta.",
        ],
        bullets: [
          "A Frescari pode exigir verificação de email, telefone, identidade ou dados complementares antes de liberar funcionalidades sensíveis.",
          "Cadastros incompletos, inconsistentes ou potencialmente fraudulentos podem ser suspensos preventivamente.",
        ],
      },
      {
        title: "4. Regras de conduta",
        paragraphs: [
          "E vedado usar a plataforma para fraudar operações, manipular preços, burlar controles de acesso, publicar conteúdo enganoso ou praticar qualquer conduta contraria a lei, a boa-fe ou as políticas da Frescari.",
          "Também e vedado tentar explorar falhas tecnicas, automatizar acessos não autorizados, utilizar dados de terceiros sem base legal ou praticar condutas que comprometam a confianca da Frescari.",
        ],
      },
      {
        title: "5. Direito de arrependimento",
        paragraphs: [
          "O consumidor que realizar compra por meio da plataforma Frescari tem o direito de se arrepender e solicitar o cancelamento em até 7 (sete) dias corridos contados da data de recebimento do produto, sem necessidade de justificativa, nos termos do artigo 49 do Código de Defesa do Consumidor e do artigo 5o do Decreto no 7.962/2013.",
          "Para exercer o direito de arrependimento, o usuário deve entrar em contato com o suporte da Frescari pelo canal oficial dentro do prazo. O reembolso será processado conforme os fluxos descritos na Política de Cancelamento, Estorno e Chargeback.",
        ],
      },
      {
        title: "6. Disponibilidade e alterações",
        paragraphs: [
          "A Frescari poderá evoluir, ajustar, restringir ou descontinuar funcionalidades para fins de segurança, adequação regulatoria, manutenção técnica ou melhoria de produto.",
          "Quando houver alterações materiais nestes Termos, a plataforma poderá exigir novo aceite antes da continuidade da operação.",
        ],
      },
      {
        title: "7. Suspensão, limitação e encerramento",
        paragraphs: [
          "A Frescari poderá limitar funcionalidades, bloquear acessos, suspender contas ou encerrar relações de uso quando houver descumprimento contratual, risco de fraude, exigência regulatoria, disputa operacional relevante ou uso indevido da plataforma.",
          "Sempre que possível e compatível com a segurança do sistema, a plataforma apresentara comunicação do motivo e orientação sobre eventual regularização.",
        ],
      },
      {
        title: "8. Responsabilidade geral",
        paragraphs: [
          "A Frescari envidara esforcos tecnicos e operacionais razoáveis para manter a plataforma disponível, segura e funcional, sem assumir garantia absoluta de funcionamento ininterrupto ou livre de erros.",
          "Cada usuário responde pelas informações que fornece, pelas obrigações legais e tributarias que lhe cabem e pela regularidade da própria atuação dentro da Frescari.",
        ],
      },
      {
        title: "9. Reclamações e canais de atendimento",
        paragraphs: [
          "O usuário pode registrar reclamações, sugestoes e solicitações pelo canal oficial de suporte da Frescari em [EMAIL DE SUPORTE]. A Frescari compromete-se a responder em prazo razoável conforme a natureza da solicitação.",
          "Caso a demanda não seja resolvida diretamente com a Frescari, o usuário também pode recorrer ao Procon de sua municipalidade ou ao portal consumidor.gov.br, conforme previsto na legislação de defesa do consumidor.",
        ],
      },
      {
        title: "10. Lei aplicável e foro",
        paragraphs: [
          "Estes Termos de Uso são regidos pela legislação brasileira, em especial pelo Código Civil, pelo Código de Defesa do Consumidor (Lei no 8.078/1990) e pelo Marco Civil da Internet (Lei no 12.965/2014).",
          "Fica eleito o foro da comarca de [CIDADE/UF] como competente para dirimir eventuais controversias oriundas deste instrumento, sem prejuizo da competência de foro especial prevista em lei para consumidores.",
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
    status: "Versão final — V2",
    effectiveDate: "2 de abril de 2026",
    updatedAt: "2 de abril de 2026",
    reviewNote: "",
    sections: [
      {
        title: "1. Controlador de dados",
        paragraphs: [
          "O controlador responsável pelo tratamento dos dados pessoais coletados por esta plataforma e [RAZÃO SOCIAL], inscrita no CNPJ sob o número [XX.XXX.XXX/XXXX-XX], com sede em [ENDEREÇO COMPLETO, CIDADE/UF] (doravante 'Frescari').",
          "Para exercicio de direitos ou dúvidas sobre privacidade, o titular pode entrar em contato com o encarregado de dados (DPO) pelo endeco de e-mail: [EMAIL DE PRIVACIDADE].",
        ],
      },
      {
        title: "2. Dados tratados",
        paragraphs: [
          "A Frescari pode tratar dados cadastrais, dados de contato, dados de autenticação, dados operacionais de pedidos e dados necessários para viabilizar pagamentos, repasses, suporte, segurança e prevenção a fraude.",
          "Para produtores, a Frescari poderá tratar também dados de perfil profissional, nome público da fazenda ou marca, informações de cadastro inicial e dados mínimos para preenchimento financeiro.",
        ],
      },
      {
        title: "3. Finalidades e bases legais (LGPD)",
        paragraphs: [
          "Os dados pessoais são tratados para finalidades especificas, cada uma amparada por uma base legal prevista na Lei Geral de Proteção de Dados (Lei no 13.709/2018):",
        ],
        bullets: [
          "Criação e manutenção de conta, autenticação e acesso ao serviço: execução de contrato (Art. 7o, V).",
          "Processamento de pagamentos e repasses ao produtor: execução de contrato e cumprimento de obrigação legal (Art. 7o, V e II).",
          "Prevenção a fraude, segurança da informação e integridade da operação Frescari: legítimo interesse (Art. 7o, IX).",
          "Cumprimento de obrigações regulatorias, fiscais e de prevenção a lavagem de dinheiro: obrigação legal (Art. 7o, II).",
          "Comunicações transacionais (confirmação de pedido, atualização de status): execução de contrato (Art. 7o, V).",
          "Aperfeicoamento do serviço e análise de uso anonimizado: legítimo interesse (Art. 7o, IX), com respeito ao direito de oposição.",
        ],
      },
      {
        title: "4. Compartilhamento e transferência internacional",
        paragraphs: [
          "A Frescari poderá compartilhar dados com operadores e parceiros estritamente necessários para a prestação do serviço, incluindo provedores de autenticação, infraestrutura em nuvem, armazenamento de arquivos e processamento financeiro.",
          "Para viabilizar pagamentos e repasses, dados necessários a verificação financeira e validações regulatorias são compartilhados com a Stripe, Inc. (Estados Unidos). Esse compartilhamento constitui transferência internacional de dados pessoais, realizada com base nas garantias adequadas aplicáveis nos termos da LGPD e das regulamentações da ANPD.",
        ],
        bullets: [
          "O compartilhamento observa os principios de necessidade, adequação e minimização.",
          "A Frescari não compartilha dados para fins alheios ao funcionamento regular do produto sem base legal adequada.",
        ],
      },
      {
        title: "5. Retenção e segurança",
        paragraphs: [
          "Os dados serão conservados pelo prazo necessário para cumprir as finalidades de tratamento e, após o encerramento da relação contratual, pelo prazo prescricional aplicável, que pode chegar a 5 (cinco) anos nos termos do artigo 206 do Código Civil, salvo prazo maior exigido por lei especifica.",
          "A Frescari adota medidas tecnicas e organizacionais razoáveis para proteger dados pessoais contra acesso não autorizado, alteração indevida, perda, vazamento e uso abusivo, incluindo criptografia em trânsito, autenticação segura e controles de acesso por função.",
        ],
      },
      {
        title: "6. Direitos do titular",
        paragraphs: [
          "Nos termos da LGPD, o titular tem os seguintes direitos em relação aos seus dados pessoais tratados pela Frescari:",
        ],
        bullets: [
          "Confirmação da existência de tratamento e acesso aos dados.",
          "Correção de dados incompletos, inexatos ou desatualizados.",
          "Anonimização, bloqueio ou eliminação de dados desnecessarios, excessivos ou tratados em desconformidade com a lei.",
          "Portabilidade dos dados a outro fornecedor de serviço, quando aplicável.",
          "Informação sobre entidades publicas e privadas com as quais a Frescari realizou uso compartilhado de dados.",
          "Revogação do consentimento, quando o tratamento for baseado nessa base legal.",
          "Oposição ao tratamento realizado com fundamento em outras bases legais, em caso de descumprimento da lei.",
        ],
      },
      {
        title: "7. Contato, DPO e autoridade regulatoria",
        paragraphs: [
          "Solicitações relacionadas ao exercicio de direitos, dúvidas sobre tratamento e reclamações de privacidade devem ser encaminhadas ao encarregado de dados da Frescari pelo e-mail: [EMAIL DE PRIVACIDADE]. A Frescari se compromete a responder dentro do prazo razoável exigido pela LGPD.",
          "Caso o titular considere que seus direitos não foram adequadamente atendidos, pode apresentar reclamação perante a Autoridade Nacional de Proteção de Dados (ANPD), conforme previsto no artigo 18, paragrafo 1o da LGPD.",
        ],
      },
      {
        title: "8. Atualizações e lei aplicável",
        paragraphs: [
          "Este Aviso poderá ser atualizado para refletir evoluções regulatorias, tecnicas ou operacionais. Mudancas materiais serão destacadas com antecedência razoável e, quando exigirem novo consentimento, serão apresentadas ao titular antes da continuidade do tratamento.",
          "Este Aviso e regido pela Lei Geral de Proteção de Dados (Lei no 13.709/2018) e pela legislação brasileira aplicável. O foro competente para eventuais controversias e o da comarca de [CIDADE/UF].",
        ],
      },
    ],
  },
  marketplace: {
    slug: "marketplace",
    title: "Termos Comerciais",
    eyebrow: "Regras da operação comercial",
    description:
      "Regras especificas para compradores, produtores e operação comercial dentro da Frescari.",
    summary:
      "Estes Termos Comerciais regulam a utilização comercial da Frescari, definindo papeis, responsabilidades, limites operacionais e regras de publicação, negociação e execução das operações.",
    status: "Versão final — V2",
    effectiveDate: "2 de abril de 2026",
    updatedAt: "2 de abril de 2026",
    reviewNote: "",
    sections: [
      {
        title: "1. Identificação e escopo",
        paragraphs: [
          "O ambiente comercial Frescari e operado por [RAZÃO SOCIAL], CNPJ [XX.XXX.XXX/XXXX-XX], com sede em [ENDEREÇO COMPLETO, CIDADE/UF].",
          "Estes Termos Comerciais regulam especificamente as relações entre produtores e compradores intermediadas pela Frescari, complementando os Termos de Uso gerais.",
        ],
      },
      {
        title: "2. Papeis das partes",
        paragraphs: [
          "A Frescari disponibiliza a infraestrutura comercial e não substitui a responsabilidade legal, comercial, tributaria e operacional das partes pelos atos que lhes competem.",
          "O produtor e responsável pela regularidade do cadastro, pela legitimidade da oferta, pela veracidade das informações do item e pela capacidade de cumprir a operação. O comprador responde pela veracidade das informações de compra, pagamento e recebimento.",
          "A separação, o transporte e a entrega dos pedidos são de responsabilidade do produtor, que define as condições de frete da sua operação, como taxa base, valor por quilometro, raio máximo de entrega e pedido mínimo. A Frescari calcula o frete a partir dessas condições e intermedia o pagamento, mas não presta serviço de transporte.",
        ],
      },
      {
        title: "3. Ofertas, publicação e disponibilidade",
        paragraphs: [
          "A publicação de itens depende do atendimento aos requisitos tecnicos, cadastrais e financeiros definidos pela plataforma. A Frescari poderá restringir publicações quando houver pendências cadastrais, financeiras, documentais ou de segurança.",
          "Informações de produto, lote, disponibilidade, origem, peso, unidade de venda e prazo estimado devem ser mantidas atualizadas pelo produtor nos termos operacionais da plataforma.",
        ],
      },
      {
        title: "4. Produtos proibidos ou condicionados",
        paragraphs: [
          "Não e permitido utilizar a Frescari para anunciar, negociar ou circular itens vedados por lei, produtos sem regularidade mínima exigível, mercadorias de origem ilicita ou itens em desacordo com as políticas de segurança e qualidade da plataforma.",
          "São exemplos de produtos proibidos ou condicionados: alimentos sem registro sanitario aplicável, produtos de origem animal sem inspeção competente (SIF/SIE/SIM), agrotoxicos não registrados, embalagens irregulares e qualquer item cuja comercialização requeira licenca não apresentada pelo produtor.",
        ],
      },
      {
        title: "5. Disputas, cancelamentos e medidas de controle",
        paragraphs: [
          "Conflitos relacionados a pedido, divergência de informações, indisponibilidade, atraso relevante, suspeita de fraude, chargeback ou descumprimento contratual poderão levar a bloqueio preventivo de funcionalidades, retenção temporaria de valores e abertura de análise interna. A Frescari buscara responder a disputas em até 10 (dez) dias úteis contados da abertura formal da ocorrência.",
          "A Frescari poderá solicitar documentos, comprovações e registros adicionais para apuração, conciliação e resolução de disputas entre as partes.",
        ],
      },
      {
        title: "6. Compliance operacional",
        paragraphs: [
          "A utilização comercial da Frescari depende da manutenção de conta regular, verificação financeira compatível com a categoria do usuário e respeito aos fluxos de pagamento e repasse definidos pela plataforma.",
          "Produtores que não atenderem aos requisitos de cadastro, verificação, aceite e recebimentos poderão ter a operação limitada até regularização.",
        ],
      },
      {
        title: "7. Lei aplicável e foro",
        paragraphs: [
          "Estes Termos Comerciais são regidos pela legislação brasileira, incluindo o Código de Defesa do Consumidor (Lei no 8.078/1990), o Marco Civil da Internet (Lei no 12.965/2014) e demais normas aplicáveis.",
          "Fica eleito o foro da comarca de [CIDADE/UF] como competente para dirimir eventuais controversias, sem prejuizo do foro especial previsto em lei para consumidores.",
        ],
      },
    ],
  },
  "pagamentos-e-repasses": {
    slug: "pagamentos-e-repasses",
    title: "Política de Pagamentos, Comissões e Repasses",
    eyebrow: "Financeiro Frescari",
    description:
      "Como pagamentos, comissões, repasses, cancelamentos, estornos e chargebacks devem funcionar na Frescari.",
    summary:
      "Esta política define a logica financeira da plataforma, incluindo intermediação de pagamentos, cobrança de comissão, repasse ao produtor e tratamento de eventos financeiros excepcionais.",
    status: "Versão final — V2",
    effectiveDate: "2 de abril de 2026",
    updatedAt: "2 de abril de 2026",
    reviewNote: "",
    sections: [
      {
        title: "1. Identificação",
        paragraphs: [
          "Esta Política e publicada por [RAZÃO SOCIAL], CNPJ [XX.XXX.XXX/XXXX-XX], operadora da plataforma Frescari, com sede em [ENDEREÇO COMPLETO, CIDADE/UF].",
        ],
      },
      {
        title: "2. Intermediação financeira",
        paragraphs: [
          "Os pagamentos realizados na Frescari são processados por parceiro financeiro habilitado pela plataforma, conforme o fluxo técnico e regulatorio aplicável.",
          "Para produtores, o recebimento depende da criação e manutenção regular da conta de recebimento, da verificação financeira e do atendimento aos requisitos do parceiro de pagamento.",
        ],
      },
      {
        title: "3. Comissão da plataforma",
        paragraphs: [
          "A Frescari cobra uma comissão de 10% (dez por cento) sobre o valor dos produtos de cada pedido intermediado pela plataforma. A comissão não incide sobre o frete: o valor do frete e repassado integralmente ao produtor responsável pela entrega.",
          "A comissão e separada automaticamente no momento em que o pagamento do pedido e confirmado. Taxas adicionais do parceiro financeiro, instituição financeira, adquirente, bandeira, banco ou meio de pagamento podem ser descontadas conforme os termos aplicáveis e serão comunicadas ao produtor na área do produtor ou por comunicado específico.",
        ],
      },
      {
        title: "4. Repasse ao produtor",
        paragraphs: [
          "Quando o pagamento do pedido e confirmado, o valor do produtor (o valor dos produtos menos a comissão, mais o frete) e transferido automaticamente para a conta de recebimento do produtor no parceiro financeiro. Em pedidos com itens vendidos por peso, a transferência ocorre quando o produtor informa o peso final e o pagamento e capturado pelo valor real. O depósito na conta bancaria do produtor segue o calendario de repasses do parceiro financeiro.",
          "A Frescari poderá reter temporariamente valores quando houver necessidade de conciliação, investigação de fraude, contestação de pagamento, determinação regulatoria ou descumprimento material das políticas da plataforma.",
        ],
      },
      {
        title: "5. Cancelamentos, estornos e chargebacks",
        paragraphs: [
          "Quando um pedido e cancelado com estorno ao comprador, o valor transferido ao produtor e a comissão da plataforma são revertidos junto com o estorno, inclusive por debito no saldo da conta de recebimento do produtor quando o valor já tiver sido transferido. Operações objeto de chargeback poderão gerar compensações, ajustes ou debitamentos conforme o caso concreto e a responsabilidade identificada.",
          "A plataforma poderá priorizar a preservação da integridade financeira da Frescari, inclusive com bloqueio temporario de saque, ajuste de saldo ou exigência de informações adicionais.",
        ],
      },
      {
        title: "6. Limitações de operação financeira",
        paragraphs: [
          "A Frescari não garante liberação imediata de valores nem continuidade irrestrita de recebimentos quando o produtor estiver em estado de pendência cadastral, verificação, risco elevado, inconsistências documentais ou restrições impostas pelo parceiro financeiro.",
          "A conta so deve ser tratada como apta para receber quando o parceiro financeiro confirmar a habilitação efetiva de cobrança e repasse.",
        ],
      },
      {
        title: "7. Lei aplicável e foro",
        paragraphs: [
          "Esta Política e regida pela legislação brasileira, incluindo o Código de Defesa do Consumidor, a Lei de Meios de Pagamento e normas do Banco Central quando aplicáveis.",
          "Fica eleito o foro da comarca de [CIDADE/UF] para dirimir eventuais controversias, sem prejuizo do foro especial do consumidor.",
        ],
      },
    ],
  },
  "cancelamento-estorno-e-chargeback": {
    slug: "cancelamento-estorno-e-chargeback",
    title: "Política de Cancelamento, Estorno e Chargeback",
    eyebrow: "Exceções financeiras e operacionais",
    description:
      "Regras de tratamento para cancelamentos, estornos, contestações e chargebacks dentro da operação Frescari.",
    summary:
      "Esta política organiza os criterios mínimos para cancelamento de operações, estorno de valores, tratamento de chargebacks e medidas preventivas de integridade financeira na Frescari.",
    status: "Versão final — V2",
    effectiveDate: "2 de abril de 2026",
    updatedAt: "2 de abril de 2026",
    reviewNote: "",
    sections: [
      {
        title: "1. Identificação e escopo",
        paragraphs: [
          "Esta Política e publicada por [RAZÃO SOCIAL], CNPJ [XX.XXX.XXX/XXXX-XX], operadora da plataforma Frescari, com sede em [ENDEREÇO COMPLETO, CIDADE/UF].",
          "Este documento complementa os Termos Comerciais e a Política de Pagamentos, Comissões e Repasses, detalhando como a Frescari trata eventos de cancelamento, estorno, contestação e chargeback.",
        ],
      },
      {
        title: "2. Cancelamentos de operação",
        paragraphs: [
          "Pedidos poderão ser cancelados quando houver indisponibilidade material do item, divergência relevante de informações, falha de pagamento, suspeita de fraude, impossibilidade operacional comprovada ou acordo válido entre as partes.",
          "A Frescari poderá suspender temporariamente a continuidade do pedido enquanto apura documentos, histórico de comunicação, comprovações logisticas e demais evidências necessarias para decidir sobre a manutenção ou cancelamento da operação.",
        ],
        bullets: [
          "Cancelamentos antes da confirmação financeira podem resultar apenas em encerramento do pedido sem repasse.",
          "Cancelamentos após confirmação financeira poderão exigir estorno, ajuste de saldo, retenção temporaria ou compensação posterior.",
        ],
      },
      {
        title: "3. Direito de arrependimento e devolução",
        paragraphs: [
          "O consumidor tem direito ao arrependimento em até 7 (sete) dias corridos do recebimento do produto, conforme o artigo 49 do Código de Defesa do Consumidor e o artigo 5o do Decreto no 7.962/2013. Nesse caso, o reembolso integral será processado, descontadas eventuais taxas irrecuperáveis do parceiro financeiro.",
          "Para alimentos e produtos perecíveis, o exercicio do direito de arrependimento esta sujeito ao estado de conservação do produto no momento da devolução e as restrições sanitarias e logisticas aplicáveis.",
        ],
      },
      {
        title: "4. Estornos e ajustes",
        paragraphs: [
          "Quando houver devolução de valor ao comprador, a plataforma poderá realizar estorno integral ou parcial conforme a natureza do evento, a extensão do prejuizo identificado e as limitações do parceiro de pagamento.",
          "Custos de intermediação, taxas de terceiros, despesas operacionais e outros encargos associados ao evento poderão compor o cálculo final de ajuste quando isso estiver alinhado com a regra comercial vigente e com a responsabilidade apurada.",
        ],
      },
      {
        title: "5. Chargebacks e contestações",
        paragraphs: [
          "Chargebacks, contestações bancarias ou disputas abertas junto ao parceiro financeiro poderão levar a bloqueio preventivo de repasses, reserva de saldo, solicitação de documentos e restrição temporaria de funcionalidades da conta envolvida.",
          "A Frescari poderá consolidar comprovantes, histórico transacional, registros de entrega e evidências operacionais para subsidiar a defesa da transação ou reconhecer a necessidade de ajuste financeiro.",
        ],
      },
      {
        title: "6. Medidas de integridade financeira",
        paragraphs: [
          "Sempre que houver risco razoável de perda, fraude, reincidência ou inconsistências materiais, a plataforma poderá reter valores, interromper novos recebimentos, exigir regularização documental ou limitar saques e repasses até a conclusão da análise.",
          "Essas medidas poderão ser adotadas mesmo antes da definição final da disputa quando forem necessarias para proteger compradores, produtores, a própria operação da Frescari e o equilibrio financeiro da plataforma.",
        ],
      },
      {
        title: "7. Cooperação das partes",
        paragraphs: [
          "Compradores e produtores devem colaborar com a apuração, apresentando informações verdadeiras, documentos solicitados e histórico suficiente para conciliação da ocorrência em prazo razoável.",
          "A omissão de dados, a apresentação de informações inverídicas ou a recusa injustificada em cooperar poderão influenciar a decisão operacional da plataforma e a manutenção das medidas preventivas aplicadas.",
        ],
      },
      {
        title: "8. Lei aplicável e foro",
        paragraphs: [
          "Esta Política e regida pela legislação brasileira, em especial pelo Código de Defesa do Consumidor (Lei no 8.078/1990) e pelo Decreto no 7.962/2013.",
          "Fica eleito o foro da comarca de [CIDADE/UF] para dirimir eventuais controversias, sem prejuizo do foro especial do consumidor.",
        ],
      },
    ],
  },
  cookies: {
    slug: "cookies",
    title: "Política de Cookies",
    eyebrow: "Sessão, autenticação e segurança",
    description:
      "Como a Frescari utiliza cookies estritamente necessários para autenticação, continuidade da sessão e proteção básica da operação.",
    summary:
      "Na versão atual da Frescari, o uso de cookies esta concentrado em autenticação, continuidade de sessão e segurança operacional. Não ha, nesta etapa, ativação de cookies de publicidade ou medição não essencial.",
    status: "Versão final — V2",
    effectiveDate: "2 de abril de 2026",
    updatedAt: "2 de abril de 2026",
    reviewNote: "",
    sections: [
      {
        title: "1. Identificação",
        paragraphs: [
          "Esta Política de Cookies e publicada por [RAZÃO SOCIAL], CNPJ [XX.XXX.XXX/XXXX-XX], operadora da plataforma Frescari, com sede em [ENDEREÇO COMPLETO, CIDADE/UF].",
        ],
      },
      {
        title: "2. O que são cookies",
        paragraphs: [
          "Cookies são pequenos arquivos ou identificadores associados ao navegador para viabilizar funcionalidades tecnicas, lembrar estados de navegação e reforcar controles de segurança.",
          "No contexto atual da Frescari, eles são usados de forma restrita para manter a experiência autenticada e proteger fluxos sensíveis do produto.",
        ],
      },
      {
        title: "3. Cookies atualmente utilizados",
        paragraphs: [
          "A aplicação web utiliza exclusivamente cookies estritamente necessários para autenticar o usuário, manter a sessão ativa, encerrar o acesso com segurança e apoiar controles basicos contra abuso do fluxo autenticado.",
          "Esses cookies não são usados, nesta versão do produto, para publicidade comportamental, remarketing ou medição não essencial na experiência publica.",
        ],
        bullets: [
          "Cookies de sessão e autenticação para manter o usuário conectado (HttpOnly, Secure, SameSite=Lax).",
          "Cookies tecnicos para continuidade do login e encerramento seguro da sessão.",
          "Cookies relacionados a segurança operacional do fluxo autenticado, quando aplicável.",
        ],
      },
      {
        title: "4. Base legal para uso de cookies essenciais",
        paragraphs: [
          "O uso de cookies estritamente necessários não requer consentimento previo, pois e indispensável para a prestação do serviço solicitado pelo usuário, conforme o artigo 7o, inciso V da LGPD (execução de contrato) e as diretrizes da ANPD sobre cookies tecnicos.",
          "Sem esses cookies, funcionalidades como entrar na conta, permanecer autenticado, concluir verificações de acesso e navegar por áreas protegidas podem deixar de funcionar corretamente.",
        ],
      },
      {
        title: "5. Preferências futuras e atualizações",
        paragraphs: [
          "Caso a Frescari venha a introduzir cookies não estritamente necessários, como mensuração, personalização opcional ou publicidade, esta política será atualizada com transparência e, quando exigido, será solicitado consentimento específico antes da ativação desses recursos.",
          "Mudancas materiais nesta política serão destacadas no produto ou em canais oficiais.",
        ],
      },
      {
        title: "6. Lei aplicável e foro",
        paragraphs: [
          "Esta Política e regida pela legislação brasileira, em especial pela LGPD (Lei no 13.709/2018) e pelo Marco Civil da Internet (Lei no 12.965/2014).",
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
  { href: "/marketplace", label: "Termos Comerciais", slug: "marketplace" },
  {
    href: "/pagamentos-e-repasses",
    label: "Pagamentos, Comissões e Repasses",
    slug: "pagamentos-e-repasses",
  },
  {
    href: "/cancelamento-estorno-e-chargeback",
    label: "Cancelamento, Estorno e Chargeback",
    slug: "cancelamento-estorno-e-chargeback",
  },
  {
    href: "/cookies",
    label: "Política de Cookies",
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
