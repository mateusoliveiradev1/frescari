# 🍅 Frescari

**O Marketplace Moderno de Hortifruti B2B/B2C**

Frescari é uma plataforma inovadora que conecta produtores rurais diretamente a compradores corporativos e consumidores finais, eliminando atravessadores e garantindo produtos mais frescos com as melhores margens.

---

## 🚀 Nossa Missão

Conectar o campo à mesa de forma direta e sem atritos. O Frescari capacita os produtores a gerenciar seus estoques e digitalizar suas vendas, enquanto oferece aos compradores uma experiência de compra ágil, transparente e moderna.

## 🛠️ Stack Tecnológica

O projeto foi construído utilizando as melhores e mais modernas ferramentas do ecossistema JavaScript/TypeScript:

*   **Framework:** Next.js App Router
*   **Comunicação API:** tRPC
*   **Banco de Dados & ORM:** PostgreSQL hospedado no Neon & Drizzle ORM
*   **Estilização:** Tailwind CSS v4
*   **Componentes UI:** shadcn/ui & @radix-ui
*   **Autenticação:** Better Auth

## 📦 Como rodar o projeto localmente

Siga os passos abaixo para configurar o ambiente de desenvolvimento em sua máquina local.

### 1. Pré-requisitos

*   [Node.js](https://nodejs.org/en/) (versão 20 ou superior)
*   [pnpm](https://pnpm.io/) (gerenciador de pacotes rápido e eficiente)
*   Uma conta no [Neon](https://neon.tech/) para provisionar o banco de dados PostgreSQL.

### 2. Configuração do Projeto

```bash
# 1. Clone o repositório
git clone https://github.com/mateusoliveiradev1/frescari.git
cd frescari

# 2. Instale as dependências usando o pnpm
pnpm install

# 3. Configure as variáveis de ambiente
# Copie o arquivo .env.example para um novo arquivo .env na pasta raiz do projeto.
# Preencha a URL do seu banco de dados PostgreSQL do Neon e as chaves do BetterAuth.
# cp .env.example .env

# 4. Rode as migrações do banco de dados com o Drizzle
pnpm run db:push

# 5. Inicie o servidor de desenvolvimento
pnpm run dev
```

### 3. Acessando a Aplicação

Abra o seu navegador e acesse `http://localhost:3000`.

---
Desenvolvido com 💚 para transformar o agronegócio.
