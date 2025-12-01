# Bisolhador Design System (v1.0)

## 1\. Filosofia

Utilizamos **Tailwind CSS** com os padrões visuais do **Flowbite**, mas implementados em **Vanilla JS** (HTML Strings). Não utilizamos componentes React/Vue.

## 2\. Paleta de Cores (Tailwind Config)

As cores devem ser configuradas no `tailwind.config` do script CDN:

  * **Primary (Shark):** `#0f172a` (Backgrounds de Header, Sidebars).
  * **Action (Ocean):** `#0ea5e9` (Botões principais, Links, Destaques).
  * **Alert (Coral):** `#f97316` (Alertas de Crunch, Bus Factor).
  * **Background:** `bg-gray-50` (Fundo da página).
  * **Surface:** `bg-white` (Fundo de Cards).

## 3\. Componentes Padrão

### Cards (Container)

Todo card deve ser gerado pela função `uiHelpers.createCard`.

  - **Estilo:** `bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow`.
  - **Comportamento:** `relative overflow-visible hover:z-50` (para suportar Tooltips).

### Botões

  - **Primary:** `text-white bg-ocean hover:bg-sky-600 focus:ring-4 focus:ring-sky-300 font-medium rounded-lg text-sm px-5 py-2.5`.
  - **Secondary/Light:** `text-gray-900 bg-white border border-gray-300 hover:bg-gray-100`.

### Badges (Pílulas)

  - Use as classes do Flowbite: `bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded`.
  - **v1.2.0**: Engineering Maturity badges com cores dinâmicas (verde/vermelho) para zombies e infraestrutura.

### Tooltips

  - Gerados via `uiHelpers.createTooltip(text)` com regras explícitas de classificação.
  - Estilo: `absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-white text-xs p-2 rounded w-64 z-50`.
  - Conteúdo educacional: Critérios exatos para cada métrica (ex: "Risco de Atenção se > 40% dos commits").

## 4\. Tipografia

  - Fonte Padrão: System UI / Sans-serif do Tailwind.
  - Títulos de Cards: `text-xl font-bold tracking-tight text-gray-900`.
