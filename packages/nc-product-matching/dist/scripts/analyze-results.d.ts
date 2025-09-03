#!/usr/bin/env tsx
/**
 * CSV Results Analyzer
 *
 * Analyzes the productmatchingresults.csv file and provides insights
 *
 * Usage:
 *   npx tsx src/scripts/analyze-results.ts
 */
declare class ResultsAnalyzer {
    private csvPath;
    private results;
    constructor(csvPath?: string);
    analyze(): Promise<void>;
    private loadResults;
    private parseCSVLine;
    private analyzeScenarios;
    private analyzeTiers;
    private analyzeScores;
    private analyzePrices;
    private analyzeBrands;
    private analyzeCategories;
    private showTopMatches;
    private showProblemCases;
}
export { ResultsAnalyzer };
//# sourceMappingURL=analyze-results.d.ts.map