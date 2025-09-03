#!/usr/bin/env tsx
"use strict";
/**
 * CSV Results Analyzer
 *
 * Analyzes the productmatchingresults.csv file and provides insights
 *
 * Usage:
 *   npx tsx src/scripts/analyze-results.ts
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
exports.ResultsAnalyzer = void 0;
const fs = __importStar(require("fs"));
class ResultsAnalyzer {
    constructor(csvPath = 'productmatchingresults.csv') {
        this.csvPath = csvPath;
        this.results = [];
    }
    async analyze() {
        console.log('📊 Analyzing Product Matching Results\n');
        // Load CSV data
        await this.loadResults();
        if (this.results.length === 0) {
            console.log('❌ No results found. Run the bulk comparison first.');
            return;
        }
        console.log(`📋 Total matches analyzed: ${this.results.length}\n`);
        // Perform various analyses
        this.analyzeScenarios();
        this.analyzeTiers();
        this.analyzeScores();
        this.analyzePrices();
        this.analyzeBrands();
        this.analyzeCategories();
        this.showTopMatches();
        this.showProblemCases();
    }
    async loadResults() {
        try {
            const csvContent = fs.readFileSync(this.csvPath, 'utf-8');
            const lines = csvContent.trim().split('\n');
            // Skip header
            const dataLines = lines.slice(1);
            this.results = dataLines.map(line => {
                const fields = this.parseCSVLine(line);
                return {
                    internal_ean_gtin: fields[0] || '',
                    external_ean_gtin: fields[1] || '',
                    internal_product_name: fields[2] || '',
                    internal_brand: fields[3] || '',
                    internal_category: fields[4] || '',
                    external_product_name: fields[5] || '',
                    external_brand: fields[6] || '',
                    external_category: fields[7] || '',
                    internal_price: parseFloat(fields[8]) || 0,
                    external_price: parseFloat(fields[9]) || 0,
                    scenario_match: fields[10] || '',
                    score: parseFloat(fields[11]) || 0,
                    confidence: parseFloat(fields[12]) || 0,
                    tier: fields[13] || '',
                    match_reasons: fields[14] || '',
                    name_score: parseFloat(fields[15]) || 0,
                    brand_score: parseFloat(fields[16]) || 0,
                    category_score: parseFloat(fields[17]) || 0,
                    price_score: parseFloat(fields[18]) || 0,
                    price_difference_pct: parseFloat(fields[19]) || 0
                };
            });
        }
        catch (error) {
            console.error('❌ Error loading CSV:', error);
            throw error;
        }
    }
    parseCSVLine(line) {
        const fields = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            }
            else if (char === ',' && !inQuotes) {
                fields.push(current.trim());
                current = '';
            }
            else {
                current += char;
            }
        }
        fields.push(current.trim());
        return fields;
    }
    analyzeScenarios() {
        const scenarios = this.results.reduce((acc, result) => {
            acc[result.scenario_match] = (acc[result.scenario_match] || 0) + 1;
            return acc;
        }, {});
        console.log('🎯 Scenario Analysis:');
        Object.entries(scenarios).forEach(([scenario, count]) => {
            const percentage = (count / this.results.length * 100).toFixed(1);
            console.log(`   ${scenario}: ${count} (${percentage}%)`);
        });
        console.log();
    }
    analyzeTiers() {
        const tiers = this.results.reduce((acc, result) => {
            acc[result.tier] = (acc[result.tier] || 0) + 1;
            return acc;
        }, {});
        console.log('🏆 Quality Tier Analysis:');
        Object.entries(tiers).forEach(([tier, count]) => {
            const percentage = (count / this.results.length * 100).toFixed(1);
            const emoji = tier === 'high' ? '🟢' : tier === 'review' ? '🟡' : '🔴';
            console.log(`   ${emoji} ${tier}: ${count} (${percentage}%)`);
        });
        console.log();
    }
    analyzeScores() {
        const scores = this.results.map(r => r.score);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);
        const scoreRanges = {
            'Excellent (0.85-1.0)': scores.filter(s => s >= 0.85).length,
            'Good (0.70-0.84)': scores.filter(s => s >= 0.70 && s < 0.85).length,
            'Fair (0.50-0.69)': scores.filter(s => s >= 0.50 && s < 0.70).length,
            'Poor (<0.50)': scores.filter(s => s < 0.50).length
        };
        console.log('📊 Score Distribution:');
        console.log(`   Average: ${avgScore.toFixed(3)}`);
        console.log(`   Range: ${minScore.toFixed(3)} - ${maxScore.toFixed(3)}`);
        console.log();
        Object.entries(scoreRanges).forEach(([range, count]) => {
            const percentage = (count / this.results.length * 100).toFixed(1);
            console.log(`   ${range}: ${count} (${percentage}%)`);
        });
        console.log();
    }
    analyzePrices() {
        const withPrices = this.results.filter(r => r.internal_price > 0 && r.external_price > 0);
        if (withPrices.length === 0) {
            console.log('💰 Price Analysis: No price data available\n');
            return;
        }
        const priceDiffs = withPrices.map(r => r.price_difference_pct);
        const avgDiff = priceDiffs.reduce((a, b) => a + b, 0) / priceDiffs.length;
        const priceRanges = {
            'Identical (0%)': priceDiffs.filter(d => d === 0).length,
            'Small diff (0-10%)': priceDiffs.filter(d => d > 0 && d <= 10).length,
            'Medium diff (10-25%)': priceDiffs.filter(d => d > 10 && d <= 25).length,
            'Large diff (>25%)': priceDiffs.filter(d => d > 25).length
        };
        console.log('💰 Price Analysis:');
        console.log(`   Products with price data: ${withPrices.length}/${this.results.length}`);
        console.log(`   Average price difference: ${avgDiff.toFixed(1)}%`);
        console.log();
        Object.entries(priceRanges).forEach(([range, count]) => {
            const percentage = (count / withPrices.length * 100).toFixed(1);
            console.log(`   ${range}: ${count} (${percentage}%)`);
        });
        console.log();
    }
    analyzeBrands() {
        const brandMatches = this.results.filter(r => r.internal_brand.toLowerCase() === r.external_brand.toLowerCase()).length;
        const brandConflicts = this.results.filter(r => r.internal_brand && r.external_brand &&
            r.internal_brand.toLowerCase() !== r.external_brand.toLowerCase()).length;
        console.log('🏷️ Brand Analysis:');
        console.log(`   Exact brand matches: ${brandMatches} (${(brandMatches / this.results.length * 100).toFixed(1)}%)`);
        console.log(`   Brand conflicts: ${brandConflicts} (${(brandConflicts / this.results.length * 100).toFixed(1)}%)`);
        console.log();
    }
    analyzeCategories() {
        const categoryMatches = this.results.filter(r => r.internal_category.toLowerCase() === r.external_category.toLowerCase()).length;
        const categoryConflicts = this.results.filter(r => r.internal_category && r.external_category &&
            r.internal_category.toLowerCase() !== r.external_category.toLowerCase()).length;
        console.log('📂 Category Analysis:');
        console.log(`   Exact category matches: ${categoryMatches} (${(categoryMatches / this.results.length * 100).toFixed(1)}%)`);
        console.log(`   Category mismatches: ${categoryConflicts} (${(categoryConflicts / this.results.length * 100).toFixed(1)}%)`);
        console.log();
    }
    showTopMatches() {
        const topMatches = this.results
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
        console.log('🏆 Top 5 Matches:');
        topMatches.forEach((match, index) => {
            console.log(`   ${index + 1}. ${match.internal_product_name} → ${match.external_product_name}`);
            console.log(`      Score: ${match.score.toFixed(3)} | Tier: ${match.tier} | Scenario: ${match.scenario_match}`);
        });
        console.log();
    }
    showProblemCases() {
        const problems = this.results.filter(r => r.tier === 'low' || r.price_difference_pct > 30 ||
            (r.internal_brand && r.external_brand &&
                r.internal_brand.toLowerCase() !== r.external_brand.toLowerCase()));
        if (problems.length === 0) {
            console.log('✅ No significant problems detected!\n');
            return;
        }
        console.log(`⚠️ Problem Cases (${problems.length} found):`);
        problems.slice(0, 3).forEach((problem, index) => {
            console.log(`   ${index + 1}. ${problem.internal_product_name} → ${problem.external_product_name}`);
            console.log(`      Score: ${problem.score.toFixed(3)} | Price diff: ${problem.price_difference_pct.toFixed(1)}%`);
            const issues = [];
            if (problem.tier === 'low')
                issues.push('Low confidence');
            if (problem.price_difference_pct > 30)
                issues.push('High price difference');
            if (problem.internal_brand.toLowerCase() !== problem.external_brand.toLowerCase()) {
                issues.push('Brand mismatch');
            }
            console.log(`      Issues: ${issues.join(', ')}`);
        });
        if (problems.length > 3) {
            console.log(`   ... and ${problems.length - 3} more`);
        }
        console.log();
    }
}
exports.ResultsAnalyzer = ResultsAnalyzer;
// Execute the analyzer
if (require.main === module) {
    const analyzer = new ResultsAnalyzer();
    analyzer.analyze().catch(console.error);
}
//# sourceMappingURL=analyze-results.js.map