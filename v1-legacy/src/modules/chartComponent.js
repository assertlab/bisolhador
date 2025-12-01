import { WorkHabits } from './workHabits.js';
import { createTooltip } from '../utils/uiHelpers.js';

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

        // Display work habits
        this.displayWorkHabits(commits);

        // Update title with tooltip
        const h3 = this.canvas.parentElement.querySelector('h3');
        if (h3) {
            h3.innerHTML = `Commits por Dia da Semana (Amostra: ${commits.length} commits)${createTooltip('Analisa o horário dos commits da amostra atual. Critérios: Alerta se > 30% forem de Madrugada (00h-06h) ou > 50% no Fim de Semana.')}`;
            h3.classList.add('flex', 'items-center');
        }
    }

    displayWorkHabits(commits) {
        const parent = this.canvas.parentElement;

        // Remove previous habits label if exists
        const existingLabel = parent.querySelector('.work-habits-label');
        if (existingLabel) {
            existingLabel.remove();
        }

        const habits = WorkHabits.analyze(commits);

        const labelDiv = document.createElement('div');
        labelDiv.className = 'work-habits-label p-2 mb-2 rounded text-center font-medium';
        labelDiv.style.backgroundColor = habits.color === 'yellow' ? '#fff3cd' : habits.color === 'green' ? '#d1e7dd' : '#f8f9fa';
        labelDiv.style.border = '1px solid #ccc';
        labelDiv.textContent = habits.status;

        // Insert before the canvas
        parent.insertBefore(labelDiv, this.canvas);
    }

    renderCommitHistoryChart(commitActivity, createdAt) {
        const rawData = commitActivity.all || [];
        const createdDate = new Date(createdAt);
        const now = new Date();
        const weeksAlive = Math.ceil((now - createdDate) / (7 * 24 * 60 * 60 * 1000));

        // Smart trim for young projects
        let trimmedData = rawData;
        let startIndex = 0;
        const isYoungProject = weeksAlive < 52;
        if (isYoungProject) {
            // Show only from creation - 2 weeks to now, to avoid edge clipping
            startIndex = Math.max(0, 52 - weeksAlive - 2);
            trimmedData = rawData.slice(startIndex);
        }

        // Generate labels based on dates
        const labels = trimmedData.map((_, index) => {
            const weeksBack = (trimmedData.length - 1 - index);
            const pointDate = new Date(now);
            pointDate.setDate(pointDate.getDate() - weeksBack * 7);
            return pointDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        });

        // Destroy previous chart if exists
        if (this.chart) {
            this.chart.destroy();
        }

        // Create new line chart
        this.chart = new Chart(this.canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Commits por Semana',
                    data: trimmedData,
                    borderColor: 'rgba(54, 162, 235, 1}',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: isYoungProject ? 'Semanas (desde criação)' : 'Semanas (das últimas 52)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Quantidade de Commits'
                        }
                    }
                }
            }
        });

        // Add title
        const h3 = this.canvas.parentElement.querySelector('h3');
        if (h3) {
            h3.innerHTML = isYoungProject ? 'Fluxo de Trabalho - Desde Criação' : 'Fluxo de Trabalho - Últimas 52 Semanas';
        } else {
            const title = document.createElement('h3');
            title.className = 'text-lg font-semibold mb-4';
            title.textContent = isYoungProject ? 'Fluxo de Trabalho - Desde Criação' : 'Fluxo de Trabalho - Últimas 52 Semanas';
            this.canvas.parentElement.insertBefore(title, this.canvas);
        }
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
