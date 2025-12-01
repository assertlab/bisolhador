import { useState } from 'react';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { RepoInfoCard } from './components/RepoInfoCard';
import { StatCard } from './components/StatCard';
import { HealthScoreCard } from './components/HealthScoreCard';
import { MaturityCard } from './components/MaturityCard';
import { ContributorsTable } from './components/ContributorsTable';
import { ActivityLogs } from './components/ActivityLogs';
import { SettingsModal } from './components/SettingsModal';
import { TechStackChart } from './components/charts/TechStackChart';
import { CommitActivityChart } from './components/charts/CommitActivityChart';
import { WeekDaysChart } from './components/charts/WeekDaysChart';
import { useRepository } from './hooks/useRepository.js';

function App() {
  const { data: repoData, loading, error, search } = useRepository();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dismissedError, setDismissedError] = useState(false);

  const handleSearch = (repositoryName) => {
    console.log(`Bisolhando: ${repositoryName}`);
    setDismissedError(false); // Reset dismissed error on new search
    search(repositoryName);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />

      {/* É AQUI! A tag <main> é o container principal da página */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        <div className="flex flex-col items-center justify-center space-y-4">
          <h2 className="text-3xl font-bold text-shark tracking-tight text-center">
            Analise repositórios como um Tech Lead
          </h2>

          <div className="w-full pt-4">
            <SearchBar onSearch={handleSearch} loading={loading} />
          </div>

          {/* Alerta de Erro Condicional */}
          {error && !dismissedError && (
            <div className="w-full max-w-2xl mx-auto">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium">Erro na busca</h3>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDismissedError(true)}
                  className="ml-4 text-red-400 hover:text-red-600 transition-colors"
                  aria-label="Fechar alerta"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lógica de Renderização: Se tem dados, mostra o Dashboard completo */}
        {repoData ? (
          <div className="space-y-6 animate-fade-in-up">

            {/* 1. Card Principal */}
            <RepoInfoCard data={repoData} />

            {/* 2. Grid de Métricas de Volume */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                title="Stars"
                value={repoData.metrics.stars}
                tooltipText="Número total de estrelas (favoritos) que o repositório recebeu no GitHub."
              />
              <StatCard
                title="Forks"
                value={repoData.metrics.forks}
                tooltipText="Número de cópias (forks) do repositório criadas por outros usuários."
              />
              <StatCard
                title="Open Issues"
                value={repoData.metrics.openIssues}
                tooltipText="Número de issues (problemas ou solicitações) que ainda estão abertas no repositório."
              />
              <StatCard
                title="Closed Issues"
                value={repoData.metrics.closedIssues}
                subValue={repoData.metrics.resolutionRate}
                tooltipText="Total de issues já resolvidas, com taxa de resolução mostrando eficiência."
              />
              <StatCard
                title="Code Churn"
                value={repoData.codeChurn?.ratio || 'N/A'}
                tooltipText="Razão entre código novo adicionado e código removido/refatorado. Indica qualidade das mudanças."
              />
            </div>

            {/* 3. Grid de Dinâmica de Revisão */}
            <h3 className="text-lg font-semibold text-shark pt-4">Dinâmica de Revisão</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard
                title="Lead Time"
                value={repoData.metrics.leadTime}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                tooltipText="Tempo médio entre a criação de um Pull Request e sua aprovação/merge. Indica velocidade do processo de revisão."
              />
              <StatCard
                title="Divergência"
                value={repoData.metrics.divergence.avg}
                subValue={repoData.metrics.divergence.category}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path></svg>}
                tooltipText="Número médio de comentários e discussões por Pull Request. Indica nível de colaboração e debate técnico."
              />
            </div>

            {/* 4. Governança e Maturidade */}
            <h3 className="text-lg font-semibold text-shark pt-4">Governança e Maturidade</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HealthScoreCard score={repoData.health.score} files={repoData.health.files} />
              <MaturityCard maturity={repoData.maturity} codeReview={repoData.codeReview} />
            </div>

            {/* 5. Área de Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CommitActivityChart
                data={repoData.charts.activity}
                createdAt={repoData.createdAt}
                key={`chart-${repoData.fullName}`} // Force re-render on new data
              />
              <TechStackChart data={repoData.charts.techStack} />
            </div>

            {/* 6. Padrões de Trabalho */}
            <WeekDaysChart commits={repoData.recentCommits} />

            {/* 7. Contribuições */}
            <ContributorsTable contributors={repoData.contributors} busFactor={repoData.busFactor} />

            {/* 8. Atividades Recentes */}
            <ActivityLogs commits={repoData.recentCommits} pullRequests={repoData.recentPRs} />

          </div>
        ) : (
          /* Placeholder vazio quando não pesquisou nada */
          !loading && (
            <div className="border-2 border-dashed border-gray-200 rounded-xl h-64 flex items-center justify-center text-gray-400">
              Os gráficos aparecerão aqui...
            </div>
          )
        )}

      </main>

      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
        <div className="text-center text-sm text-gray-500">
          <p>© 2025 Vinicius Cardoso Garcia. Licenciado sob MIT.</p>
          <p className="mt-1 font-medium text-shark">
            Powered by ASSERT Lab. Orgulhosamente feito em Recife 🦈
          </p>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
