# Diretrizes de Desenvolvimento para WhatsFeedback

Este documento descreve o stack tecnológico e as regras de uso de bibliotecas para o projeto WhatsFeedback, visando manter a consistência, qualidade e manutenibilidade do código.

## Stack Tecnológico

*   **Frontend Framework**: React
*   **Linguagem**: TypeScript
*   **Build Tool**: Vite
*   **Estilização**: Tailwind CSS
*   **Componentes UI**: shadcn/ui (baseado em Radix UI)
*   **Roteamento**: React Router
*   **Gerenciamento de Estado (Server)**: React Query
*   **Backend-as-a-Service**: Supabase (Autenticação, Banco de Dados, Edge Functions, Storage)
*   **Ícones**: Lucide React
*   **Manipulação de Datas**: date-fns
*   **Validação de Formulários**: React Hook Form com Zod

## Regras de Uso de Bibliotecas

Para garantir a padronização e eficiência, siga as seguintes regras ao desenvolver:

*   **Componentes de UI**:
    *   **Prioridade**: Sempre utilize os componentes do `shadcn/ui`.
    *   **Extensão**: Se um componente específico não estiver disponível no `shadcn/ui`, utilize as primitivas do `Radix UI` diretamente.
    *   **Customização**: Evite modificar arquivos de componentes do `shadcn/ui` ou `Radix UI`. Se precisar de uma variação, crie um novo componente em `src/components/`.
*   **Estilização**:
    *   **Exclusividade**: Use `Tailwind CSS` para toda a estilização. Evite CSS inline ou arquivos CSS separados para componentes, exceto para estilos globais em `src/index.css`.
    *   **Responsividade**: Sempre projete interfaces responsivas utilizando as classes utilitárias do Tailwind.
*   **Ícones**:
    *   **Padrão**: Utilize exclusivamente os ícones da biblioteca `lucide-react`.
*   **Roteamento**:
    *   **Biblioteca**: Use `react-router-dom` para todas as rotas da aplicação.
    *   **Localização**: Mantenha a definição das rotas principais no arquivo `src/App.tsx`.
*   **Gerenciamento de Estado (Server State)**:
    *   **Dados do Servidor**: Para operações de busca, cache, sincronização e atualização de dados do servidor (APIs, Supabase), utilize `@tanstack/react-query`.
*   **Gerenciamento de Estado (Client State)**:
    *   **Estado Local**: Para o estado interno de componentes ou estado global simples, utilize os hooks nativos do React (`useState`, `useReducer`).
*   **Formulários**:
    *   **Validação**: Implemente formulários utilizando `react-hook-form` em conjunto com `@hookform/resolvers` e `zod` para validação de esquemas.
*   **Datas**:
    *   **Manipulação**: Para formatação, cálculo e qualquer outra operação com datas, utilize a biblioteca `date-fns`.
*   **Notificações**:
    *   **Toasts**: Utilize `sonner` para exibir notificações de feedback ao usuário (toasts).
*   **Interação com Backend**:
    *   **Supabase**: Todas as interações com o backend (autenticação, banco de dados, storage, edge functions) devem ser feitas através do cliente `supabase` (`@supabase/supabase-js`).
*   **Estrutura de Arquivos**:
    *   `src/pages/`: Para componentes que representam páginas completas da aplicação.
    *   `src/components/`: Para componentes de UI reutilizáveis.
    *   `src/hooks/`: Para hooks React personalizados.
    *   `src/lib/`: Para funções utilitárias e helpers.
    *   `src/integrations/`: Para o cliente Supabase e definições de tipos.
*   **Tratamento de Erros**:
    *   **Propagação**: Em geral, permita que os erros se propaguem para serem tratados em um nível superior, a menos que seja necessário um tratamento específico para feedback ao usuário (ex: `toast.error`). Evite blocos `try/catch` excessivos.