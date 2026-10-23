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
    // Snapshot sem full_report só tem as colunas planas: o resto é null (N/A),
    // não 0 — "não registrado" não é "zero".
    stats: {
      branches: null,
      prs: null,
      merges: null,
      prsPerBranch: 'N/A',
      releases: null
    },

    // Métricas calculadas
    metrics: {
      stars: snapshotData.stars || 0,
      forks: snapshotData.forks || 0,
      openIssues: snapshotData.issues ?? null,
      closedIssues: null,
      resolutionRate: 'N/A',
      leadTime: { value: 'N/A', unit: '', count: null, n: 0, reason: 'snapshot' },
      // Snapshot sem full_report não registrou revisão de PRs (ver prReviewStats.js).
      divergence: {
        avg: null,
        categoryKey: 'repo.divergenceUnavailable'
      }
    },

    // Health score
    health: {
      score: snapshotData.health_score ?? null,
      files: null // checklist não registrado no snapshot
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
      unapprovedPercentage: null,
      selfMergePercentage: null,
      color: 'gray',
      available: false,
      reason: 'snapshot'
    },

    // Contribuições: não registradas neste snapshot (não é "sem contribuidores")
    contributors: null,
    busFactor: { level: 'notRecorded' },

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
