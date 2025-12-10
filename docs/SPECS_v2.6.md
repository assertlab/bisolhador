# Especificação Técnica v2.6.0: O Bisolhômetro (Leaderboard)

## 1\. Visão Geral

Transformar o Bisolhador em uma plataforma de inteligência histórica.
Arquitetura: Log Imutável no Supabase, capturando um **Snapshot Completo** das métricas a cada análise.

## 2\. Dados (Supabase)

### 2.1. Tabela analytics\_searches (Schema Expandido)

A tabela deve capturar o estado do repositório no momento da busca (Append-Only). Cada linha representa o estado do repositório no momento da busca.

**Identificação:**

  * `repo_name` (text)
  * `owner_type` (text): "Organization" | "User"
  * `language` (text)
  * `status` (text): "success" | "error"

**Snapshot de Volume (GitHub):**

  * `stars` (int8)
  * `forks` (int8)
  * `open_issues` (int8)
  * `subscribers` (int8)
  * `last_push_at` (timestamp)

**Snapshot de Qualidade (Bisolhador KPIs):**

  * `health_score` (int2): 0-100 (Nota de governança)
  * `bus_factor_risk` (text): "High" | "Low"

### 2.2. Agregação (RPC - get\_leaderboard)

  * Query SQL para consolidar o ranking. A query deve ser capaz de mostrar: "Repositório X (Java) - Nota A (Health 95) - 500 Buscas".
  * **Métrica de Ranking:** Volume total de buscas (`COUNT`).
  * **Exibição:** Metadados do registro mais recente (`ORDER BY created_at DESC LIMIT 1`).

## 3\. Frontend

### 3.1. Coleta (analytics.js)

  * Atualizar `trackSearch` para receber o objeto consolidado de métricas (incluindo o Health Score calculado) antes de enviar para o Supabase.

### 3.2. Interface (/ranking)

  * Nova página com Tabela de Leaderboard.
  * Colunas: Posição, Repositório, Linguagem, Nota de Saúde, Estrelas, Total de Bisolhadas.
  * Filtros: Por linguagem ou período (se viável).
