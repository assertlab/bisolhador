import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import analytics from '../services/analytics.js';

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
        let reportData = null;

        if (latestSnapshot.full_report) {
          try {
            reportData =
              typeof latestSnapshot.full_report === 'string'
                ? JSON.parse(latestSnapshot.full_report)
                : latestSnapshot.full_report;
          } catch (e) {
            console.warn(`[Benchmark] Failed to parse full_report for ${repo.fullName}:`, e);
          }
        }

        let primaryLanguage = 'Unknown';
        if (reportData) {
          primaryLanguage = reportData.language ||
                           reportData.primaryLanguage ||
                           (reportData.charts?.techStack?.[0]?.language) ||
                           latestSnapshot.language ||
                           'Unknown';
        } else {
          primaryLanguage = latestSnapshot.language || 'Unknown';
        }

        return {
          fullName: repo.fullName,
          color: repo.color,
          stars: reportData?.metrics?.stars || latestSnapshot.stars || 0,
          forks: reportData?.metrics?.forks || latestSnapshot.forks || 0,
          openIssues: reportData?.metrics?.openIssues || latestSnapshot.issues || 0,
          healthScore: reportData?.health?.score || latestSnapshot.health_score || 0,
          language: primaryLanguage,
          closedIssues: reportData?.metrics?.closedIssues || 0,
          leadTime: reportData?.metrics?.leadTime?.count || 0,
          leadTimeUnit: reportData?.metrics?.leadTime?.unit || 'days',
          codeChurnRatio: parseFloat(reportData?.codeChurn?.ratio) || 0,
          codeChurnCategory: reportData?.codeChurn?.category || '',
          divergence: reportData?.metrics?.divergence?.avg || 0,
          busFactorPercentage: reportData?.busFactor?.percentage || 0,
          busFactorLevel: reportData?.busFactor?.level || 'none',
          busFactorTopContributor: reportData?.busFactor?.topContributor || '',
          lastUpdate: new Date(latestSnapshot.created_at),
          history: history.map((snapshot) => {
            let data = null;
            if (snapshot.full_report) {
              try {
                data = typeof snapshot.full_report === 'string'
                  ? JSON.parse(snapshot.full_report)
                  : snapshot.full_report;
              } catch (e) {
                console.warn(`[Benchmark] Failed to parse snapshot:`, e);
              }
            }
            return {
              date: new Date(snapshot.created_at),
              stars: data?.metrics?.stars || snapshot.stars || 0,
              forks: data?.metrics?.forks || snapshot.forks || 0,
              openIssues: data?.metrics?.openIssues || snapshot.issues || 0,
              closedIssues: data?.metrics?.closedIssues || 0,
              leadTime: data?.metrics?.leadTime?.count || 0,
              codeChurnRatio: parseFloat(data?.codeChurn?.ratio) || 0,
            };
          }),
        };
      },
      retry: 1,
      staleTime: 5 * 60 * 1000,
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
