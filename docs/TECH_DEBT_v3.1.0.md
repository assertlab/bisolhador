# Tech Debt Report - Bisolhador v3.1.0

> Revisado em: 2026-02-13 | Escopo: `src/` completo | Foco: DRY, Complexidade, Performance, Dead Code, Segurança

---

## Sumário Executivo

| Prioridade | Itens | Impacto |
|------------|-------|---------|
| **Alta** | 8 | Bugs em produção, re-renders pesados, UX degradada |
| **Média** | 9 | Manutenibilidade, violações DRY, magic numbers |
| **Baixa** | 5 | Limpeza, documentação, padronização |

---

## Alta Prioridade

### A1. BUG: `useChartTheme` retorna propriedades incompletas

**Arquivo:** `src/hooks/useChartTheme.js:24-27`

O hook retorna apenas `{ textColor, gridColor }`, mas **3 componentes** acessam `tooltipBg` e `tooltipText` (que resultam em `undefined`):

- `src/pages/Timeline.jsx:143-145`
- `src/components/charts/BenchmarkEvolutionChart.jsx:70-72`
- `src/components/charts/BenchmarkComparisonChart.jsx:100-102`

**Impacto:** Tooltips dos charts sem cores de fundo/texto em dark mode — falha visual silenciosa.

**Fix:** Adicionar ao hook:
```js
tooltipBg: isDark ? '#1e293b' : '#ffffff',
tooltipText: isDark ? '#e5e7eb' : '#1f2937',
```

---

### A2. Performance: `chartData` e `chartOptions` recriados a cada render

Objetos de configuração Chart.js são recriados sem `useMemo`, causando re-render completo do canvas a cada ciclo React.

| Arquivo | Linhas | Objeto |
|---------|--------|--------|
| `src/pages/Timeline.jsx` | 86-192 | `chartData`, `chartOptions` |
| `src/components/charts/BenchmarkEvolutionChart.jsx` | 25-129 | `datasets`, `chartData`, `chartOptions` |
| `src/components/charts/CommitActivityChart.jsx` | 80 | `chartData` (atribuição direta sem memo) |

**Impacto:** Chart.js destrói e recria o canvas a cada render do pai. Perceptível com datasets grandes.

**Fix:** Envolver em `useMemo` com deps corretas (`[filteredData, i18n.language, chartTheme]` etc.).

---

### A3. Performance: `useChartTheme` retorna objeto novo a cada render

**Arquivo:** `src/hooks/useChartTheme.js`

O hook retorna um object literal novo a cada chamada. Como é usado como dependency de `useMemo` em charts, invalida qualquer memoização downstream.

**Fix:** Envolver retorno em `useMemo(() => ({ ... }), [isDark])`.

---

### A4. UX: 7 chamadas `alert()` no codebase

`alert()` bloqueia a thread, não suporta i18n e expõe mensagens internas.

| Arquivo | Linha | Mensagem |
|---------|-------|----------|
| `src/pages/Benchmark.jsx` | 69 | `'Por favor, use o formato: owner/repo'` |
| `src/pages/Benchmark.jsx` | 75 | `'Este repositório já foi adicionado'` |
| `src/pages/Benchmark.jsx` | 81 | `` `Máximo de ${MAX_REPOS}...` `` |
| `src/components/RepoInfoCard.jsx` | 53 | `'Erro: Dados não salvos...'` |
| `src/components/RepoInfoCard.jsx` | 75 | `'Link copiado!'` |
| `src/components/RepoInfoCard.jsx` | 79 | `'Erro ao gerar link...'` |
| `src/utils/pdfExporter.js` | 48 | `'Erro ao gerar o relatório PDF...'` |

**Fix:** Substituir por toast notifications (react-hot-toast ou inline alerts estilizados).

---

### A5. DRY: Lógica de filtragem temporal duplicada

**Arquivos:** `src/pages/Timeline.jsx:59-84` e `src/pages/Benchmark.jsx:30-59`

Switch-case idêntico (`7d/30d/60d/90d/all`) duplicado em ambos os arquivos. Mesma estrutura de cálculo de `cutoffDate`.

**Fix:** Extrair para `src/hooks/useTimeFilter.js`:
```js
export function useTimeFilter(data, timeRange, dateAccessor = (d) => d.date) {
  return useMemo(() => {
    if (!data || timeRange === 'all') return data;
    const cutoff = getCutoffDate(timeRange);
    return data.filter((item) => dateAccessor(item) >= cutoff);
  }, [data, timeRange]);
}
```

---

### A6. DRY: Componente de filtro temporal duplicado

**Arquivos:** `src/pages/Timeline.jsx:321-340` e `src/pages/Benchmark.jsx:282-301`

UI idêntica (segmented control com botões, classes Tailwind, `onClick`, conditional styling). Só difere a chave i18n (`timeline.filters.*` vs `benchmark.filters.*`).

**Fix:** Extrair para `src/components/TimeRangeFilter.jsx`:
```jsx
export function TimeRangeFilter({ value, onChange, i18nPrefix }) { ... }
```

---

### A7. Segurança: `localStorage` sem try-catch

