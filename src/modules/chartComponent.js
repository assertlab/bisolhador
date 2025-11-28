export class ChartComponent {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.chart = null;
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
}
