export class ConfigComponent {
    constructor(buttonSelector) {
        this.button = document.querySelector(buttonSelector);
        this.bindEvents();
    }

    bindEvents() {
        this.button.addEventListener('click', () => {
            this.handleConfig();
        });
    }

    handleConfig() {
        const currentToken = localStorage.getItem('github_token') || '';
        const newToken = window.prompt('GitHub Personal Access Token (deixe vazio para remover):', currentToken);

        if (newToken === null) return; // Cancelled

        if (newToken.trim() === '') {
            localStorage.removeItem('github_token');
            alert('Token removido.');
        } else {
            localStorage.setItem('github_token', newToken.trim());
            alert('Token salvo.');
        }
    }
}
