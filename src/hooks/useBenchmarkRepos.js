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
  // Cria queries paralelas para cada repositório
  const queries = useQueries({
    queries: selectedRepos.map((repo) => ({
      queryKey: ['benchmark', repo.fullName],
      queryFn: async () => {
        // Busca o histórico do repositório
        const history = await analytics.getRepoHistory(repo.fullName);

        if (!history || history.length === 0) {
          throw new Error(`Nenhum histórico encontrado para ${repo.fullName}`);
        }

        // Pega o snapshot mais recente
        const latestSnapshot = history[history.length - 1];

        let reportData = null;

        // Parse do full_report se for string
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

        // Extrai linguagem principal de múltiplas fontes possíveis
        let primaryLanguage = 'Unknown';
        if (reportData) {
          // Tenta pegar do campo direto
          primaryLanguage = reportData.language ||
                           reportData.primaryLanguage ||
                           // Tenta pegar da tech stack (primeira linguagem)
                           (reportData.charts?.techStack?.[0]?.language) ||
                           // Fallback para o campo da tabela
                           latestSnapshot.language ||
                           'Unknown';
        } else {
          // Se não tem full_report, tenta o campo da tabela
          primaryLanguage = latestSnapshot.language || 'Unknown';
        }

        // Retorna dados estruturados
        return {
          fullName: repo.fullName,
          color: repo.color,
          stars: reportData?.metrics?.stars || latestSnapshot.stars || 0,
          forks: reportData?.metrics?.forks || latestSnapshot.forks || 0,
          openIssues: reportData?.metrics?.openIssues || latestSnapshot.issues || 0,
          healthScore: reportData?.health?.score || latestSnapshot.health_score || 0,
          language: primaryLanguage,
          // Métricas avançadas de Engenharia de Software
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
          // Histórico completo para gráficos temporais
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
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: !!repo.fullName, // Only run if repo name exists
    })),
  });

  // Calcula estados agregados
  const isLoading = queries.some((query) => query.isLoading);
  const hasErrors = queries.some((query) => query.isError);
  const allSuccess = queries.every((query) => query.isSuccess);

  // Prepara dados para gráficos (apenas repos com sucesso)
  const successfulRepos = queries
    .filter((query) => query.isSuccess && query.data)
    .map((query) => query.data);

  return {
    queries,
    isLoading,
    hasErrors,
    allSuccess,
    successfulRepos,
    errorCount: queries.filter((q) => q.isError).length,
  };
}