4 acessos a `localStorage` que lançam exceção em navegação privada (Safari, alguns Firefox):

| Arquivo | Linhas |
|---------|--------|
| `src/hooks/useTheme.js` | 5, 21 |
| `src/services/githubService.js` | 7 |
| `src/components/SettingsModal.jsx` | 6, 11, 13 |

**Fix:** Criar util `src/utils/storage.js` com wrapper try-catch:
```js
export function getItem(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
```

---

### A8. Complexidade: `App.jsx` contém Dashboard inteiro inline (508 linhas)

**Arquivo:** `src/App.jsx`

O componente `Dashboard` (455 linhas, linhas 37-491) vive dentro de `App.jsx` junto com o Router. Responsabilidades misturadas:

- Carregamento de snapshots (50-135): `loadSnapshot`, `loadSnapshotByDate`
- Parsing de URL params (137-170)
- Adaptador de dados Supabase→React (172-279): `createMockRepoData` (107 linhas)
- State management (6+ `useState`)
- Rendering condicional (loading/error/success)

**Fix:** Extrair `Dashboard` para `src/pages/Dashboard.jsx` e `createMockRepoData` para `src/utils/snapshotAdapter.js`.

---

## Média Prioridade

### M1. DRY: Configuração de chart options duplicada em 3 arquivos

`Timeline.jsx:124-192`, `BenchmarkEvolutionChart.jsx:49-129`, `BenchmarkComparisonChart.jsx:84-144` compartilham a mesma estrutura base (responsive, legend, tooltip, scales, theme colors).

**Fix:** Criar `src/lib/chartDefaults.js` com factory function:
```js
export function createBaseChartOptions(chartTheme, overrides = {}) { ... }
```

---

### M2. DRY: Formatação de datas repetida 4x

`Intl.DateTimeFormat` com mesma config (`day: '2-digit', month: 'short', year: 'numeric'`) aparece em:
- `Timeline.jsx:89-93` (+ linhas 359, 392)
- `BenchmarkEvolutionChart.jsx:80-87`

**Fix:** Extrair para `src/utils/formatters.js`:
```js
export function formatShortDate(date, language) { ... }
```

---

### M3. Complexidade: `Benchmark.jsx` com 600 linhas e 9+ seções

Maior componente do projeto. Mistura search form, chips, cards, charts, tabela comparativa, bus factor analysis — tudo inline.

**Candidatos a extração:**
- `BenchmarkSearchForm` (linhas 109-161)
- `BenchmarkRepoChips` (linhas 164-201)
- `BenchmarkHealthBars` (linhas 376-410)
- `BenchmarkBusFactorRisk` (linhas 439-493)
- `BenchmarkDetailTable` (linhas 495-576)

---

### M4. Performance: `useBenchmarkRepos` recria query objects a cada render

**Arquivo:** `src/hooks/useBenchmarkRepos.js:13-105`

`selectedRepos.map()` cria novos objetos `{ queryKey, queryFn }` a cada render, potencialmente invalidando cache do TanStack Query.

**Fix:** Memoizar o array de queries ou usar `queryFn` estável com `useCallback`.

---

### M5. Performance: `BenchmarkComparisonChart` com dependências excessivas no `useMemo`

**Arquivo:** `src/components/charts/BenchmarkComparisonChart.jsx:82`

`chartData` memo depende de `[repos, metricCategory, labels, activeConfigs, t]` — `labels` e `activeConfigs` são derivados de `repos`/`metricCategory`, causando recálculos desnecessários.

---

### M6. Segurança: `dangerouslySetInnerHTML` em 2 componentes

| Arquivo | Linha | Fonte do conteúdo |
|---------|-------|--------------------|
| `src/components/HelpModal.jsx` | 44 | Strings i18n com HTML (`<a>` tags) |
| `src/components/ContributorsTable.jsx` | 54 | `busFactorMessage` com `<strong>` interpolado |

**Risco:** Baixo (conteúdo vem de locale files controlados), mas viola boas práticas.

**Fix:** Substituir por componentes React (ex: `Trans` do react-i18next) ou sanitizar com DOMPurify.

---

### M7. i18n: Strings hardcoded em português

| Arquivo | Linha | String |
|---------|-------|--------|
| `src/components/RepoInfoCard.jsx` | 139 | `title="Compartilhar Resultado"` |
| `src/components/RepoInfoCard.jsx` | 144 | `Compartilhar` |
| `src/App.jsx` | 325 | `"Modo Histórico"` |
| `src/App.jsx` | 327-330 | Template strings do snapshot alert |

---

### M8. Magic Numbers dispersos no codebase

| Arquivo | Valor | Significado |
|---------|-------|-------------|
| `src/services/githubService.js` | `15`, `20` | `per_page` da API |
| `src/services/githubService.js` | `90` | Dias para zombie branch |
| `src/services/githubService.js` | `52` | Semanas no ano |
| `src/pages/Benchmark.jsx` | `137.508` | Golden angle (cores) |
| `src/utils/pdfExporter.js` | `10`, `0.98`, `2` | Margens, qualidade, scale |
| `src/hooks/useRepository.js` | `10` | Limite de items recentes |

