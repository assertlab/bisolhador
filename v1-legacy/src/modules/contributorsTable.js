import { createTooltip } from '../utils/uiHelpers.js';

export class ContributorsTable {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    update(contributors) {
        // Sort by contributions descending
        contributors.sort((a, b) => b.contributions - a.contributions);

        // Calculate total contributions
        const totalContributions = contributors.reduce((sum, c) => sum + c.contributions, 0);

        // Calculate bus factor risk
        let alertMessage = '';
        let alertClass = 'bg-green-100';
        let alertEmoji = '✅';
        if (contributors.length > 0) {
            const topContributor = contributors[0];
            const topPercentage = (topContributor.contributions / totalContributions) * 100;
            if (topPercentage > 60) {
                alertEmoji = '🚨';
                alertClass = 'bg-red-100';
                alertMessage = `O usuário ${topContributor.login} concentra ${topPercentage.toFixed(1)}% do trabalho. Bus Factor baixo.`;
            } else if (topPercentage > 40) {
                alertEmoji = '⚠️';
                alertClass = 'bg-yellow-100';
                alertMessage = `O usuário ${topContributor.login} concentra ${topPercentage.toFixed(1)}% do trabalho. Bus Factor moderado.`;
            } else {
                alertMessage = `Time balanceado. Nenhum usuário concentra mais de 40% dos commits.`;
            }
            alertMessage = `${alertEmoji} ${alertMessage}`;
        }

        const rows = contributors.map(contributor => {
            const percentage = ((contributor.contributions / totalContributions) * 100).toFixed(1);
            return `
                <tr>
                    <td class="px-4 py-2">
                        <div class="flex items-center">
                            <img src="${contributor.avatar_url}" alt="Avatar" class="w-8 h-8 rounded-full mr-2">
                            <span>${contributor.login}</span>
                        </div>
                    </td>
                    <td class="px-4 py-2 text-right">${contributor.contributions}</td>
                    <td class="px-4 py-2">
                        <div class="flex items-center">
                            <div class="w-full bg-gray-200 rounded-full h-2 mr-2">
                                <div class="bg-blue-600 h-2 rounded-full" style="width: ${percentage}%"></div>
                            </div>
                            <span class="text-sm">${percentage}%</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const alertCard = contributors.length > 0 && alertMessage ? `
            <div class="${alertClass} border-l-4 ${alertClass === 'bg-red-100' ? 'border-red-500' : alertClass === 'bg-yellow-100' ? 'border-yellow-500' : 'border-green-500'} p-4 mb-4 rounded text-${alertClass === 'bg-red-100' ? 'red' : alertClass === 'bg-yellow-100' ? 'yellow' : 'green'}-800">
                <p class="text-sm font-medium">${alertMessage}</p>
            </div>
        ` : '';

        this.container.innerHTML = `
            <div class="bg-white p-4 rounded shadow mt-8 break-inside-avoid relative hover:z-50 transition-all duration-200">
                <h3 class="text-lg font-semibold mb-4 flex items-center">Bus Factor${createTooltip('Mede o risco de centralização. Critérios: Risco de Atenção se um autor tem > 40% dos commits. Risco Crítico se > 60%.')}</h3>
                ${alertCard}
                <table class="w-full border-collapse border border-gray-300">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="border border-gray-300 px-4 py-2 text-left">Avatar/Nome</th>
                            <th class="border border-gray-300 px-4 py-2 text-right">Total de Commits</th>
                            <th class="border border-gray-300 px-4 py-2 text-left">% do Trabalho</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }
}
