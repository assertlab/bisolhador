export class ProcessAnalysisCard {
    constructor() {
        this.leadTimeElement = document.getElementById('lead-time-value');
        this.divergenceValueElement = document.getElementById('divergence-value');
        this.divergenceCategoryElement = document.getElementById('divergence-category');
    }

    update(leadTime, divergence) {
        this.leadTimeElement.textContent = leadTime;
        this.divergenceValueElement.textContent = divergence.avg;
        this.divergenceCategoryElement.textContent = divergence.category;
    }
}
