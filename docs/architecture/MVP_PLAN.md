# Plano do Produto: Visão de MVP e Escopo (Frescari)

Decidimos refinar e cortar o escopo do nosso MVP para focar estritamente no **tempo-até-o-valor (Time to Value)** e na geração de receita. A prioridade atual é viabilizar operações financeiras e logísticas com o mínimo de fricção tecnológica, eliminando qualquer excesso de engenharia (feature creep) no curto prazo.

---

## V1 (MVP Atual)

O foco da V1 é lançar uma plataforma web robusta, centrada no gerenciamento de compras e captura correta de pagamentos.

### Stack e Funcionalidades Core
- **Client & Backend Córtex:** Next.js Web App
- **Camada de API:** tRPC
- **Banco de Dados & ORM:** PostgreSQL padrão + Drizzle ORM
- **Fluxo Financeiro (Stripe Connect):** 
  - Subdivisão de Receitas com **Destination Charges**.
  - Etapa de **Pesagem de Produtos (Weighing Station)** utilizando `capture_method: 'manual'` para aprovar em pré-autorização e capturar estritamente o valor do peso aferido pelo operador.

> **Importante:** Durante todo o desenvolvimento da V1, é estritamente vetado o desenvolvimento de aplicações nativas, bem como a ingestão de lógicas que dependam de filas assíncronas (background queues) para evitar sobrecarga de infraestrutura. Toda lógica deve priorizar chamadas síncronas/web-first.

---

## V2 (Roadmap Futuro)

O desenvolvimento das tecnologias e lógicas abaixo ficará retido até a maturação comercial da V1 e representam a fundação técnica do próximo ciclo (V2):

### Avanços Tecnológicos e Operacionais Reservados
- **Ecossistema Mobile:** Lançamento de App Mobile focado em operações diretas com arquitetura offline-first através de **React Native / Expo SQLite**.
- **Processamento Assíncrono:** Implementação de sistemas de métricas em background e cálculo avançado (como o `freshness_score`) suportados por **BullMQ + Redis**.
- **Geolocalização Avançada:** Expansão do banco de dados para suportar cálculos de distância inteligente e roteamento geoespacial de frota utilizando a extensão **PostGIS**.
