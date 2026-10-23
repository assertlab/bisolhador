/**
 * Parses a snapshot's `full_report`, which Supabase returns either as a JSON
 * string or as an already-decoded object. Anything that isn't a report object
 * (malformed JSON, or JSON like `false`/`0`) degrades to null so callers fall
 * back to the flat columns. A malformed report is corrupted persisted data,
 * so it's logged as an error, with the caller's context.
 */
export function parseFullReport(fullReport, context) {
  if (!fullReport) return null;
  let report = fullReport;
  if (typeof fullReport === 'string') {
    try {
      report = JSON.parse(fullReport);
    } catch (e) {
      console.error(`[${context}] Failed to parse full_report:`, e);
      return null;
    }
  }
  return report !== null && typeof report === 'object' && !Array.isArray(report) ? report : null;
}

/**
 * Adapter: converts flat Supabase snapshot data into the nested format expected by the Dashboard.
 */
export function createMockRepoData(snapshotData) {
  return {
    // Campos básicos do repositório
    fullName: snapshotData.repo_name || 'N/A',
    url: `https://github.com/${snapshotData.repo_name || ''}`,
    description: 'Dados históricos - descrição não disponível',
    ageText: 'N/A',
    createdAt: snapshotData.last_push_at || null,
    createdAtFormatted: snapshotData.last_push_at ? new Date(snapshotData.last_push_at).toLocaleDateString('pt-BR') : 'N/A',
    searchId: snapshotData.id,

    // Estatísticas básicas
    stats: {
      branches: 0,
      prs: 0,
      merges: 0,
      prsPerBranch: 'N/A',
      releases: 0
    },

    // Métricas calculadas
    metrics: {
      stars: snapshotData.stars || 0,
      forks: snapshotData.forks || 0,
      openIssues: snapshotData.issues || 0,
      closedIssues: 0,
      resolutionRate: 'N/A',
      leadTime: {
        value: 'N/A',
        unit: 'hours',
        count: 0
      },
      // Snapshot sem full_report não registrou revisão de PRs (ver prReviewStats.js).
      divergence: {
        avg: null,
        categoryKey: 'repo.divergenceUnavailable'
      }
    },

    // Health score
    health: {
      score: snapshotData.health_score || 0,
      files: {
        readme: false,
        license: false,
        contributing: false,
        description: false,
        codeOfConduct: false,
        issueTemplate: false,
        prTemplate: false
      }
    },

    // Maturidade (valores padrão)
    maturity: {
      tests: false,
      ciCd: false,
      docker: false,
      noZombies: false,
      zombies: null // não registrado no snapshot: n/d, não o badge verde "nenhuma zumbi"
    },

    // Code review: indisponível (mesmo formato de analyzeReviewMetrics)
    codeReview: {
      selfMergePercentage: null,
      color: 'gray',
      available: false,
      reason: 'snapshot'
    },

    // Contribuições (valores padrão)
    contributors: [],
    busFactor: {
      level: 'none',
      message: 'Dados históricos - informações de contribuição não disponíveis',
      criticalContributors: []
    },

    // Commits e PRs recentes (vazios para snapshots)
    recentCommits: [],
    recentPRs: [],

    // Gráficos (dados vazios)
    charts: {
      techStack: [],
      activity: {
        labels: [],
        datasets: [{
          label: 'Commits',
          data: [],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4
        }]
      }
    },

    // Code churn (valor padrão)
    codeChurn: {
      ratio: 'N/A'
    },

    // Flag para identificar que é um snapshot
    isSnapshot: true
  };
}
