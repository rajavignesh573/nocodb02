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

import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { EnhancedMatchingEngine, InternalProduct, ExternalProduct } from '../helpers/EnhancedMatchingEngine';

interface ComparisonResult {
  internal_ean_gtin: string;
  external_ean_gtin: string;
  internal_product_name: string;
  internal_brand: string;
  internal_category: string;
  external_product_name: string;
  external_brand: string;
  external_category: string;
  internal_price: number;
  external_price: number;
  scenario_match: 'EAN_EXACT' | 'FALLBACK_ALGORITHM';
  score: number;
  confidence: number;
  tier: string;
  match_reasons: string;
  name_score: number;
  brand_score: number;
  category_score: number;
  price_score: number;
  price_difference_pct: number;
}

class BulkProductComparison {
  private results: ComparisonResult[] = [];
  private processedCount = 0;
  private totalComparisons = 0;
  private startTime = Date.now();

  constructor(private useDatabase: boolean = false) {
    console.log('🚀 Initializing Bulk Product Comparison Script');
    console.log('📋 Algorithm: ProductMatchingRules.md specification');
    console.log(`💾 Data source: ${useDatabase ? 'Database' : 'Enhanced test data'}`);
  }

  /**
   * Main execution method
   */
  async run(): Promise<void> {
    try {
      console.log('\n📊 Starting bulk product comparison...\n');

      // Step 1: Load all internal products
      console.log('📥 Loading internal products...');
      const internalProducts = await this.loadInternalProducts();
      console.log(`✅ Loaded ${internalProducts.length} internal products`);

      // Step 2: Load all external products
      console.log('📥 Loading external products...');
      const externalProducts = await this.loadExternalProducts();
      console.log(`✅ Loaded ${externalProducts.length} external products`);

      // Step 3: Calculate total comparisons
      this.totalComparisons = internalProducts.length * externalProducts.length;
      console.log(`🔢 Total comparisons to perform: ${this.totalComparisons.toLocaleString()}`);

      // Step 4: Perform comparisons
      console.log('\n🔄 Starting product comparisons...');
      await this.performComparisons(internalProducts, externalProducts);

      // Step 5: Generate CSV report
      console.log('\n📝 Generating CSV report...');
      await this.generateCSVReport();

      // Step 6: Display summary
      this.displaySummary();

    } catch (error) {
      console.error('❌ Error during bulk comparison:', error);
      process.exit(1);
    }
  }

  /**
   * Load all internal products
   */
  private async loadInternalProducts(): Promise<InternalProduct[]> {
    if (this.useDatabase) {
      // TODO: Add database integration
      console.log('⚠️  Database integration not implemented yet. Using test data.');
    }

    // Enhanced test data that matches ProductMatchingRules.md cases
    return [
      // C1: Perfect GTIN match case
      {
        id: 'int_001',
        title: 'Pampers Baby Dry Size 4 Premium',
        brand: 'Pampers',
        moombs_brand: 'Pampers',
        category_id: 'diapers',
        moombs_category: 'baby-diapers',
        price: 24.99,
        gtin: '037000863427'
      },
      // C2: High similarity case (no GTIN)
      {
        id: 'int_002',
        title: 'Johnson Baby Gentle Shampoo 500ml',
        brand: 'Johnsons',
        moombs_brand: 'Johnson & Johnson',
        category_id: 'baby-care',
        moombs_category: 'baby-hygiene',
        price: 12.99
      },
      // C3: Review tier case
      {
        id: 'int_003',
        title: 'Similac Pro-Advance Formula Premium',
        brand: 'Similac',
        moombs_brand: 'Similac',
        category_id: 'baby-formula',
        moombs_category: 'infant-nutrition',
        price: 29.99
      },
      // C4: Brand conflict case
      {
        id: 'int_004',
        title: 'Huggies Little Snugglers Newborn',
        brand: 'Huggies',
        moombs_brand: 'Huggies',
        category_id: 'diapers',
        moombs_category: 'newborn-diapers',
        price: 19.99
      },
      // C5: Cross-department case
      {
        id: 'int_005',
        title: 'Baby Stroller Travel System',
        brand: 'Graco',
        moombs_brand: 'Graco',
        category_id: 'strollers',
        moombs_category: 'baby-gear',
        price: 299.99
      },
      // C6: Model mismatch case
      {
        id: 'int_006',
        title: 'Chicco KeyFit 30 Car Seat',
        brand: 'Chicco',
        moombs_brand: 'Chicco',
        category_id: 'car-seats',
        moombs_category: 'safety-gear',
        price: 199.99
      }
    ];
  }

