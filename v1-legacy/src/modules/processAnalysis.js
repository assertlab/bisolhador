export class ProcessAnalysis {
    static calculateLeadTime(prStats) {
        const mergedPRs = prStats.filter(pr => pr.merged_at);
        if (mergedPRs.length === 0) return 'N/A';

        const totalHours = mergedPRs.reduce((sum, pr) => {
            const created = new Date(pr.created_at);
            const merged = new Date(pr.merged_at);
            const diffMs = merged - created;
            const diffHours = diffMs / (1000 * 60 * 60);
            return sum + diffHours;
        }, 0);

        const avgHours = totalHours / mergedPRs.length;

        if (avgHours < 24) {
            const formattedValue = Math.round(avgHours * 10) / 10;
            const unit = formattedValue === 1 ? 'hora' : 'horas';
            return `${formattedValue} ${unit}`;
        } else {
            const days = avgHours / 24;
            const formattedValue = Math.round(days * 10) / 10;
            const unit = formattedValue === 1 ? 'dia' : 'dias';
            return `${formattedValue} ${unit}`;
        }
    }

    static calculateDivergence(pullRequests) {
        // Validação dos Dados de Entrada
        if (!pullRequests || pullRequests.length === 0) return { avg: 0, category: 'Sem dados (0 PRs)' };

        // Cálculo Seguro
        const totalComments = pullRequests.reduce((sum, pr) => sum + (pr.comments || 0) + (pr.review_comments || 0), 0);
        const average = totalComments / pullRequests.length;
        const safeAverage = Number.isNaN(average) ? 0 : average;

        // Correção da Classificação
        let category;
        if (safeAverage < 1) {
            category = 'Baixa (Silencioso)';
        } else if (safeAverage <= 5) {
            category = 'Saudável';
        } else {
            category = 'Alta (Debate Intenso)';
        }

        // Formatação
        const formattedAvg = Math.round(safeAverage * 10) / 10;
        return { avg: formattedAvg, category };
    }
}
