#!/usr/bin/env tsx
"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkProductComparison = void 0;
const path = __importStar(require("path"));
const csv_writer_1 = require("csv-writer");
const EnhancedMatchingEngine_1 = require("../helpers/EnhancedMatchingEngine");
const database_helper_1 = require("./database-helper");
class BulkProductComparison {
    constructor(useDatabase = true, // Default to database now
    batchSize = 1000 // Process in batches for large datasets
    ) {
        this.useDatabase = useDatabase;
        this.batchSize = batchSize;
        this.results = [];
        this.processedCount = 0;
        this.totalComparisons = 0;
        this.startTime = Date.now();
        this.MINIMUM_MATCH_CONFIDENCE = 50.0; // Only log matches above this threshold
        this.processedInternalIds = new Set(); // Track processed products for resume
        this.CHECKPOINT_FILE = 'comparison_checkpoint.json';
        console.log('🚀 Initializing Bulk Product Comparison Script');
        console.log('📋 Algorithm: ProductMatchingRules.md specification');
        console.log(`💾 Data source: ${useDatabase ? 'Real Database (pim)' : 'Test data'}`);
        console.log(`📦 Batch size: ${batchSize} products per batch`);
    }
    /**
     * Main execution method
     */
    async run() {
        try {
            console.log('\n📊 Starting bulk product comparison...\n');
            // Initialize database connection
            if (this.useDatabase) {
                console.log('🔗 Initializing database connection...');
                await database_helper_1.DatabaseHelper.initialize();
                // Show database statistics
                const stats = await database_helper_1.DatabaseHelper.getStatistics();
                console.log('📈 Database Statistics:');
                console.log(`   Internal products: ${stats.internalProductCount.toLocaleString()}`);
                console.log(`   External products: ${stats.externalProductCount.toLocaleString()}`);
                console.log(`   GTIN coverage: ${stats.gtinCoverage.internal}/${stats.internalProductCount} internal, ${stats.gtinCoverage.external}/${stats.externalProductCount} external`);
                console.log();
            }
            // Initialize CSV writer and load checkpoint
            await this.initializeCSVWriter();
            await this.loadCheckpoint();
            // Step 1: Load all internal products
            console.log('📥 Loading internal products...');
            const allInternalProducts = await this.loadInternalProducts();
            // Filter out already processed products
            const internalProducts = allInternalProducts.filter(p => !this.processedInternalIds.has(p.id.toString()));
            console.log(`✅ Loaded ${allInternalProducts.length} total internal products`);
            console.log(`🔄 Resuming: ${internalProducts.length} products remaining to process`);
            // Step 2: Load all external products
            console.log('📥 Loading external products...');
            const externalProducts = await this.loadExternalProducts();
            console.log(`✅ Loaded ${externalProducts.length} external products`);
            // Step 3: Calculate total comparisons
            this.totalComparisons = internalProducts.length * externalProducts.length;
            console.log(`🔢 Remaining comparisons to perform: ${this.totalComparisons.toLocaleString()}`);
            if (this.totalComparisons > 1000000) {
                console.log('⚠️  Large dataset detected. Processing in batches...');
            }
            // Step 4: Perform comparisons (only on remaining products)
            console.log('\n🔄 Starting product comparisons...');
            await this.performComparisons(internalProducts, externalProducts);
            // Step 5: Clean up checkpoint on successful completion
            await this.cleanupCheckpoint();
            // Step 6: Display summary
            this.displaySummary();
        }
        catch (error) {
            console.error('❌ Error during bulk comparison:', error);
            console.log(`💾 Progress saved to checkpoint. Resume with: npm run bulk-compare-db`);
            // Clean up database connection
            if (this.useDatabase) {
                await database_helper_1.DatabaseHelper.close();
            }
            process.exit(1);
        }
        finally {
            // Always close database connection
            if (this.useDatabase) {
                await database_helper_1.DatabaseHelper.close();
            }
        }
    }
    /**
     * Load all internal products from database
     */
    async loadInternalProducts() {
        if (this.useDatabase) {
            // Load from real database using batching for large datasets
            const allProducts = [];
            let offset = 0;
            let hasMore = true;
            while (hasMore) {
                const batch = await database_helper_1.DatabaseHelper.loadInternalProducts(this.batchSize, offset);
                if (batch.length === 0) {
                    hasMore = false;
                }
                else {
                    allProducts.push(...batch);
                    offset += this.batchSize;
                    console.log(`📥 Loaded ${allProducts.length} internal products so far...`);
                }
                // Prevent infinite loop
                if (offset > 50000) {
                    console.log('⚠️  Reached safety limit of 50,000 products');
                    break;
                }
            }
            return allProducts;
        }
        // Fallback test data (should not be used based on user requirements)
        console.log('⚠️  Using fallback test data - this should not happen!');
        return [];
    }
    /**
     * Load all external products from database
     */
    async loadExternalProducts() {
        if (this.useDatabase) {
            // Load from real database using batching for large datasets
            const allProducts = [];
            let offset = 0;
            let hasMore = true;
            while (hasMore) {
                const batch = await database_helper_1.DatabaseHelper.loadExternalProducts(this.batchSize, offset);
                if (batch.length === 0) {
                    hasMore = false;
                }
                else {
                    allProducts.push(...batch);
                    offset += this.batchSize;
                    console.log(`📥 Loaded ${allProducts.length} external products so far...`);
                }
                // Prevent infinite loop
                if (offset > 20000) {
                    console.log('⚠️  Reached safety limit of 20,000 products');
                    break;
                }
            }
            return allProducts;
        }
        // Fallback test data (should not be used based on user requirements)
        console.log('⚠️  Using fallback test data - this should not happen!');
        return [];
    }
    /**
     * Perform all product comparisons using the ProductMatchingRules.md algorithm
     * OPTIMIZED: Only logs actual matches, not all comparisons
     */
    async performComparisons(internalProducts, externalProducts) {
        console.log(`\n🚀 Starting optimized comparison of ${internalProducts.length} internal products...`);
        console.log(`📊 Will only log products that have actual matches (score ≥ 50%)`);
        let processedProducts = 0;
        let productsWithMatches = 0;
        let totalMatches = 0;
        for (let i = 0; i < internalProducts.length; i++) {
            const internal = internalProducts[i];
            processedProducts++;
            // Create source info for the matching engine
            const sourceInfo = {
                id: 'bulk_comparison',
                code: 'BULK',
                name: 'Bulk Comparison Script'
            };
            try {
                // Use the ProductMatchingRules.md algorithm via EnhancedMatchingEngine
                const matches = await EnhancedMatchingEngine_1.EnhancedMatchingEngine.findMatches(internal, externalProducts, sourceInfo);
                // ONLY process matches that meet minimum quality threshold
                const qualityMatches = matches.filter(match => match.confidence >= 50.0);
                if (qualityMatches.length > 0) {
                    productsWithMatches++;
                    console.log(`\n✅ MATCH FOUND [${productsWithMatches}] Internal: "${internal.title}" (${qualityMatches.length} matches)`);
                    // Process each quality match result
                    for (const match of qualityMatches) {
                        const external = externalProducts.find(ext => ext.external_product_key === match.external_product_key);
                        if (!external)
                            continue;
                        // Determine scenario match type
                        const scenarioMatch = this.determineScenarioMatch(internal, external, match);
                        // Calculate price difference percentage
                        const priceDiffPct = this.calculatePriceDifference(internal.price, external.price);
                        // Create comparison result
                        const result = {
                            internal_ean_gtin: internal.gtin || '',
                            external_ean_gtin: external.gtin || '',
                            internal_product_name: internal.title,
                            internal_brand: internal.moombs_brand || internal.brand || '',
                            internal_category: internal.moombs_category || internal.category_id || '',
                            external_product_name: external.title,
                            external_brand: external.brand || '',
                            external_category: external.category_id || '',
                            internal_price: internal.price || 0,
                            external_price: external.price || 0,
                            scenario_match: scenarioMatch,
                            score: Math.round(match.score * 100) / 100, // Round to 2 decimal places
                            confidence: Math.round(match.confidence * 10) / 10, // Round to 1 decimal place
                            tier: match.tier,
                            match_reasons: match.reasons.join('; '),
                            name_score: Math.round(match.subscores.name * 10) / 10,
                            brand_score: Math.round(match.subscores.brand * 10) / 10,
                            category_score: Math.round(match.subscores.category * 10) / 10,
                            price_score: Math.round(match.subscores.price * 10) / 10,
                            price_difference_pct: priceDiffPct
                        };
                        this.results.push(result);
                        totalMatches++;
                    }
                    console.log(`   💯 Confidence: ${qualityMatches[0].confidence}% | Tier: ${qualityMatches[0].tier} | Matches: ${qualityMatches.length}`);
                }
                // Progress reporting every 50 products
                if (processedProducts % 50 === 0) {
                    const progress = (processedProducts / internalProducts.length * 100).toFixed(1);
                    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);
                    const rate = (processedProducts / (Date.now() - this.startTime) * 1000).toFixed(1);
                    console.log(`\n📊 PROGRESS: ${processedProducts}/${internalProducts.length} (${progress}%) | Products with matches: ${productsWithMatches} | Total matches: ${totalMatches} | Rate: ${rate}/sec | Elapsed: ${elapsed}s`);
                }
            }
            catch (error) {
                console.error(`❌ Error processing internal product ${internal.id}:`, error);
                continue;
            }
        }
        const finalElapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);
        console.log(`\n✅ COMPARISON COMPLETE!`);
        console.log(`📊 Processed: ${processedProducts} internal products`);
        console.log(`🎯 Products with matches: ${productsWithMatches} (${(productsWithMatches / processedProducts * 100).toFixed(1)}%)`);
        console.log(`📋 Total match results: ${this.results.length}`);
        console.log(`⏱️  Total time: ${finalElapsed}s`);
    }
    /**
     * Determine if match was based on EAN/GTIN or fallback algorithm
     */
    determineScenarioMatch(internal, external, match) {
        // Check if both have GTIN and they match
        if (internal.gtin && external.gtin) {
            const cleanInternal = internal.gtin.replace(/\s+/g, '').padStart(14, '0');
            const cleanExternal = external.gtin.replace(/\s+/g, '').padStart(14, '0');
            if (cleanInternal === cleanExternal) {
                return 'EAN_EXACT';
            }
        }
        return 'FALLBACK_ALGORITHM';
    }
    /**
     * Calculate price difference percentage
     */
    calculatePriceDifference(internalPrice, externalPrice) {
        if (!internalPrice || !externalPrice)
            return 0;
        const diff = Math.abs(externalPrice - internalPrice);
        const avg = (internalPrice + externalPrice) / 2;
        return Math.round((diff / avg) * 100 * 10) / 10; // Round to 1 decimal place
    }
    /**
     * Generate CSV report with all comparison results
     */
    async generateCSVReport() {
        const outputPath = path.join(process.cwd(), 'productmatchingresults.csv');
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: outputPath,
            header: [
                { id: 'internal_ean_gtin', title: 'Internal EAN/GTIN' },
                { id: 'external_ean_gtin', title: 'External EAN/GTIN' },
                { id: 'internal_product_name', title: 'Internal Product Name' },
                { id: 'internal_brand', title: 'Internal Brand' },
                { id: 'internal_category', title: 'Internal Category' },
                { id: 'external_product_name', title: 'External Product Name' },
                { id: 'external_brand', title: 'External Brand' },
                { id: 'external_category', title: 'External Category' },
                { id: 'internal_price', title: 'Internal Price' },
                { id: 'external_price', title: 'External Price' },
                { id: 'scenario_match', title: 'Scenario Match (EAN or fallback)' },
                { id: 'score', title: 'Score' },
                { id: 'confidence', title: 'Confidence' },
                { id: 'tier', title: 'Tier' },
                { id: 'match_reasons', title: 'Match Reasons' },
                { id: 'name_score', title: 'Name Score' },
                { id: 'brand_score', title: 'Brand Score' },
                { id: 'category_score', title: 'Category Score' },
                { id: 'price_score', title: 'Price Score' },
                { id: 'price_difference_pct', title: 'Price Difference %' }
            ]
        });
        // Sort results by score descending
        this.results.sort((a, b) => b.score - a.score);
        await csvWriter.writeRecords(this.results);
        console.log(`✅ CSV report generated: ${outputPath}`);
        console.log(`📊 Total records: ${this.results.length}`);
    }
    /**
     * Display summary statistics
     */
    displaySummary() {
        const elapsed = (Date.now() - this.startTime) / 1000;
        console.log('\n' + '='.repeat(80));
        console.log('📊 BULK PRODUCT COMPARISON SUMMARY');
        console.log('='.repeat(80));
        console.log(`⏱️  Total execution time: ${elapsed.toFixed(2)} seconds`);
        console.log(`🔢 Total matches generated: ${this.results.length.toLocaleString()}`);
        console.log(`⚡ Processing rate: ${(this.results.length / elapsed).toFixed(1)} matches/second`);
        // Scenario breakdown
        const eanMatches = this.results.filter(r => r.scenario_match === 'EAN_EXACT').length;
        const fallbackMatches = this.results.filter(r => r.scenario_match === 'FALLBACK_ALGORITHM').length;
        console.log(`\n📋 Scenario Breakdown:`);
        console.log(`   EAN/GTIN Exact Matches: ${eanMatches.toLocaleString()} (${(eanMatches / this.results.length * 100).toFixed(1)}%)`);
        console.log(`   Fallback Algorithm: ${fallbackMatches.toLocaleString()} (${(fallbackMatches / this.results.length * 100).toFixed(1)}%)`);
        // Tier breakdown
        const highTier = this.results.filter(r => r.tier === 'high').length;
        const reviewTier = this.results.filter(r => r.tier === 'review').length;
        const lowTier = this.results.filter(r => r.tier === 'low').length;
        console.log(`\n🎯 Quality Tiers:`);
        console.log(`   High Confidence (≥85%): ${highTier.toLocaleString()} (${(highTier / this.results.length * 100).toFixed(1)}%)`);
        console.log(`   Review Tier (70-84.9%): ${reviewTier.toLocaleString()} (${(reviewTier / this.results.length * 100).toFixed(1)}%)`);
        console.log(`   Low Confidence (<70%): ${lowTier.toLocaleString()} (${(lowTier / this.results.length * 100).toFixed(1)}%)`);
        // Score statistics
        const scores = this.results.map(r => r.score);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);
        console.log(`\n📈 Score Statistics:`);
        console.log(`   Average Score: ${avgScore.toFixed(2)}`);
        console.log(`   Highest Score: ${maxScore.toFixed(2)}`);
        console.log(`   Lowest Score: ${minScore.toFixed(2)}`);
        console.log(`\n📄 Report saved to: productmatchingresults.csv`);
        console.log('='.repeat(80));
    }
}
exports.BulkProductComparison = BulkProductComparison;
// Execute the script
if (require.main === module) {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const useTestData = args.includes('--test');
    const useDatabase = !useTestData; // Default to database unless --test is specified
    // Show help
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`\n📋 Bulk Product Comparison Script - Real Database Version`);
        console.log(`\nUsage:`);
        console.log(`  npx tsx src/scripts/bulk-product-comparison.ts                    # Run with DATABASE data (default)`);
        console.log(`  npx tsx src/scripts/bulk-product-comparison.ts --test             # Run with test data`);
        console.log(`\nOptions:`);
        console.log(`  --test                    Use test data instead of database`);
        console.log(`  --help, -h                Show this help`);
        console.log(`\nDatabase Config:`);
        console.log(`  Uses environment variables: DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT`);
        console.log(`  Internal table: odoo_moombs_int_product_data`);
        console.log(`  External table: nc_external_products`);
        console.log(`\nOutput:`);
        console.log(`  productmatchingresults.csv - Detailed comparison results`);
        console.log();
        process.exit(0);
    }
    console.log(useDatabase ? '💾 Running with REAL DATABASE data...' :
        '📦 Running with test data...');
    const comparison = new BulkProductComparison(useDatabase);
    comparison.run().catch(console.error);
}
//# sourceMappingURL=bulk-product-comparison.js.map