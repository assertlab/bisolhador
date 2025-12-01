import React from 'react';

export function ActivityLogs({ commits, pullRequests }) {
  // Função para formatar data relativa
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias atrás`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas atrás`;
    return `${Math.floor(diffDays / 30)} meses atrás`;
  };

  // Função para determinar cor do badge do PR
  const getPRBadge = (state, merged) => {
    if (merged) return { text: 'Merged', color: 'bg-green-100 text-green-800' };
    if (state === 'open') return { text: 'Open', color: 'bg-blue-100 text-blue-800' };
    return { text: 'Closed', color: 'bg-red-100 text-red-800' };
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          Atividades Recentes
          <span className="text-gray-300 cursor-help" title="Últimos commits e pull requests do repositório">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </span>
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimos Commits */}
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-4">Últimos Commits</h4>
          <div className="space-y-3">
            {commits.slice(0, 5).map((commit, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 rounded-md hover:bg-gray-50">
                <img
                  className="w-8 h-8 rounded-full"
                  src={commit.author?.avatar_url || commit.committer?.avatar_url}
                  alt=""
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">
                    <a
                      href={commit.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ocean hover:underline"
                    >
                      {commit.commit.message.split('\n')[0]}
                    </a>
                  </p>
                  <p className="text-xs text-gray-500">
                    por {commit.commit.author.name} • {formatDate(commit.commit.author.date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Últimos PRs */}
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-4">Últimos Pull Requests</h4>
          <div className="space-y-3">
            {pullRequests.slice(0, 5).map((pr, index) => {
              const badge = getPRBadge(pr.state, pr.merged_at);
              return (
                <div key={index} className="flex items-start space-x-3 p-3 rounded-md hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <a
                        href={pr.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ocean hover:underline"
                      >
                        {pr.title}
                      </a>
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                        {badge.text}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(pr.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
