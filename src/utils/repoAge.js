// "13 anos", "3 meses", "Menos de 1 dia": the project age text of the repository card and the PDF report.
export function repoAgeText(createdAt, t, now = new Date()) {
  if (!createdAt) return 'N/A';
  const days = Math.floor((now - new Date(createdAt)) / (1000 * 60 * 60 * 24));
  if (days < 7) {
    if (days === 0) return t('repo.ageLessThanDay');
    if (days === 1) return t('repo.ageOneDay');
    return t('repo.ageDays', { count: days });
  }
  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    if (weeks === 1) return t('repo.ageOneWeek');
    return t('repo.ageWeeks', { count: weeks });
  }
  const months = Math.floor(days / 30);
  if (days < 365) {
    if (months === 1) return t('repo.ageOneMonth');
    return t('repo.ageMonths', { count: months });
  }
  const years = Math.floor(days / 365);
  if (years === 1) return t('repo.ageOneYear');
  return t('repo.ageYears', { count: years });
}
