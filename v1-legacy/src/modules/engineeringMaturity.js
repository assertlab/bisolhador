export class EngineeringMaturity {
    static analyze(tree, pullRequests, zombies) {
        const testsDetected = this.detectTests(tree);
        const ciCdDetected = this.detectCiCd(tree);
        const dockerDetected = this.detectDocker(tree);
        const lintDetected = this.detectLinter(tree);
        const codeReview = this.analyzeCodeReview(pullRequests);

        return {
            testsDetected,
            ciCdDetected,
            dockerDetected,
            lintDetected,
            codeReview,
            zombies
        };
    }

    static detectTests(tree) {
        if (!tree || !Array.isArray(tree)) return false;

        for (const file of tree) {
            if (!file.path) continue;

            const path = file.path.toLowerCase();

            // Java/Kotlin
            if (path.includes('src/test/')) {
                return true;
            }

            // JS/TS
            if (path.includes('__tests__') ||
                path.endsWith('.test.js') || path.endsWith('.test.ts') ||
                path.endsWith('.spec.js') || path.endsWith('.spec.ts')) {
                return true;
            }

            // Python
            if (path.startsWith('tests/') || path.startsWith('test_')) {
                return true;
            }

            // Go
            if (path.endsWith('_test.go')) {
                return true;
            }

            // Rust
            if (path.startsWith('tests/')) {
                return true;
            }
        }

        return false;
    }

    static detectCiCd(tree) {
        if (!tree || !Array.isArray(tree)) return false;

        for (const file of tree) {
            if (file.path && file.path.startsWith('.github/workflows')) {
                return true;
            }
        }

        return false;
    }

    static detectDocker(tree) {
        if (!tree || !Array.isArray(tree)) return false;

        for (const file of tree) {
            if (file.path === 'Dockerfile' || file.path === 'docker-compose.yml') {
                return true;
            }
        }

        return false;
    }

    static detectLinter(tree) {
        if (!tree || !Array.isArray(tree)) return false;

        const linterFiles = ['.eslintrc', '.pylintrc', 'checkstyle.xml', 'sonar-project.properties'];

        for (const file of tree) {
            if (file.path) {
                for (const linterFile of linterFiles) {
                    if (file.path.includes(linterFile)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    static analyzeCodeReview(pullRequests) {
        if (!pullRequests || !Array.isArray(pullRequests)) {
            return { selfMergePercentage: 0, color: 'gray' };
        }

        const mergedPRs = pullRequests.filter(pr => pr.merged_at);
        const totalMerged = mergedPRs.length;

        if (totalMerged === 0) {
            return { selfMergePercentage: 0, color: 'gray' };
        }

        const selfMerges = mergedPRs.filter(pr => pr.merged_by && pr.user && pr.merged_by.login === pr.user.login).length;
        const percentage = (selfMerges / totalMerged) * 100;

        let color = 'red';
        if (percentage < 20) {
            color = 'green';
        } else if (percentage < 50) {
            color = 'yellow';
        }

        return { selfMergePercentage: Math.round(percentage), color };
    }
}
