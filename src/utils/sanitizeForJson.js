/**
 * Sanitiza dados do repositório para persistência segura em JSON.
 * Remove referências circulares, funções e extrai apenas campos necessários.
 *
 * @param {Object} data - Dados do repositório vindos do useRepository hook
 * @returns {Object} Objeto JSON-safe pronto para serialização
 */
export function sanitizeRepoDataForSnapshot(data) {
  if (!data) return null;

  return {
    fullName: data.fullName,
    url: data.url,
    description: data.description,
    language: data.language,
    ownerType: data.ownerType,
    subscribers: data.subscribers,
    pushedAt: data.pushedAt,
    createdAt: data.createdAt,
    createdAtFormatted: data.createdAtFormatted,

    stats: data.stats ? {
      branches: data.stats.branches,
      prs: data.stats.prs,
      merges: data.stats.merges,
      prsPerBranch: data.stats.prsPerBranch,
      releases: data.stats.releases
    } : null,

    metrics: data.metrics ? {
      stars: data.metrics.stars,
      forks: data.metrics.forks,
      openIssues: data.metrics.openIssues,
      closedIssues: data.metrics.closedIssues,
      resolutionRate: data.metrics.resolutionRate,
      leadTime: data.metrics.leadTime,
      divergence: data.metrics.divergence
    } : null,

    health: data.health ? {
      score: data.health.score,
      files: data.health.files ? { ...data.health.files } : null
    } : null,

    maturity: data.maturity ? {
      testsDetected: data.maturity.testsDetected,
      ciCdDetected: data.maturity.ciCdDetected,
      dockerDetected: data.maturity.dockerDetected,
      lintDetected: data.maturity.lintDetected,
      zombies: data.maturity.zombies,
      codeReview: data.maturity.codeReview ? {
        total: data.maturity.codeReview.total,
        withReviews: data.maturity.codeReview.withReviews,
        percentage: data.maturity.codeReview.percentage
      } : null
    } : null,

    codeReview: data.codeReview ? {
      total: data.codeReview.total,
      withReviews: data.codeReview.withReviews,
      percentage: data.codeReview.percentage
    } : null,

    contributors: Array.isArray(data.contributors)
      ? data.contributors.map(c => ({
          login: c.login,
          avatar_url: c.avatar_url,
          html_url: c.html_url,
          contributions: c.contributions,
          percentage: c.percentage
        }))
      : [],

    busFactor: data.busFactor ? {
      factor: data.busFactor.factor,
      risk: data.busFactor.risk,
      topContributorPercentage: data.busFactor.topContributorPercentage
    } : null,

    recentCommits: Array.isArray(data.recentCommits)
      ? data.recentCommits.map(c => ({
          sha: c.sha?.substring(0, 7),
          message: c.commit?.message?.split('\n')[0]?.substring(0, 150),
          author: c.commit?.author?.name,
          date: c.commit?.author?.date,
          html_url: c.html_url
        }))
      : [],

    recentPRs: Array.isArray(data.recentPRs)
      ? data.recentPRs.map(pr => ({
          number: pr.number,
          title: pr.title?.substring(0, 150),
          state: pr.state,
          created_at: pr.created_at,
          merged_at: pr.merged_at,
          user_login: pr.user?.login,
          html_url: pr.html_url
        }))
      : [],

    codeChurn: data.codeChurn ? {
      additions: data.codeChurn.additions,
      deletions: data.codeChurn.deletions,
      ratio: data.codeChurn.ratio,
      weeks: data.codeChurn.weeks
    } : null,

    charts: {
      techStack: Array.isArray(data.charts?.techStack)
        ? data.charts.techStack.map(lang => ({
            language: lang.language,
            percentage: lang.percentage,
            color: lang.color
          }))
        : [],
      activity: data.charts?.activity ? {
        labels: data.charts.activity.labels || [],
        datasets: Array.isArray(data.charts.activity.datasets)
          ? data.charts.activity.datasets.map(ds => ({
              label: ds.label,
              data: Array.isArray(ds.data) ? [...ds.data] : [],
              borderColor: ds.borderColor,
              backgroundColor: ds.backgroundColor,
              tension: ds.tension
            }))
          : []
      } : null
    },

    analysisDate: new Date().toISOString()
  };
}
