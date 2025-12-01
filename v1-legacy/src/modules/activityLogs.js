export class ActivityLogs {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector);
    }

    update(commits, pullRequests) {
        const topCommits = commits.slice(0, 10);
        const topPRs = pullRequests.slice(0, 10);

        this.container.innerHTML = `
            <h2 class="text-xl font-bold mb-4">Auditoria de Atividade</h2>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 break-inside-avoid">
                <div class="bg-white p-4 rounded shadow break-inside-avoid">
                    <h3 class="text-lg font-semibold mb-3">Últimos 10 Commits</h3>
                    <ul class="space-y-2">
                        ${topCommits.map(commit => this.renderCommit(commit)).join('')}
                    </ul>
                </div>
                <div class="bg-white p-4 rounded shadow break-inside-avoid">
                    <h3 class="text-lg font-semibold mb-3">Últimos 10 PRs</h3>
                    <ul class="space-y-2">
                        ${topPRs.map(pr => this.renderPR(pr)).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    renderCommit(commit) {
        const message = commit.commit.message.split('\n')[0]; // First line
        const truncatedMessage = message.length > 50 ? message.substring(0, 47) + '...' : message;
        const author = commit.commit.author ? commit.commit.author.name : 'Unknown';
        const avatarUrl = commit.author ? commit.author.avatar_url : 'https://via.placeholder.com/32';
        const date = commit.commit.author ? commit.commit.author.date : null;
        const formattedDate = date ? new Date(date).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : 'N/A';
        const htmlUrl = commit.html_url || '#';

        return `
            <li class="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                <img src="${avatarUrl}" alt="${author}" class="w-8 h-8 rounded-full">
                <div class="flex-1 min-w-0">
                    <a href="${htmlUrl}" target="_blank" class="text-sm text-blue-900 hover:underline truncate block">${truncatedMessage}</a>
                    <p class="text-xs text-gray-500">${author} • ${formattedDate}</p>
                </div>
            </li>
        `;
    }

    renderPR(pr) {
        const title = pr.title;
        const author = pr.user.login;
        const date = new Date(pr.created_at);
        const formattedDate = date.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
        const htmlUrl = pr.html_url || '#';

        let statusBadge = '';
        if (pr.merged_at) {
            statusBadge = '<span class="inline-block bg-purple-500 text-white text-xs px-2 py-1 rounded-full">Merged</span>';
        } else if (pr.state === 'open') {
            statusBadge = '<span class="inline-block bg-green-500 text-white text-xs px-2 py-1 rounded-full">Open</span>';
        } else {
            statusBadge = '<span class="inline-block bg-red-500 text-white text-xs px-2 py-1 rounded-full">Closed</span>';
        }

        return `
            <li class="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                <div class="flex-1 min-w-0">
                    <a href="${htmlUrl}" target="_blank" class="text-sm text-blue-900 hover:underline truncate block">${title}</a>
                    <p class="text-xs text-gray-500">${author} • ${formattedDate}</p>
                </div>
                ${statusBadge}
            </li>
        `;
    }

    getRelativeTime(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'agora há pouco';
        if (diffInSeconds < 3600) return `há ${Math.floor(diffInSeconds / 60)} minutos`;
        if (diffInSeconds < 86400) return `há ${Math.floor(diffInSeconds / 3600)} horas`;
        if (diffInSeconds < 604800) return `há ${Math.floor(diffInSeconds / 86400)} dias`;
        return date.toLocaleDateString();
    }
}
