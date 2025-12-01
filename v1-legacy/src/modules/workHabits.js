export class WorkHabits {
    static analyze(commits) {
        if (!commits || commits.length === 0) {
            return '👔 Ritmo Sustentável (Nenhum commit para análise)';
        }

        let totalCommits = 0;
        let madrugadaCommits = 0;
        let weekendCommits = 0;
        const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

        commits.forEach(commit => {
            const date = new Date(commit.commit.author.date);
            const hour = date.getHours();
            const day = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

            totalCommits++;

            // Madrugada: 00h às 06h (0 to 5:59, so hour 0-5)
            if (hour >= 0 && hour < 6) {
                madrugadaCommits++;
            }

            // Fim de Semana: Domingo (0) ou Sábado (6)
            if (day === 0 || day === 6) {
                weekendCommits++;
            }
        });

        const madrugadaPercent = (madrugadaCommits / totalCommits) * 100;
        const weekendPercent = (weekendCommits / totalCommits) * 100;

        let status = '';
        let color = '';

        if (madrugadaPercent > 30) {
            status = '🦉 Modo Coruja (Trabalho noturno intenso)';
            color = 'yellow';
        } else if (weekendPercent > 50) {
            status = '📅 Guerreiro de Fim de Semana (Foco fora de dias úteis)';
            color = 'yellow';
        } else {
            status = '👔 Ritmo Sustentável (Maioria em horário comercial)';
            color = 'green';
        }

        return { status, color, madrugadaPercent, weekendPercent, totalCommits };
    }
}