  /**
   * Load all external products
   */
  private async loadExternalProducts(): Promise<ExternalProduct[]> {
    if (this.useDatabase) {
      // TODO: Add database integration
      console.log('⚠️  Database integration not implemented yet. Using test data.');
    }

    // Enhanced test data that matches ProductMatchingRules.md test cases
    return [
      // Perfect GTIN match for C1
      {
        external_product_key: 'amzn_001',
        title: 'Pampers Baby Dry Size 4 Premium Pack',
        brand: 'Pampers',
        category_id: 'diapers',
        price: 24.99, // Same price for perfect match
        gtin: '037000863427',
        image_url: 'https://example.com/pampers.jpg'
      },
      // High similarity case for C2 (88% name, 100% brand, 100% category, 100% price)
      {
        external_product_key: 'amzn_002',
        title: 'Johnson Baby Gentle Shampoo 500ml Premium',
        brand: 'Johnson & Johnson', // Exact brand match
        category_id: 'baby-hygiene', // Same category
        price: 13.64, // 5% price difference
        image_url: 'https://example.com/johnsons.jpg'
      },
      // Review tier case for C3 (76% name, 90% brand alias, 85% category, 70% price)
      {
        external_product_key: 'amzn_003',
        title: 'Similac Pro-Advance Baby Formula',
        brand: 'Similac', // Brand alias match
        category_id: 'infant-nutrition', // Same branch
        price: 34.49, // 15% price difference
        image_url: 'https://example.com/similac.jpg'
      },
      // Brand conflict case for C4 (84% name, 0% brand, 95% category, 90% price)
      {
        external_product_key: 'amzn_004',
        title: 'Huggies Little Snugglers Newborn Premium',
        brand: 'Pampers', // Brand conflict!
        category_id: 'newborn-diapers', // Same category
        price: 21.59, // 8% price difference
        image_url: 'https://example.com/huggies.jpg'
      },
      // Cross-department case for C5 (80% name, 85% brand, 0% category, 95% price)
      {
        external_product_key: 'amzn_005',
        title: 'Baby Travel System Stroller',
        brand: 'Graco',
        category_id: 'toys', // Cross-department!
        price: 311.99, // 4% price difference
        image_url: 'https://example.com/stroller.jpg'
      },
      // Model mismatch case for C6 (86% name, 95% brand, 100% category, 80% price)
      {
        external_product_key: 'amzn_006',
        title: 'Chicco KeyFit 35 Car Seat', // Model mismatch (30 vs 35)
        brand: 'Chicco',
        category_id: 'safety-gear',
        price: 239.99, // 12% price difference
        image_url: 'https://example.com/chicco.jpg'
      },
      // Price missing case for C7
      {
        external_product_key: 'amzn_007',
        title: 'Johnson Baby Lotion Gentle Care',
        brand: 'Johnson & Johnson',
        category_id: 'baby-hygiene',
        // No price - should get neutral 70
        image_url: 'https://example.com/lotion.jpg'
      },
      // Accessory confusion case for C8
      {
        external_product_key: 'amzn_008',
        title: 'Baby Stroller Cup Holder Accessory', // Accessory mismatch
        brand: 'Graco',
        category_id: 'baby-gear',
        price: 324.99, // 18% price difference
        image_url: 'https://example.com/accessory.jpg'
      },
      // Pack mismatch case for C9
      {
        external_product_key: 'amzn_009',
        title: 'Chicco KeyFit 30 Car Seat 2-Pack', // Pack mismatch
        brand: 'Chicco',
        category_id: 'safety-gear',
        price: 149.99, // 25% price difference
        image_url: 'https://example.com/chicco-pack.jpg'
      },
      // Sale case for C10
      {
        external_product_key: 'amzn_010',
        title: 'Baby Travel System Premium',
        brand: 'Graco',
        category_id: 'baby-gear',
        price: 257.99, // 14% price difference
        discount: 15, // On sale!
        image_url: 'https://example.com/sale.jpg'
      }
    ];
  }

