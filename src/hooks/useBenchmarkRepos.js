import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import analytics from '../services/analytics.js';
import { CACHE_STALE_TIME_MS } from '../constants.js';
import { toBenchmarkRepo } from '../utils/benchmarkData.js';

/**
 * Hook customizado para buscar dados de múltiplos repositórios em paralelo
 * Usa o histórico do Supabase para obter os dados mais recentes de cada repo
 *
 * @param {Array} selectedRepos - Array de objetos { fullName, owner, repo, color }
 * @returns {Object} { queries, isLoading, hasErrors, chartData }
 */
export function useBenchmarkRepos(selectedRepos) {
  // Memoiza o array de query configs para evitar recriação a cada render
  const queryConfigs = useMemo(
    () => selectedRepos.map((repo) => ({
      queryKey: ['benchmark', repo.fullName],
      queryFn: async () => {
        // Renamed repos: rows saved under the typed (old) name are merged in.
        const names = [repo.fullName, ...(repo.aliases ?? [])];
        const histories = await Promise.all(names.map((name) => analytics.getRepoHistory(name)));
        const data = toBenchmarkRepo(repo, histories.flat().filter(Boolean));
        if (!data) {
          throw new Error(`Nenhum histórico encontrado para ${repo.fullName}`);
        }
        return data;
      },
      retry: 1,
      staleTime: CACHE_STALE_TIME_MS,
      enabled: !!repo.fullName,
    })),
    [selectedRepos],
  );

  // Cria queries paralelas para cada repositório
  const queries = useQueries({
    queries: queryConfigs,
  });

  // Calcula estados agregados
  const isLoading = queries.some((query) => query.isLoading);
  const hasErrors = queries.some((query) => query.isError);

  // Prepara dados para gráficos (apenas repos com sucesso)
  const successfulRepos = queries
    .filter((query) => query.isSuccess && query.data)
    .map((query) => query.data);

  return {
    queries,
    isLoading,
    hasErrors,
    successfulRepos,
    errorCount: queries.filter((q) => q.isError).length,
  };
}
