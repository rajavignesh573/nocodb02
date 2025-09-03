#!/usr/bin/env tsx
/**
 * Bulk Product Comparison Script - WITH RESUME CAPABILITY
 *
 * This script compares ALL internal products against ALL external products
 * using the ProductMatchingRules.md algorithm and generates a comprehensive
 * CSV report with detailed matching results.
 *
 * Features:
 * - Incremental CSV writing (writes each match immediately)
 * - Resume capability from failure point using checkpoints
 * - Progress tracking and statistics
 * - Only logs actual matches (confidence >= 50%)
 *
 * Usage:
 *   npx tsx src/scripts/bulk-product-comparison-resume.ts
 */
declare class BulkProductComparisonResume {
    private results;
    private processedCount;
    private startTime;
    private readonly MINIMUM_MATCH_CONFIDENCE;
    private csvWriter;
    private csvPath;
    private processedInternalIds;
    private readonly CHECKPOINT_FILE;
    constructor();
    /**
     * Main execution method
     */
    run(): Promise<void>;
    /**
     * Load all internal products from database
     */
    private loadInternalProducts;
    /**
     * Load all external products from database
     */
    private loadExternalProducts;
    /**
     * Perform all product comparisons using the ProductMatchingRules.md algorithm
     * OPTIMIZED: Only logs actual matches, not all comparisons
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
     * Initialize CSV writer for incremental writing
     */
    private initializeCSVWriter;
    /**
     * Write a single result to CSV immediately
     */
    private writeResultToCSV;
    /**
     * Load checkpoint data to resume from failure point
     */
    private loadCheckpoint;
    /**
     * Save checkpoint data
     */
    private saveCheckpoint;
    /**
     * Clean up checkpoint file on successful completion
     */
    private cleanupCheckpoint;
    /**
     * Display summary statistics
     */
    private displaySummary;
}
export { BulkProductComparisonResume };
//# sourceMappingURL=bulk-product-comparison-resume.d.ts.map