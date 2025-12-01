import { createCard } from '../utils/uiHelpers.js';

export class HealthComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    update(profileData, repoDescription) {
        let checklist = {
            readme: false,
            license: false,
            contributing: false,
            description: false,
            code_of_conduct: false,
            issue_template: false,
            pull_request_template: false
        };

        if (profileData && profileData.files) {
            checklist.readme = profileData.files?.readme != null;
            checklist.license = profileData.files?.license != null;
            checklist.contributing = profileData.files?.contributing != null;
            checklist.code_of_conduct = profileData.files?.code_of_conduct != null;
            checklist.issue_template = profileData.files?.issue_template != null;
            checklist.pull_request_template = profileData.files?.pull_request_template != null;
        }

        checklist.description = !!(repoDescription && repoDescription.trim().length > 0);

        // Calculate percentage based on items present / 7 * 100
        const itemsCount = Object.values(checklist).filter(Boolean).length;
        const percentage = Math.round((itemsCount / 7) * 100);

        let colorClass = 'text-red-500';
        if (percentage > 75) {
            colorClass = 'text-green-500';
        } else if (percentage > 50) {
            colorClass = 'text-yellow-500';
        }

        const contentHtml = `
            <div class="text-center mb-4">
                <span class="text-4xl font-bold ${colorClass}">${percentage}%</span>
            </div>
            <div>
                <h4 class="font-medium mb-2">Arquivos Encontrados:</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <p>${checklist.readme ? '✅' : '❌'} README</p>
                    <p>${checklist.license ? '✅' : '❌'} License</p>
                    <p>${checklist.contributing ? '✅' : '❌'} Contributing</p>
                    <p>${checklist.description ? '✅' : '❌'} Description</p>
                    <p>${checklist.code_of_conduct ? '✅' : '❌'} Code of Conduct</p>
                    <p>${checklist.issue_template ? '✅' : '❌'} Issue Template</p>
                    <p>${checklist.pull_request_template ? '✅' : '❌'} PR Template</p>
                </div>
            </div>
        `;

        this.container.innerHTML = createCard("Saúde da Comunidade", contentHtml, "Nota baseada na presença de 7 itens: Readme, License, Contributing, Description, Code of Conduct, Issue Template e PR Template.");
    }
}
