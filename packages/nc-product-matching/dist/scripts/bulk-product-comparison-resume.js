#!/usr/bin/env tsx
"use strict";
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
exports.BulkProductComparisonResume = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const csv_writer_1 = require("csv-writer");
const EnhancedMatchingEngine_1 = require("../helpers/EnhancedMatchingEngine");
const database_helper_1 = require("./database-helper");
class BulkProductComparisonResume {
    constructor() {
        this.results = [];
        this.processedCount = 0;
        this.startTime = Date.now();
        this.MINIMUM_MATCH_CONFIDENCE = 50.0; // Only log matches above this threshold
        this.processedInternalIds = new Set(); // Track processed products for resume
        this.CHECKPOINT_FILE = 'comparison_checkpoint.json';
        console.log('🚀 Initializing Bulk Product Comparison Script (Resume Enabled)');
        console.log('📋 Algorithm: ProductMatchingRules.md specification');
        console.log('💾 Data source: Real Database (pim)');
        console.log('📈 Features: Incremental CSV writing, Resume capability, Progress tracking');
    }
    /**
     * Main execution method
     */
    async run() {
        try {
            console.log('\n📊 Starting bulk product comparison with resume capability...\n');
            // Initialize database connection
            console.log('🔗 Initializing database connection...');
            await database_helper_1.DatabaseHelper.initialize();
            // Show database statistics
            const stats = await database_helper_1.DatabaseHelper.getStatistics();
            console.log('📈 Database Statistics:');
            console.log(`   Internal products: ${stats.internalProductCount.toLocaleString()}`);
            console.log(`   External products: ${stats.externalProductCount.toLocaleString()}`);
            console.log(`   GTIN coverage: ${stats.gtinCoverage.internal}/${stats.internalProductCount} internal, ${stats.gtinCoverage.external}/${stats.externalProductCount} external`);
            console.log();
            // Initialize CSV writer and load checkpoint
            await this.initializeCSVWriter();
            await this.loadCheckpoint();
            // Load all internal products
            console.log('📥 Loading internal products...');
            const allInternalProducts = await this.loadInternalProducts();
            // Filter out already processed products
            const internalProducts = allInternalProducts.filter(p => !this.processedInternalIds.has(p.id.toString()));
            console.log(`✅ Loaded ${allInternalProducts.length} total internal products`);
            console.log(`🔄 Resuming: ${internalProducts.length} products remaining to process`);
            // Load all external products
            console.log('📥 Loading external products...');
            const externalProducts = await this.loadExternalProducts();
            console.log(`✅ Loaded ${externalProducts.length} external products`);
            // Calculate remaining comparisons
            const totalComparisons = internalProducts.length * externalProducts.length;
            console.log(`🔢 Remaining comparisons to perform: ${totalComparisons.toLocaleString()}`);
            if (totalComparisons > 1000000) {
                console.log('⚠️  Large dataset detected. Using incremental processing...');
            }
            // Perform comparisons (only on remaining products)
            console.log('\n🔄 Starting product comparisons...');
            await this.performComparisons(internalProducts, externalProducts);
            // Clean up checkpoint on successful completion
            await this.cleanupCheckpoint();
            // Display summary
            this.displaySummary();
        }
        catch (error) {
            console.error('❌ Error during bulk comparison:', error);
            console.log(`💾 Progress saved to checkpoint. Resume with: npx tsx src/scripts/bulk-product-comparison-resume.ts`);
            // Clean up database connection
            await database_helper_1.DatabaseHelper.close();
            process.exit(1);
        }
        finally {
            // Always close database connection
            await database_helper_1.DatabaseHelper.close();
        }
    }
    /**
     * Load all internal products from database
     */
    async loadInternalProducts() {
        const allProducts = [];
        let offset = 0;
        const batchSize = 1000;
        let hasMore = true;
        while (hasMore) {
            const batch = await database_helper_1.DatabaseHelper.loadInternalProducts(batchSize, offset);
            allProducts.push(...batch);
            if (batch.length < batchSize) {
                hasMore = false;
            }
            else {
                offset += batchSize;
            }
        }
        return allProducts;
    }
    /**
     * Load all external products from database
     */
    async loadExternalProducts() {
        const allProducts = [];
        let offset = 0;
        const batchSize = 1000;
        let hasMore = true;
        while (hasMore) {
            const batch = await database_helper_1.DatabaseHelper.loadExternalProducts(batchSize, offset);
            allProducts.push(...batch);
            if (batch.length < batchSize) {
                hasMore = false;
            }
            else {
                offset += batchSize;
            }
        }
        return allProducts;
    }
    /**
     * Perform all product comparisons using the ProductMatchingRules.md algorithm
     * OPTIMIZED: Only logs actual matches, not all comparisons
     */
    async performComparisons(internalProducts, externalProducts) {
        console.log(`\n🚀 Starting optimized comparison of ${internalProducts.length} internal products...`);
        console.log(`📊 Will only log products that have actual matches (score ≥ ${this.MINIMUM_MATCH_CONFIDENCE}%)`);
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
                const qualityMatches = matches.filter(match => match.confidence >= this.MINIMUM_MATCH_CONFIDENCE);
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
                            internal_id: internal.id.toString(),
                            external_id: external.external_product_key,
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
                            price_difference_pct: priceDiffPct,
                            processed_at: new Date().toISOString()
                        };
                        // Write to CSV immediately
                        await this.writeResultToCSV(result);
                        this.results.push(result);
                        totalMatches++;
                    }
                    console.log(`   💯 Confidence: ${qualityMatches[0].confidence}% | Tier: ${qualityMatches[0].tier} | Matches: ${qualityMatches.length}`);
                }
                // Mark this product as processed
                this.processedInternalIds.add(internal.id.toString());
                // Save checkpoint every 10 products
                if (processedProducts % 10 === 0) {
                    await this.saveCheckpoint();
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
            const internalGtin = internal.gtin.replace(/\D/g, ''); // Remove non-digits
            const externalGtin = external.gtin.replace(/\D/g, '');
            if (internalGtin === externalGtin && internalGtin.length >= 8) {
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
        const diff = Math.abs(internalPrice - externalPrice);
        const avg = (internalPrice + externalPrice) / 2;
        if (avg === 0)
            return 0;
        return Math.round((diff / avg) * 100 * 10) / 10; // Round to 1 decimal place
    }
    /**
     * Initialize CSV writer for incremental writing
     */
    async initializeCSVWriter() {
        this.csvPath = path.join(process.cwd(), 'productmatchingresults.csv');
        // Check if file exists to determine if we need headers
        const fileExists = fs.existsSync(this.csvPath);
        this.csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: this.csvPath,
            header: [
                { id: 'internal_id', title: 'Internal ID' },
                { id: 'external_id', title: 'External ID' },
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
                { id: 'tier', title: 'Quality Tier' },
                { id: 'match_reasons', title: 'Match Reasons' },
                { id: 'name_score', title: 'Name Score' },
                { id: 'brand_score', title: 'Brand Score' },
                { id: 'category_score', title: 'Category Score' },
                { id: 'price_score', title: 'Price Score' },
                { id: 'price_difference_pct', title: 'Price Difference %' },
                { id: 'processed_at', title: 'Processed At' }
            ],
            append: fileExists // Append if file exists, otherwise create with headers
        });
        if (!fileExists) {
            console.log(`📄 Creating new CSV file: ${this.csvPath}`);
        }
        else {
            console.log(`📄 Appending to existing CSV file: ${this.csvPath}`);
        }
    }
    /**
     * Write a single result to CSV immediately
     */
    async writeResultToCSV(result) {
        try {
            await this.csvWriter.writeRecords([result]);
        }
        catch (error) {
            console.error('❌ Error writing to CSV:', error);
            throw error;
        }
    }
    /**
     * Load checkpoint data to resume from failure point
     */
    async loadCheckpoint() {
        const checkpointPath = path.join(process.cwd(), this.CHECKPOINT_FILE);
        if (fs.existsSync(checkpointPath)) {
            try {
                const checkpointData = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
                this.processedInternalIds = new Set(checkpointData.processedInternalIds || []);
                console.log(`💾 Loaded checkpoint: ${this.processedInternalIds.size} products already processed`);
            }
            catch (error) {
                console.warn('⚠️  Could not load checkpoint, starting fresh:', error);
                this.processedInternalIds = new Set();
            }
        }
        else {
            console.log('🎆 Starting fresh - no checkpoint found');
            this.processedInternalIds = new Set();
        }
    }
    /**
     * Save checkpoint data
     */
    async saveCheckpoint() {
        const checkpointPath = path.join(process.cwd(), this.CHECKPOINT_FILE);
        const checkpointData = {
            processedInternalIds: Array.from(this.processedInternalIds),
            lastUpdated: new Date().toISOString(),
            totalProcessed: this.processedInternalIds.size
        };
        try {
            fs.writeFileSync(checkpointPath, JSON.stringify(checkpointData, null, 2));
        }
        catch (error) {
            console.error('❌ Error saving checkpoint:', error);
        }
    }
    /**
     * Clean up checkpoint file on successful completion
     */
    async cleanupCheckpoint() {
        const checkpointPath = path.join(process.cwd(), this.CHECKPOINT_FILE);
        if (fs.existsSync(checkpointPath)) {
            try {
                fs.unlinkSync(checkpointPath);
                console.log('🧹 Checkpoint file cleaned up - comparison completed successfully');
            }
            catch (error) {
                console.warn('⚠️  Could not clean up checkpoint file:', error);
            }
        }
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
        console.log(`🔍 Total products processed: ${this.processedCount.toLocaleString()}`);
        console.log(`✅ Total matches found: ${this.results.length.toLocaleString()}`);
        console.log(`📄 Results saved to: ${this.csvPath}`);
        if (this.processedCount > 0) {
            const rate = this.processedCount / elapsed;
            console.log(`⚡ Processing rate: ${rate.toFixed(1)} products/second`);
            const matchRate = (this.results.length / this.processedCount) * 100;
            console.log(`🎯 Match rate: ${matchRate.toFixed(1)}%`);
        }
        // Tier breakdown
        const tierStats = this.results.reduce((acc, result) => {
            acc[result.tier] = (acc[result.tier] || 0) + 1;
            return acc;
        }, {});
        console.log('\n📈 Match Quality Distribution:');
        Object.entries(tierStats).forEach(([tier, count]) => {
            const percentage = (count / this.results.length * 100).toFixed(1);
            console.log(`   ${tier}: ${count} (${percentage}%)`);
        });
        console.log('='.repeat(80));
        console.log('🎉 Comparison completed successfully!');
        console.log('='.repeat(80) + '\n');
    }
}
exports.BulkProductComparisonResume = BulkProductComparisonResume;
// Execute the script
async function main() {
    const script = new BulkProductComparisonResume();
    await script.run();
}
// Handle command line execution
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Script execution failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=bulk-product-comparison-resume.js.map