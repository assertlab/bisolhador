/**
 * Advanced Bus Factor calculation.
 * Determines how many developers account for a given threshold of total commits.
 *
 * @param {Array} contributors - Array of { login, avatar_url, contributions }
 * @param {number} threshold - Fraction of total commits (default 0.70 = 70%)
 * @returns {{ busFactor: number, riskLevel: string, keyDevelopers: Array }}
 */
export function calculateBusFactor(contributors, threshold = 0.70) {
  if (!contributors || contributors.length === 0) {
    return { busFactor: 0, riskLevel: 'critical', keyDevelopers: [] };
  }

  const sorted = [...contributors].sort((a, b) => b.contributions - a.contributions);
  const totalContributions = sorted.reduce((sum, c) => sum + c.contributions, 0);

  if (totalContributions === 0) {
    return { busFactor: 0, riskLevel: 'critical', keyDevelopers: [] };
  }

  let accumulated = 0;
  const keyDevelopers = [];

  for (const contributor of sorted) {
    const percentage = (contributor.contributions / totalContributions) * 100;
    accumulated += contributor.contributions;
    keyDevelopers.push({
      login: contributor.login,
      avatar_url: contributor.avatar_url,
      percentage: Math.round(percentage * 10) / 10,
    });
    if (accumulated / totalContributions >= threshold) {
      break;
    }
  }

  const busFactor = keyDevelopers.length;

  let riskLevel;
  if (busFactor <= 1) {
    riskLevel = 'critical';
  } else if (busFactor <= 2) {
    riskLevel = 'high';
  } else if (busFactor <= 4) {
    riskLevel = 'moderate';
  } else {
    riskLevel = 'healthy';
  }

  return { busFactor, riskLevel, keyDevelopers };
}
