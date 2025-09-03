#!/usr/bin/env tsx
/**
 * Bulk Product Comparison Script - FIXED VERSION
 *
 * This script compares ALL internal products against ALL external products
 * using the ProductMatchingRules.md algorithm and generates a comprehensive
 * CSV report with detailed matching results.
 *
 * Usage:
 *   npx tsx src/scripts/bulk-product-comparison-fixed.ts
 *   npx tsx src/scripts/bulk-product-comparison-fixed.ts --database
 *   npx tsx src/scripts/bulk-product-comparison-fixed.ts --help
 */
declare class BulkProductComparison {
    private useDatabase;
    private results;
    private processedCount;
    private totalComparisons;
    private startTime;
    constructor(useDatabase?: boolean);
    /**
     * Main execution method
     */
    run(): Promise<void>;
    /**
     * Load all internal products
     */
    private loadInternalProducts;
    /**
     * Load all external products
     */
    private loadExternalProducts;
    /**
     * Perform all product comparisons using the ProductMatchingRules.md algorithm
     */
    private performComparisons;
    /**
     * Determine if match was based on EAN/GTIN or fallback algorithm
     */
    private determineScenarioMatch;
    /**
     * Calculate price difference percentage
     */
    private calculatePriceDifference;
    /**
     * Generate CSV report with all comparison results
     */
    private generateCSVReport;
    /**
     * Display summary statistics
     */
    private displaySummary;
}
export { BulkProductComparison };
//# sourceMappingURL=bulk-product-comparison-fixed.d.ts.map