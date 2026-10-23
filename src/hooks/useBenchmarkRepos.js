import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import analytics from '../services/analytics.js';
import { parseFullReport } from '../utils/snapshotAdapter.js';
import { CACHE_STALE_TIME_MS } from '../constants.js';
import { leadTimeDays } from '../utils/prReviewStats.js';

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
        const history = await analytics.getRepoHistory(repo.fullName);

        if (!history || history.length === 0) {
          throw new Error(`Nenhum histórico encontrado para ${repo.fullName}`);
        }

        const latestSnapshot = history[history.length - 1];
        const reportData = parseFullReport(latestSnapshot.full_report, `Benchmark ${repo.fullName}`);

        const primaryLanguage = reportData?.language ||
                                reportData?.primaryLanguage ||
                                reportData?.charts?.techStack?.[0]?.language ||
                                latestSnapshot.language ||
                                'Unknown';

        return {
          fullName: repo.fullName,
          color: repo.color,
          stars: reportData?.metrics?.stars || latestSnapshot.stars || 0,
          forks: reportData?.metrics?.forks || latestSnapshot.forks || 0,
          openIssues: reportData?.metrics?.openIssues || latestSnapshot.issues || 0,
          healthScore: reportData?.health?.score || latestSnapshot.health_score || 0,
          language: primaryLanguage,
          closedIssues: reportData?.metrics?.closedIssues || 0,
          // Always days (the chart plots days); old mean-based values → 0 (N/A)
          leadTime: leadTimeDays(reportData?.metrics?.leadTime) ?? 0,
          leadTimeUnit: 'days',
          codeChurnRatio: parseFloat(reportData?.codeChurn?.ratio) || 0,
          codeChurnCategory: reportData?.codeChurn?.category || '',
          divergence: reportData?.metrics?.divergence?.avg || 0,
          busFactorPercentage: reportData?.busFactor?.percentage || 0,
          busFactorLevel: reportData?.busFactor?.level || 'none',
          busFactorTopContributor: reportData?.busFactor?.topContributor || '',
          lastUpdate: new Date(latestSnapshot.created_at),
          history: history.map((snapshot) => {
            const data = parseFullReport(snapshot.full_report, `Benchmark ${repo.fullName}`);
            return {
              date: new Date(snapshot.created_at),
              stars: data?.metrics?.stars || snapshot.stars || 0,
              forks: data?.metrics?.forks || snapshot.forks || 0,
              openIssues: data?.metrics?.openIssues || snapshot.issues || 0,
              closedIssues: data?.metrics?.closedIssues || 0,
              leadTime: leadTimeDays(data?.metrics?.leadTime) ?? 0,
              codeChurnRatio: parseFloat(data?.codeChurn?.ratio) || 0,
            };
          }),
        };
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
