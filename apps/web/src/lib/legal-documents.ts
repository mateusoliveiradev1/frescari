import type { Metadata } from "next";

export const LEGAL_VERSION = "2026-03-23-v1";

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
  updatedAt: string;
  reviewNote: string;
  sections: LegalSection[];
};

const legalDocuments = {
  termos: {
    slug: "termos",
    title: "Termos de Uso",
    eyebrow: "Base contratual geral",
    description:
      "Regras gerais de acesso e uso da plataforma Frescari por compradores, produtores e administradores.",
    summary:
      "Estes Termos de Uso disciplinam o acesso ao aplicativo, a criacao de conta, o uso das funcionalidades da plataforma e as regras gerais de conduta dentro da Frescari.",
    status: "Versao interna V1 para revisao juridica",
    effectiveDate: "21 de marco de 2026",
    updatedAt: "21 de marco de 2026",
    reviewNote:
      "Documento publicado para validacao interna e revisao do advogado antes da abertura do dominio publico final.",
    sections: [
      {
        title: "1. Plataforma e escopo",
        paragraphs: [
          "A Frescari opera como plataforma digital de intermediacao entre produtores, compradores e administradores do marketplace, oferecendo infraestrutura de cadastro, descoberta, negociacao, pagamento e gestao operacional.",
          "A utilizacao da plataforma depende de conta valida, observancia destes Termos de Uso e respeito a todas as politicas complementares publicadas pela Frescari.",
        ],
      },
      {
        title: "2. Cadastro e acesso",
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
        title: "3. Regras de conduta",
        paragraphs: [
          "E vedado usar a plataforma para fraudar operacoes, manipular precos, burlar controles de acesso, publicar conteudo enganoso ou praticar qualquer conduta contraria a lei, a boa-fe ou as politicas da Frescari.",
          "Tambem e vedado tentar explorar falhas tecnicas, automatizar acessos nao autorizados, utilizar dados de terceiros sem base legal ou praticar condutas que comprometam a confianca do marketplace.",
        ],
      },
      {
        title: "4. Disponibilidade e alteracoes",
        paragraphs: [
          "A Frescari podera evoluir, ajustar, restringir ou descontinuar funcionalidades para fins de seguranca, adequacao regulatoria, manutencao tecnica ou melhoria de produto.",
          "Quando houver alteracoes materiais nestes Termos, a plataforma podera exigir novo aceite antes da continuidade da operacao.",
        ],
      },
      {
        title: "5. Suspensao, limitacao e encerramento",
        paragraphs: [
          "A Frescari podera limitar funcionalidades, bloquear acessos, suspender contas ou encerrar relacoes de uso quando houver descumprimento contratual, risco de fraude, exigencia regulatoria, disputa operacional relevante ou uso indevido da plataforma.",
          "Sempre que possivel e compativel com a seguranca do sistema, a plataforma apresentara comunicacao do motivo e orientacao sobre eventual regularizacao.",
        ],
      },
      {
        title: "6. Responsabilidade geral",
        paragraphs: [
          "A Frescari envidara esforcos tecnicos e operacionais razoaveis para manter a plataforma disponivel, segura e funcional, sem assumir garantia absoluta de funcionamento ininterrupto ou livre de erros.",
          "Cada usuario responde pelas informacoes que fornece, pelas obrigacoes legais e tributarias que lhe cabem e pela regularidade da propria atuacao dentro do marketplace.",
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
    status: "Versao interna V1 para revisao juridica",
    effectiveDate: "21 de marco de 2026",
    updatedAt: "21 de marco de 2026",
    reviewNote:
      "Documento preparado para revisao juridica com foco em LGPD, operacao de marketplace e integracoes essenciais.",
    sections: [
      {
        title: "1. Dados tratados",
        paragraphs: [
          "A Frescari pode tratar dados cadastrais, dados de contato, dados de autenticacao, dados operacionais de pedidos e dados necessarios para viabilizar pagamentos, repasses, suporte, seguranca e prevencao a fraude.",
          "Para produtores, a plataforma podera tratar tambem dados de perfil profissional, nome publico da fazenda ou marca, informacoes de onboarding e dados minimos para prefill de integracoes financeiras.",
        ],
      },
      {
        title: "2. Finalidades de tratamento",
        paragraphs: [
          "Os dados pessoais sao tratados para criar e manter contas, autenticar usuarios, viabilizar a experiencia de compra e venda, processar pagamentos, cumprir obrigacoes legais, prevenir abuso e manter trilhas de auditoria.",
          "A Frescari tambem podera usar dados para comunicacoes transacionais, suporte ao usuario, seguranca da informacao, investigacao de incidentes e aperfeicoamento do servico.",
        ],
      },
      {
        title: "3. Compartilhamento",
        paragraphs: [
          "A Frescari podera compartilhar dados com operadores e parceiros estritamente necessarios para a prestacao do servico, incluindo provedores de autenticacao, infraestrutura, observabilidade e processamento financeiro.",
          "Quando houver fluxo de recebimentos e pagamentos, dados necessarios poderao ser compartilhados com a Stripe para onboarding, validacoes regulatorias, processamento de pagamentos e repasses.",
        ],
        bullets: [
          "O compartilhamento deve observar necessidade, adequacao e minimizacao.",
          "A Frescari nao deve compartilhar dados para fins alheios ao funcionamento regular do produto sem base legal adequada.",
        ],
      },
      {
        title: "4. Retencao e seguranca",
        paragraphs: [
          "Os dados serao conservados pelo prazo necessario para cumprir finalidades legitimas, obrigacoes legais, defesa em processos, prevencao a fraude e continuidade operacional da plataforma.",
          "A Frescari adota medidas tecnicas e organizacionais razoaveis para proteger dados pessoais contra acesso nao autorizado, alteracao indevida, perda, vazamento e uso abusivo.",
        ],
      },
      {
        title: "5. Direitos do titular",
        paragraphs: [
          "O titular pode solicitar confirmacao de tratamento, acesso, correcao, anonimizacao, portabilidade quando cabivel, informacoes sobre compartilhamento e revisao de dados inexatos, conforme a legislacao aplicavel.",
          "Pedidos relacionados a direitos do titular serao avaliados pela Frescari conforme a natureza da solicitacao, a base legal envolvida e os limites tecnicos e juridicos aplicaveis.",
        ],
      },
      {
        title: "6. Contato e atualizacoes",
        paragraphs: [
          "Demandas sobre privacidade, exercicio de direitos e duvidas sobre tratamento de dados poderao ser encaminhadas pelos canais oficiais de suporte e governanca definidos pela Frescari.",
          "Este Aviso podera ser atualizado para refletir evolucoes regulatorias, tecnicas ou operacionais, com destaque para mudancas materiais quando aplicavel.",
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
    status: "Versao interna V1 para revisao juridica",
    effectiveDate: "21 de marco de 2026",
    updatedAt: "21 de marco de 2026",
    reviewNote:
      "Documento orientado a operacao de marketplace e preparado para refinamento juridico e comercial.",
    sections: [
      {
        title: "1. Papeis das partes",
        paragraphs: [
          "A Frescari disponibiliza a infraestrutura do marketplace e nao substitui a responsabilidade legal, comercial, tributaria e operacional das partes pelos atos que lhes competem.",
          "O produtor e responsavel pela regularidade do cadastro, pela legitimidade da oferta, pela veracidade das informacoes do item e pela capacidade de cumprir a operacao. O comprador responde pela veracidade das informacoes de compra, pagamento e recebimento.",
        ],
      },
      {
        title: "2. Ofertas, publicacao e disponibilidade",
        paragraphs: [
          "A publicacao de itens depende do atendimento aos requisitos tecnicos, cadastrais e financeiros definidos pela plataforma. A Frescari podera restringir publicacoes quando houver pendencias cadastrais, financeiras, documentais ou de seguranca.",
          "Informacoes de produto, lote, disponibilidade, origem, peso, unidade de venda e prazo estimado devem ser mantidas atualizadas pelo produtor nos termos operacionais da plataforma.",
        ],
      },
      {
        title: "3. Produtos proibidos ou condicionados",
        paragraphs: [
          "Nao e permitido utilizar a Frescari para anunciar, negociar ou circular itens vedados por lei, produtos sem regularidade minima exigivel, mercadorias de origem ilicita ou itens em desacordo com as politicas de seguranca e qualidade da plataforma.",
          "A Frescari podera manter listas de categorias proibidas, condicionadas ou sujeitas a verificacoes adicionais antes da liberacao comercial.",
        ],
      },
      {
        title: "4. Disputas, cancelamentos e medidas de controle",
        paragraphs: [
          "Conflitos relacionados a pedido, divergencia de informacoes, indisponibilidade, atraso relevante, suspeita de fraude, chargeback ou descumprimento contratual poderao levar a bloqueio preventivo de funcionalidades, retencao temporaria de valores e abertura de analise interna.",
          "A Frescari podera solicitar documentos, comprovacoes e registros adicionais para apuracao, conciliacao e resolucao de disputas entre as partes.",
        ],
      },
      {
        title: "5. Compliance operacional",
        paragraphs: [
          "A utilizacao comercial do marketplace depende da manutencao de conta regular, onboarding financeiro compativel com a categoria do usuario e respeito aos fluxos de pagamento e repasse definidos pela plataforma.",
          "Produtores que nao atenderem aos requisitos de cadastro, verificacao, aceite e recebimentos poderao ter a operacao limitada ate regularizacao.",
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
    status: "Versao interna V1 para revisao juridica",
    effectiveDate: "21 de marco de 2026",
    updatedAt: "21 de marco de 2026",
    reviewNote:
      "Versao inicial preparada para revisao do advogado e refinamento das condicoes comerciais efetivamente adotadas no go-live.",
    sections: [
      {
        title: "1. Intermediacao financeira",
        paragraphs: [
          "Os pagamentos realizados na Frescari podem ser processados por parceiro de pagamentos habilitado pela plataforma, inclusive via Stripe Connect, conforme o fluxo tecnico e regulatorio aplicavel.",
          "Para produtores, o recebimento depende da criacao e manutencao regular da conta conectada, do onboarding financeiro e do atendimento aos requisitos do parceiro de pagamento.",
        ],
      },
      {
        title: "2. Comissao da plataforma",
        paragraphs: [
          "A Frescari podera cobrar comissao, taxa de servico, tarifa operacional ou combinacao equivalente sobre as operacoes intermediadas pela plataforma.",
          "A taxa aplicavel, sua base de calculo e eventuais abatimentos ou condicoes comerciais devem ser informados de forma clara ao produtor no fluxo comercial correspondente, no dashboard ou em instrumento complementar valido.",
        ],
        bullets: [
          "A comissao pode incidir sobre o valor bruto da operacao, sobre parcela previamente definida ou conforme modelo comercial vigente.",
          "Taxas de terceiros, custos de chargeback, estornos ou retencoes poderao ser descontados conforme regra aplicavel e divulgada ao produtor.",
        ],
      },
      {
        title: "3. Repasse ao produtor",
        paragraphs: [
          "O repasse ao produtor depende da regularidade da conta conectada, da confirmacao da operacao, da ausencia de bloqueios de seguranca, da inexistencia de disputa impeditiva e do calendario operacional do parceiro de pagamento.",
          "A Frescari podera reter temporariamente valores quando houver necessidade de conciliacao, investigacao de fraude, contestacao de pagamento, determinacao regulatoria ou descumprimento material das politicas da plataforma.",
        ],
      },
      {
        title: "4. Cancelamentos, estornos e chargebacks",
        paragraphs: [
          "Operacoes canceladas, estornadas ou objeto de chargeback poderao afetar a disponibilidade de repasse e gerar compensacoes, ajustes ou debitamentos conforme o caso concreto e a responsabilidade identificada.",
          "A plataforma podera priorizar a preservacao da integridade financeira do marketplace, inclusive com bloqueio temporario de saque, ajuste de saldo ou exigencia de informacoes adicionais.",
        ],
      },
      {
        title: "5. Limitacoes de operacao financeira",
        paragraphs: [
          "A Frescari nao garante liberacao imediata de valores nem continuidade irrestrita de recebimentos quando o produtor estiver em estado de pendencia cadastral, verificacao, risco elevado, inconsistencias documentais ou restricoes impostas pelo parceiro financeiro.",
          "A conta so deve ser tratada como apta para receber quando o estado operacional indicar habilitacao efetiva de cobranca e repasse.",
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
    status: "Versao interna V1 para revisao juridica",
    effectiveDate: "23 de marco de 2026",
    updatedAt: "23 de marco de 2026",
    reviewNote:
      "Documento publicado para separar as regras de excecao financeira do restante da politica comercial e facilitar a revisao juridica do go-live.",
    sections: [
      {
        title: "1. Escopo e aplicacao",
        paragraphs: [
          "Esta politica complementa os Termos do Marketplace e a Politica de Pagamentos, Comissoes e Repasses, detalhando como a Frescari podera tratar eventos de cancelamento, estorno, contestacao e chargeback.",
          "A aplicacao concreta dependera da etapa da operacao, dos registros disponiveis, da responsabilidade identificada entre as partes e das regras do parceiro financeiro utilizado no fluxo.",
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
        title: "3. Estornos e ajustes",
        paragraphs: [
          "Quando houver devolucao de valor ao comprador, a plataforma podera realizar estorno integral ou parcial conforme a natureza do evento, a extensao do prejuizo identificado e as limitacoes do parceiro de pagamento.",
          "Custos de intermediacao, taxas de terceiros, despesas operacionais e outros encargos associados ao evento poderao compor o calculo final de ajuste quando isso estiver alinhado com a regra comercial vigente e com a responsabilidade apurada.",
        ],
      },
      {
        title: "4. Chargebacks e contestacoes",
        paragraphs: [
          "Chargebacks, contestacoes bancarias ou disputas abertas junto ao parceiro financeiro poderao levar a bloqueio preventivo de repasses, reserva de saldo, solicitacao de documentos e restricao temporaria de funcionalidades da conta envolvida.",
          "A Frescari podera consolidar comprovantes, historico transacional, registros de entrega e evidencias operacionais para subsidiar a defesa da transacao ou reconhecer a necessidade de ajuste financeiro.",
        ],
      },
      {
        title: "5. Medidas de integridade financeira",
        paragraphs: [
          "Sempre que houver risco razoavel de perda, fraude, reincidencia ou inconsistencias materiais, a plataforma podera reter valores, interromper novos recebimentos, exigir regularizacao documental ou limitar saques e repasses ate a conclusao da analise.",
          "Essas medidas poderao ser adotadas mesmo antes da definicao final da disputa quando forem necessarias para proteger compradores, produtores, a propria operacao da Frescari e o equilibrio financeiro do marketplace.",
        ],
      },
      {
        title: "6. Cooperacao das partes",
        paragraphs: [
          "Compradores e produtores devem colaborar com a apuracao, apresentando informacoes verdadeiras, documentos solicitados e historico suficiente para conciliacao da ocorrencia em prazo razoavel.",
          "A omissao de dados, a apresentacao de informacoes inveridicas ou a recusa injustificada em cooperar poderao influenciar a decisao operacional da plataforma e a manutencao das medidas preventivas aplicadas.",
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
    status: "Versao interna V1 para revisao juridica",
    effectiveDate: "23 de marco de 2026",
    updatedAt: "23 de marco de 2026",
    reviewNote:
      "Documento preparado para registrar o estado atual do produto. Se a Frescari vier a ativar cookies nao essenciais, esta politica e os fluxos de consentimento deverao ser revisitados antes da publicacao.",
    sections: [
      {
        title: "1. O que sao cookies",
        paragraphs: [
          "Cookies sao pequenos arquivos ou identificadores associados ao navegador para viabilizar funcionalidades tecnicas, lembrar estados de navegacao e reforcar controles de seguranca.",
          "No contexto atual da Frescari, eles sao usados de forma restrita para manter a experiencia autenticada e proteger fluxos sensiveis do produto.",
        ],
      },
      {
        title: "2. Cookies atualmente utilizados",
        paragraphs: [
          "A aplicacao web utiliza cookies estritamente necessarios para autenticar o usuario, manter a sessao ativa, encerrar o acesso com seguranca e apoiar controles basicos contra abuso do fluxo autenticado.",
          "Esses cookies nao sao usados, nesta versao do produto, para publicidade comportamental, remarketing ou analytics nao essenciais no front-end publico da aplicacao.",
        ],
        bullets: [
          "cookies de sessao e autenticacao para manter o usuario conectado",
          "cookies tecnicos para continuidade do login e encerramento seguro da sessao",
          "cookies relacionados a seguranca operacional do fluxo autenticado, quando aplicavel",
        ],
      },
      {
        title: "3. Base e finalidade de uso",
        paragraphs: [
          "O uso desses cookies e justificado pela necessidade tecnica de prestar o servico solicitado pelo usuario, viabilizar acesso autenticado a areas restritas e preservar a seguranca minima da operacao.",
          "Sem esses cookies, funcionalidades como entrar na conta, permanecer autenticado, concluir verificacoes de acesso e navegar por areas protegidas podem deixar de funcionar corretamente.",
        ],
      },
      {
        title: "4. Preferencias futuras e atualizacoes",
        paragraphs: [
          "Caso a Frescari venha a introduzir cookies nao estritamente necessarios, como mensuracao, analytics, personalizacao opcional ou publicidade, a politica devera ser atualizada com transparencia antes da ativacao desses recursos.",
          "Mudancas materiais nesta politica poderao ser destacadas no produto ou em canais oficiais, especialmente quando exigirem novo mecanismo de consentimento ou configuracao de preferencias.",
        ],
      },
    ],
  },
} satisfies Record<LegalDocumentSlug, LegalDocument>;

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
  return legalDocuments[slug];
}

export function createLegalMetadata(slug: LegalDocumentSlug): Metadata {
  const document = getLegalDocument(slug);

  return {
    title: `${document.title} | Frescari`,
    description: document.description,
    robots: {
      index: false,
      follow: false,
    },
  };
}
