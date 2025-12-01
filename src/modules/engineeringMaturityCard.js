export class EngineeringMaturityCard {
    constructor(selector) {
        this.element = document.querySelector(selector);
        this.badgesElement = document.getElementById('maturity-badges');
    }

    update(maturity) {
        this.badgesElement.innerHTML = '';

        this.addBadge('🧪 Testes Detectados', maturity.testsDetected);
        this.addBadge('⚡ CI/CD', maturity.ciCdDetected);
        this.addBadge('🐳 Docker', maturity.dockerDetected);
        this.addBadge('🛡️ Code Review (' + maturity.codeReview.selfMergePercentage + '%)', true, maturity.codeReview.color);

        // Always show zombie branches feedback
        if (maturity.zombies === 0) {
            this.addBadge('✅ Nenhuma Branch Zumbi', true, 'green');
        } else {
            this.addBadge('🧟 ' + maturity.zombies + ' Branches Zumbis detectadas', true, 'red');
        }
    }

    addBadge(text, detected, customColor) {
        const badge = document.createElement('span');
        badge.textContent = text;
        badge.classList.add('px-2', 'py-1', 'rounded-full', 'text-xs', 'font-semibold');

        let bgColor = 'bg-gray-500'; // default gray

        if (customColor) {
            // For code review
            if (customColor === 'green') {
                bgColor = 'bg-green-500';
            } else if (customColor === 'yellow') {
                bgColor = 'bg-yellow-500';
            } else {
                bgColor = 'bg-red-500';
            }
        } else if (detected) {
            bgColor = 'bg-green-500';
        }

        badge.classList.add(bgColor, 'text-white');

        this.badgesElement.appendChild(badge);
    }
}