  /**
   * Perform all product comparisons using the ProductMatchingRules.md algorithm
   */
  private async performComparisons(
    internalProducts: InternalProduct[],
    externalProducts: ExternalProduct[]
  ): Promise<void> {
    for (let i = 0; i < internalProducts.length; i++) {
      const internal = internalProducts[i];
      
      console.log(`\n🔍 Processing internal product ${i + 1}/${internalProducts.length}: "${internal.title}"`);

      // Create source info for the matching engine
      const sourceInfo = {
        id: 'bulk_comparison',
        code: 'BULK',
        name: 'Bulk Comparison Script'
      };

      try {
        // Use the ProductMatchingRules.md algorithm via EnhancedMatchingEngine
        const matches = await EnhancedMatchingEngine.findMatches(
          internal,
          externalProducts,
          sourceInfo
        );

        // Process each match result
        for (const match of matches) {
          const external = externalProducts.find(ext => 
            ext.external_product_key === match.external_product_key
          );

          if (!external) continue;

          // Determine scenario match type
          const scenarioMatch = this.determineScenarioMatch(internal, external, match);

          // Calculate price difference percentage
          const priceDiffPct = this.calculatePriceDifference(internal.price, external.price);

          // Create comparison result
          const result: ComparisonResult = {
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
          this.processedCount++;
        }

        // Progress reporting
        if ((i + 1) % 2 === 0) {
          const progress = ((i + 1) / internalProducts.length * 100).toFixed(1);
          console.log(`📊 Progress: ${progress}% | Matches found: ${this.results.length}`);
        }

      } catch (error) {
        console.error(`❌ Error processing internal product ${internal.id}:`, error);
        continue;
      }
    }

    console.log(`\n✅ Comparison complete! Generated ${this.results.length} match results`);
  }

  /**
   * Determine if match was based on EAN/GTIN or fallback algorithm
   */
  private determineScenarioMatch(
    internal: InternalProduct,
    external: ExternalProduct,
    match: any
  ): 'EAN_EXACT' | 'FALLBACK_ALGORITHM' {
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
  private calculatePriceDifference(internalPrice?: number, externalPrice?: number): number {
    if (!internalPrice || !externalPrice) return 0;
    
    const diff = Math.abs(externalPrice - internalPrice);
    const avg = (internalPrice + externalPrice) / 2;
    
    return Math.round((diff / avg) * 100 * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Generate CSV report with all comparison results
   */
  private async generateCSVReport(): Promise<void> {
    const outputPath = path.join(process.cwd(), 'productmatchingresults.csv');

    const csvWriter = createObjectCsvWriter({
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
  private displaySummary(): void {
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
    console.log(`   EAN/GTIN Exact Matches: ${eanMatches.toLocaleString()} (${(eanMatches/this.results.length*100).toFixed(1)}%)`);
    console.log(`   Fallback Algorithm: ${fallbackMatches.toLocaleString()} (${(fallbackMatches/this.results.length*100).toFixed(1)}%)`);
    
    // Tier breakdown
    const highTier = this.results.filter(r => r.tier === 'high').length;
    const reviewTier = this.results.filter(r => r.tier === 'review').length;
    const lowTier = this.results.filter(r => r.tier === 'low').length;
    
    console.log(`\n🎯 Quality Tiers:`);
    console.log(`   High Confidence (≥85%): ${highTier.toLocaleString()} (${(highTier/this.results.length*100).toFixed(1)}%)`);
    console.log(`   Review Tier (70-84.9%): ${reviewTier.toLocaleString()} (${(reviewTier/this.results.length*100).toFixed(1)}%)`);
    console.log(`   Low Confidence (<70%): ${lowTier.toLocaleString()} (${(lowTier/this.results.length*100).toFixed(1)}%)`);
    
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

// Execute the script
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const useDatabase = args.includes('--database') || args.includes('--db');
  
  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`\n📋 Bulk Product Comparison Script - FIXED VERSION`);
    console.log(`\nUsage:`);
    console.log(`  npx tsx src/scripts/bulk-product-comparison-fixed.ts                    # Run with test data`);
    console.log(`  npx tsx src/scripts/bulk-product-comparison-fixed.ts --database         # Run with database data`);
    console.log(`\nOptions:`);
    console.log(`  --database, --db          Use database instead of test data`);
    console.log(`  --help, -h                Show this help`);
    console.log(`\nOutput:`);
    console.log(`  productmatchingresults.csv - Detailed comparison results`);
    console.log();
    process.exit(0);
  }
  
  console.log(
    useDatabase ? '💾 Running with database data...' : 
    '📦 Running with enhanced test data...'
  );
  
  const comparison = new BulkProductComparison(useDatabase);
  comparison.run().catch(console.error);
}

export { BulkProductComparison };

