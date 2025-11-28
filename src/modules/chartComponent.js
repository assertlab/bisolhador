export class ChartComponent {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.chart = null;
    }

    // Cores padrão para linguagens
    static getLanguageColor(language) {
        const colorMap = {
            'JavaScript': '#f1e05a',
            'HTML': '#e34c26',
            'CSS': '#563d7c',
            'Python': '#3572A5',
            'Java': '#b07219',
            'Shell': '#89e051',
            'TypeScript': '#3178c6',
            'C++': '#f34b7d',
            'C': '#555555',
            'Outros': '#cccccc'
        };

        if (colorMap[language]) {
            return colorMap[language];
        }

        // Geração dinâmica baseada no hash da string
        let hash = 0;
        for (let i = 0; i < language.length; i++) {
            hash = language.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 65%, 60%)`;
    }

    update(commits) {
        // Days in order: Domingo, Segunda, Terça, Quarta, Quinta, Sexta, Sábado
        const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const counts = new Array(7).fill(0);

        commits.forEach(commit => {
            const date = new Date(commit.commit.committer.date);
            const day = date.getDay(); // 0 = Sunday, but our array starts with Domingo
            // Map: Sun=0 -> index 0 (Domingo), Mon=1 ->1, etc., Sat=6 ->6 (Sábado)
            counts[day] = (counts[day] || 0) + 1;
        });

        // Destroy previous chart if exists
        if (this.chart) {
            this.chart.destroy();
        }

        // Create new chart
        this.chart = new Chart(this.canvas, {
            type: 'bar',
            data: {
                labels: days,
                datasets: [{
                    label: 'Commits',
                    data: counts,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    updateLanguages(languages) {
        // Calcular porcentagens iniciais
        const total = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
        const languageEntries = Object.entries(languages).map(([label, bytes]) => ({
            label,
            bytes,
            percentage: (bytes / total) * 100
        }));

        // Filtrar linguagens com menos de 1% e agrupar em "Outros"
        const mainLanguages = [];
        let outrosbytes = 0;

        languageEntries.forEach(entry => {
            if (entry.percentage >= 1) {
                mainLanguages.push(entry);
            } else {
                outrosbytes += entry.bytes;
            }
        });

        // Adicionar "Outros" se houver linguagens pequenas
        if (outrosbytes > 0) {
            const outrosPercentage = (outrosbytes / total) * 100;
            mainLanguages.push({
                label: 'Outros',
                bytes: outrosbytes,
                percentage: outrosPercentage
            });
        }

        // Preparar dados finais
        const labels = mainLanguages.map(lang => lang.label);
        const data = mainLanguages.map(lang => lang.percentage.toFixed(1));
        const backgroundColors = labels.map(label => ChartComponent.getLanguageColor(label));

        // Destroy previous chart if exists
        if (this.chart) {
            this.chart.destroy();
        }

        // Create new doughnut chart
        this.chart = new Chart(this.canvas, {
            type: 'doughnut',
            data: {
                labels: labels.map((label, index) => `${label}: ${data[index]}%`),
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label.split(':')[0]}: ${context.raw}%`;
                            }
                        }
                    }
                }
            }
        });
    }
}