**Fix:** Extrair para `src/constants.js`.

---

### M9. TODO pendente: Retry Logic no analytics

**Arquivo:** `src/services/analytics.js:57`

```js
// TODO: Implementar Retry Logic (v3.0) - Adicionar tentativa de reenvio em caso de falha temporária
```

Marcado para v3.0 mas não implementado. Analytics usa fire-and-forget sem retry.

---

## Baixa Prioridade

### B1. Código morto: `sanitizeRepoDataForSnapshot()` nunca importado

**Arquivo:** `src/utils/sanitizeForJson.js:8-133`

Função exportada mas nunca utilizada em nenhum módulo. 125 linhas de dead code.

---

### B2. Export não utilizado: `allSuccess` no `useBenchmarkRepos`

**Arquivo:** `src/hooks/useBenchmarkRepos.js:110,121`

Propriedade `allSuccess` é computada e retornada mas `Benchmark.jsx:28` não a desestrutura.

---

### B3. DRY: Container wrapper de charts repetido 3x

Pattern `<div className="bg-white dark:bg-slate-800 border ..."><h3>...</h3><div style={{height:'400px'}}>` repetido em Timeline, BenchmarkEvolutionChart e BenchmarkComparisonChart.

**Fix:** Extrair `<ChartCard title={...}>{children}</ChartCard>`.

---

### B4. `Timeline.jsx` com 458 linhas — 3 estados de tela inline

Loading, Error e Success são renderizados no mesmo componente. Extrair `TimelineErrorState` e `TimelineStatsCards` reduziria para ~250 linhas.

---

### B5. `generateColor()` em `Benchmark.jsx` é utilitário genérico

**Arquivo:** `src/pages/Benchmark.jsx:12-16`

Função de geração de cores deveria estar em `src/utils/colors.js` para reuso.

---

## Plano de Ação Sugerido

### Sprint 1 — Bugs e Quick Wins (1-2 dias)

| # | Ação | Arquivos | Esforço |
|---|------|----------|---------|
| 1 | Fix `useChartTheme` — adicionar `tooltipBg`/`tooltipText` + `useMemo` | `useChartTheme.js` | 15min |
| 2 | Criar `src/utils/storage.js` com wrapper localStorage | `useTheme.js`, `githubService.js`, `SettingsModal.jsx` | 30min |
| 3 | Remover `sanitizeForJson.js` (dead code) | `src/utils/sanitizeForJson.js` | 5min |
| 4 | Remover export `allSuccess` de `useBenchmarkRepos` | `useBenchmarkRepos.js` | 5min |

### Sprint 2 — Performance Charts (1 dia)

| # | Ação | Arquivos | Esforço |
|---|------|----------|---------|
| 5 | Memoizar `chartData`/`chartOptions` em Timeline | `Timeline.jsx` | 30min |
| 6 | Memoizar `chartData`/`chartOptions` em BenchmarkEvolutionChart | `BenchmarkEvolutionChart.jsx` | 30min |
| 7 | Fix deps do `useMemo` em BenchmarkComparisonChart | `BenchmarkComparisonChart.jsx` | 20min |
| 8 | Memoizar `chartData` em CommitActivityChart | `CommitActivityChart.jsx` | 10min |

### Sprint 3 — Abstrações DRY (2 dias)

| # | Ação | Arquivos | Esforço |
|---|------|----------|---------|
| 9 | Criar `useTimeFilter` hook | Novo + `Timeline.jsx`, `Benchmark.jsx` | 1h |
| 10 | Criar `<TimeRangeFilter>` component | Novo + `Timeline.jsx`, `Benchmark.jsx` | 1h |
| 11 | Criar `createBaseChartOptions()` factory | Novo + 3 chart files | 1h |
| 12 | Extrair `formatShortDate()` para formatters | `formatters.js` + 2 files | 30min |

### Sprint 4 — Componentização (2-3 dias)

| # | Ação | Arquivos | Esforço |
|---|------|----------|---------|
| 13 | Extrair `Dashboard` de App.jsx para `src/pages/Dashboard.jsx` | `App.jsx` | 2h |
| 14 | Extrair `createMockRepoData` para `snapshotAdapter.js` | `App.jsx` | 1h |
| 15 | Quebrar `Benchmark.jsx` em 5 sub-componentes | `Benchmark.jsx` + novos | 3h |
| 16 | Substituir `alert()` por toast system | 3 files | 2h |

### Sprint 5 — Polish (1 dia)

| # | Ação | Arquivos | Esforço |
|---|------|----------|---------|
| 17 | Extrair magic numbers para `constants.js` | `githubService.js`, `pdfExporter.js`, etc. | 1h |
| 18 | Migrar strings hardcoded para i18n | `RepoInfoCard.jsx`, `App.jsx` | 1h |
| 19 | Substituir `dangerouslySetInnerHTML` | `HelpModal.jsx`, `ContributorsTable.jsx` | 1h |

---

*Relatório gerado como parte da revisão de código v3.1.0 — Benchmark Edition.*
