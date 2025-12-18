import { useTranslation } from 'react-i18next';
import { formatters } from '../utils/formatters.js';
import { exportToPDF } from '../utils/pdfExporter.js';
import { exportJson } from '../utils/exportJson.js';

export function RepoInfoCard({ data, onShareSuccess }) {
  const { t, i18n } = useTranslation();
  if (!data) return null;

  const calculateAgeText = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now - created;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

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
  };

  const handleDownloadPDF = () => {
    exportToPDF();
  };

  const handleDownloadJSON = () => {
    const filename = `bisolhador-report-${data.fullName.replace('/', '-')}.json`;
    exportJson(data, filename);
  };

  const handleShare = async () => {
    try {
      if (!data.searchId) {
        alert('Erro: Dados não salvos. Tente recarregar a página.');
        return;
      }

      // Tenta pegar o base do Vite, ou fallback para pathname
      const baseUrl = import.meta.env.BASE_URL || window.location.pathname;

      // Garante que não duplique barras e nem fique sem
      // Ex: base='/bisolhador/', limpa para '/bisolhador', depois adiciona '/?id='
      const cleanBase = baseUrl === '/' ? '' : (baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl);

      const shareUrl = `${window.location.origin}${cleanBase}/?id=${data.searchId}`;

      // Copiar para clipboard
      await navigator.clipboard.writeText(shareUrl);

      // Chamar callback de sucesso
      if (onShareSuccess) {
        onShareSuccess();
      }

      // Mostrar toast de sucesso
      alert('Link copiado!');

    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      alert('Erro ao gerar link de compartilhamento');
    }
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

          {/* Data da Análise */}
          {data.analysisDate && (
            <div className="flex items-center gap-2 mt-3 text-sm text-gray-500 dark:text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>
                {t('repo.analysisDate')}: {new Intl.DateTimeFormat(
                  i18n.language === 'pt' ? 'pt-BR' : 'en-US',
                  {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }
                ).format(new Date(data.analysisDate))}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg border border-purple-600 hover:border-purple-700 focus:ring-4 focus:ring-purple-300 transition-colors"
            title="Compartilhar Resultado"
          >
            <svg aria-hidden="true" className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
            </svg>
            Compartilhar
          </button>
          <button
            onClick={handleDownloadJSON}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg border border-green-600 hover:border-green-700 focus:ring-4 focus:ring-green-300 transition-colors"
            title={t('button.jsonTitle')}
          >
            <svg aria-hidden="true" className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            JSON
          </button>
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg border border-blue-600 hover:border-blue-700 focus:ring-4 focus:ring-blue-300 transition-colors"
            title={t('header.downloadTitle')}
          >
            <svg aria-hidden="true" className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            {t('header.downloadButton')}
          </button>
        </div>
      </div>

      {/* Grid de Informações: Idade vs Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-100 dark:border-slate-700 pt-6">

        {/* Coluna 1: Idade */}
        <div>
          <h3 className="text-sm font-semibold text-shark dark:text-white uppercase tracking-wider mb-3">
            {t('repo.projectAge')}
          </h3>
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {calculateAgeText(data.createdAt)}
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
