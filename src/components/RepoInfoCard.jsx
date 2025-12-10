import { useTranslation } from 'react-i18next';
import { formatters } from '../utils/formatters.js';
import { exportToPDF } from '../utils/pdfExporter.js';
import analytics from '../services/analytics.js';

export function RepoInfoCard({ data }) {
  const { t, i18n } = useTranslation();
  if (!data) return null;

  console.log('RepoInfoCard - createdAt:', data.createdAt);
  console.log('RepoInfoCard - createdAtFormatted:', data.createdAtFormatted);

  const handleDownload = () => {
    analytics.trackExport();
    exportToPDF();
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 animate-fade-in relative z-10">

      {/* Cabeçalho do Card: Nome e Descrição */}
      <div className="mb-6 flex justify-between items-start">
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight text-ocean mb-2 hover:underline">
            <a href={data.url} target="_blank" rel="noopener noreferrer">
              {data.fullName}
            </a>
          </h2>
          <p className="text-gray-600 dark:text-slate-400 leading-relaxed">
            {data.description || t('repo.noDescription')}
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg border border-blue-600 hover:border-blue-700 focus:ring-4 focus:ring-blue-300 transition-colors"
          title={t('header.downloadTitle')}
        >
          <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          {t('header.downloadButton')}
        </button>
      </div>

      {/* Grid de Informações: Idade vs Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-100 dark:border-slate-700 pt-6">

        {/* Coluna 1: Idade */}
        <div>
          <h3 className="text-sm font-semibold text-shark dark:text-white uppercase tracking-wider mb-3">
            {t('repo.projectAge')}
          </h3>
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {data.ageText}
          </p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {t('repo.since', { createdAt: data.createdAtFormatted || data.createdAt || 'N/A' })}
          </p>
        </div>

        {/* Coluna 2: Funil de Produção */}
        <div>
          <h3 className="text-sm font-semibold text-shark dark:text-white uppercase tracking-wider mb-3">
            {t('repo.extraStats')}
          </h3>
          <ul className="space-y-2">
            <li className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-slate-400">{t('repo.totalBranches')}</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatters.formatNumber(data.stats.branches, i18n.language === 'pt' ? 'pt-BR' : 'en-US')}</span>
            </li>
            <li className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-slate-400">{t('repo.totalPRs')}</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatters.formatNumber(data.stats.prs, i18n.language === 'pt' ? 'pt-BR' : 'en-US')}</span>
            </li>
            <li className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-slate-400">{t('repo.totalMerges')}</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatters.formatNumber(data.stats.merges, i18n.language === 'pt' ? 'pt-BR' : 'en-US')}</span>
            </li>
            <li className="flex justify-between text-sm border-t border-gray-100 dark:border-slate-700 pt-1 mt-1">
              <span className="text-gray-600 dark:text-slate-400">{t('repo.prsPerBranch')}</span>
              <span className="font-medium text-gray-900 dark:text-white">{data.stats.prsPerBranch}</span>
            </li>
            <li className="flex justify-between text-sm font-semibold text-ocean dark:text-blue-400">
              <span>{t('repo.totalReleases')}</span>
              <span>{data.stats.releases}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
