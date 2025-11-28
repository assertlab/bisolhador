export class RepoInfoComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    update(repoData, branches, pulls, owner, repo) {
        const createdAt = new Date(repoData.created_at);
        const now = new Date();
        const age = this.calculateAge(createdAt, now);

        const totalBranchesDisplay = branches.isMore ? '100+' : branches.count;
        const actualTotalBranches = branches.count;
        const totalPRs = pulls !== null ? pulls : 'N/A';
        const prsPerBranch = branches.isMore || actualTotalBranches == 0 || pulls === null ? 'N/A' : (pulls / actualTotalBranches).toFixed(1);

        const repoUrl = `https://github.com/${owner}/${repo}`;

        this.container.innerHTML = `
            <div class="bg-white p-6 rounded shadow mb-8">
                <h2 class="text-xl font-bold mb-2">
                    <a href="${repoUrl}" target="_blank" class="text-blue-600 hover:underline">${repoData.name}</a>
                </h2>
                ${repoData.description ? `<p class="text-gray-700 mb-4">${repoData.description}</p>` : ''}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h3 class="text-lg font-semibold">Idade do Projeto</h3>
                        <p>${age}</p>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold">Estatísticas Extras</h3>
                        <ul>
                            <li>Total de Branches: ${totalBranchesDisplay}</li>
                            <li>Total de PRs: ${totalPRs}</li>
                            <li>PRs por Branch: ${prsPerBranch}</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    calculateAge(createdAt, now) {
      let years = now.getFullYear() - createdAt.getFullYear();
      let months = now.getMonth() - createdAt.getMonth();

      if (months < 0) {
        years--;
        months += 12;
      }

      let result = '';
      if (years > 0) {
        result += `${years} ano${years > 1 ? 's' : ''} `;
      }
      if (months > 0) {
        result += `${months} ${months > 1 ? 'meses' : 'mês'}`;
      }

      return result.trim() || 'Menos de 1 mes';
   }

}
