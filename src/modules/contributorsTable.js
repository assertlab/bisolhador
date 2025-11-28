export class ContributorsTable {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    update(contributors) {
        // Sort by contributions descending
        contributors.sort((a, b) => b.contributions - a.contributions);

        // Calculate total contributions
        const totalContributions = contributors.reduce((sum, c) => sum + c.contributions, 0);

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

        this.container.innerHTML = `
            <div class="bg-white p-4 rounded shadow mt-8">
                <h3 class="text-lg font-semibold mb-4">Top Contribuidores</h3>
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
