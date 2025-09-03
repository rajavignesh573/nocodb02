"use strict";
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
exports.FuzzyMatchingHelper = void 0;
const stringSimilarity = __importStar(require("string-similarity"));
const natural = __importStar(require("natural"));
// Simple Levenshtein implementation as fallback
const levenshtein = {
    get: (str1, str2) => {
        const matrix = [];
        // Initialize the matrix
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        // Fill the matrix
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                }
                else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1, // insertion
                    matrix[i - 1][j] + 1 // deletion
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    }
};
/**
 * Enhanced fuzzy matching helper for product comparison
 * Incorporates multiple algorithms for better matching accuracy
 */
class FuzzyMatchingHelper {
    /**
     * Enhanced name similarity with multiple fuzzy matching algorithms
     */
    static calculateNameSimilarity(name1, name2) {
        if (!name1 || !name2)
            return 0;
        // Normalize the names
        const normalized1 = this.normalizeProductName(name1);
        const normalized2 = this.normalizeProductName(name2);
        // Check for exact match first
        if (normalized1 === normalized2)
            return 1.0;
        // Check for key product terms that should match
        const keyTerms1 = this.extractKeyProductTerms(normalized1);
        const keyTerms2 = this.extractKeyProductTerms(normalized2);
        // If key terms don't match at all, reduce score significantly
        const keyTermOverlap = this.calculateKeyTermOverlap(keyTerms1, keyTerms2);
        if (keyTermOverlap === 0) {
            // No key terms in common, this is likely a bad match
            return 0.0;
        }
        // Multiple similarity calculations
        const similarities = [
            this.getJaccardSimilarity(normalized1, normalized2),
            this.getCosineSimilarity(normalized1, normalized2),
            this.getLevenshteinSimilarity(normalized1, normalized2),
            this.getDiceSimilarity(normalized1, normalized2),
            this.getSemanticSimilarity(normalized1, normalized2)
        ];
        // Weighted average of different similarity measures
        const weights = [0.3, 0.25, 0.2, 0.15, 0.1];
        let weightedScore = similarities.reduce((sum, score, index) => sum + (score * weights[index]), 0);
        // Apply key term overlap penalty/reward
        weightedScore = weightedScore * (0.7 + 0.3 * keyTermOverlap);
        return Math.min(weightedScore, 1.0);
    }
    /**
     * Enhanced brand similarity with strict matching requirements
     */
    static calculateBrandSimilarity(brand1, brand2) {
        if (!brand1 || !brand2)
            return 0;
        // Exact match (highest score)
        if (brand1.toLowerCase() === brand2.toLowerCase())
            return 1.0;
        // Normalize brands
        const norm1 = this.normalizeBrand(brand1);
        const norm2 = this.normalizeBrand(brand2);
        // Check normalized exact match
        if (norm1 === norm2)
            return 0.95;
        // Very strict fuzzy matching for brands (only high confidence matches)
        const similarities = [
            stringSimilarity.compareTwoStrings(norm1, norm2),
            this.getLevenshteinSimilarity(norm1, norm2),
            this.getJaccardSimilarity(norm1, norm2)
        ];
        const maxSimilarity = Math.max(...similarities);
        // Much stricter thresholds for brand matching
        if (maxSimilarity >= 0.95)
            return maxSimilarity * 0.8; // Reduced from 0.9
        if (maxSimilarity >= 0.9)
            return maxSimilarity * 0.6; // Reduced from 0.7
        if (maxSimilarity >= 0.85)
            return maxSimilarity * 0.4; // Reduced from 0.5
        return 0; // No match for lower similarities
    }
    /**
     * Calculate category similarity with category mapping system
     */
    static calculateCategorySimilarity(category1, category2) {
        if (!category1 || !category2)
            return 0.0; // No default similarity - must have both
        const norm1 = category1.toLowerCase().trim();
        const norm2 = category2.toLowerCase().trim();
        // Exact match gets highest score
        if (norm1 === norm2)
            return 1.0;
        // Check category mapping table (this will be implemented in the service layer)
        // For now, use semantic similarity with category mapping logic
        const mappedSimilarity = this.getCategoryMappedSimilarity(norm1, norm2);
        if (mappedSimilarity > 0.0) {
            return mappedSimilarity;
        }
        // Fallback to semantic similarity for categories
        const similarity = this.getSemanticSimilarity(norm1, norm2);
        // Only return high similarity scores
        if (similarity >= 0.9)
            return similarity * 0.8; // Reduced score even for high similarity
        if (similarity >= 0.8)
            return similarity * 0.6; // Further reduced
        return 0.0; // No match for lower similarities
    }
    /**
     * Get category similarity using mapping table
     */
    static getCategoryMappedSimilarity(category1, category2) {
        // This is a simplified version - the actual implementation will query the database
        // For now, implement common mappings directly
        const categoryMappings = {
            'blankets': { 'sleep': 0.95, 'textiles': 0.9, 'crib-textiles': 0.95 },
            'sleep': { 'blankets': 0.95, 'textiles': 0.9, 'crib-textiles': 0.95 },
            'textiles': { 'sleep': 0.9, 'blankets': 0.9, 'crib-textiles': 0.95 },
            'crib-textiles': { 'sleep': 0.95, 'blankets': 0.95, 'textiles': 0.95 },
            'all': { 'other': 0.5, 'accessories': 0.3 },
            'other': { 'all': 0.5, 'accessories': 0.3 }
        };
        const cat1 = category1.toLowerCase();
        const cat2 = category2.toLowerCase();
        // Check direct mapping
        if (categoryMappings[cat1] && categoryMappings[cat1][cat2]) {
            return categoryMappings[cat1][cat2];
        }
        // Check reverse mapping
        if (categoryMappings[cat2] && categoryMappings[cat2][cat1]) {
            return categoryMappings[cat2][cat1];
        }
        return 0.0; // No mapping found
    }
    /**
     * Normalize product names for better comparison
     */
    static normalizeProductName(name) {
        return name
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Remove special characters
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim()
            .replace(/\b(the|and|or|with|for|in|on|at|to|from|by)\b/g, '') // Remove common words
            .replace(/\s+/g, ' ')
            .trim();
    }
    /**
     * Normalize brand names for better comparison
     */
    static normalizeBrand(brand) {
        return brand
            .toLowerCase()
            .replace(/[^\w]/g, '') // Remove all non-word characters
            .replace(/inc|llc|ltd|corp|company|co/g, '') // Remove company suffixes
            .trim();
    }
    /**
     * Jaccard similarity (set-based similarity)
     */
    static getJaccardSimilarity(str1, str2) {
        const tokens1 = new Set(this.tokenizer.tokenize(str1) || []);
        const tokens2 = new Set(this.tokenizer.tokenize(str2) || []);
        const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
        const union = new Set([...tokens1, ...tokens2]);
        return union.size === 0 ? 0 : intersection.size / union.size;
    }
    /**
     * Cosine similarity using term frequency
     */
    static getCosineSimilarity(str1, str2) {
        const tokens1 = this.tokenizer.tokenize(str1) || [];
        const tokens2 = this.tokenizer.tokenize(str2) || [];
        // Create term frequency vectors
        const allTokens = [...new Set([...tokens1, ...tokens2])];
        const vector1 = allTokens.map(token => tokens1.filter(t => t === token).length);
        const vector2 = allTokens.map(token => tokens2.filter(t => t === token).length);
        // Calculate cosine similarity
        const dotProduct = vector1.reduce((sum, val, i) => sum + (val * vector2[i]), 0);
        const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + (val * val), 0));
        const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + (val * val), 0));
        return magnitude1 === 0 || magnitude2 === 0 ? 0 : dotProduct / (magnitude1 * magnitude2);
    }
    /**
     * Levenshtein similarity (edit distance based)
     */
    static getLevenshteinSimilarity(str1, str2) {
        const maxLen = Math.max(str1.length, str2.length);
        if (maxLen === 0)
            return 1.0;
        const distance = levenshtein.get(str1, str2);
        return (maxLen - distance) / maxLen;
    }
    /**
     * Dice similarity coefficient
     */
    static getDiceSimilarity(str1, str2) {
        return stringSimilarity.compareTwoStrings(str1, str2);
    }
    /**
     * Semantic similarity using stemming and word relationships
     */
    static getSemanticSimilarity(str1, str2) {
        const tokens1 = this.tokenizer.tokenize(str1) || [];
        const tokens2 = this.tokenizer.tokenize(str2) || [];
        // Stem the tokens
        const stemmed1 = tokens1.map(token => this.stemmer.stem(token));
        const stemmed2 = tokens2.map(token => this.stemmer.stem(token));
        // Calculate similarity on stemmed tokens
        const stemmedSet1 = new Set(stemmed1);
        const stemmedSet2 = new Set(stemmed2);
        const intersection = new Set([...stemmedSet1].filter(x => stemmedSet2.has(x)));
        const union = new Set([...stemmedSet1, ...stemmedSet2]);
        return union.size === 0 ? 0 : intersection.size / union.size;
    }
    /**
     * Extract key product terms that are important for matching
     */
    static extractKeyProductTerms(name) {
        // Remove common words that don't add meaning
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'de', 'del', 'la', 'el', 'con', 'para', 'por', 'sin', 'sobre', 'entre', 'hasta', 'desde',
            'baby', 'infant', 'child', 'kids', 'toddler', 'newborn', 'junior', 'mini', 'small', 'large',
            'big', 'little', 'new', 'old', 'classic', 'modern', 'traditional', 'contemporary'
        ]);
        // Split into words and filter
        const words = name.toLowerCase().split(/[\s\-_]+/);
        const keyTerms = words.filter(word => word.length > 2 && !stopWords.has(word) && !/^\d+$/.test(word));
        return keyTerms;
    }
    /**
     * Calculate overlap between key product terms
     */
    static calculateKeyTermOverlap(terms1, terms2) {
        if (terms1.length === 0 || terms2.length === 0)
            return 0;
        const set1 = new Set(terms1);
        const set2 = new Set(terms2);
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return intersection.size / union.size;
    }
    /**
     * Calculate overall product similarity with enhanced algorithm
     */
    static calculateProductSimilarity(product1, product2) {
        const nameScore = this.calculateNameSimilarity(product1.title, product2.title);
        const brandScore = this.calculateBrandSimilarity(product1.brand, product2.brand);
        const categoryScore = this.calculateCategorySimilarity(product1.category, product2.category);
        const priceScore = this.calculatePriceSimilarity(product1.price, product2.price);
        const gtinScore = this.calculateGTINSimilarity(product1.gtin, product2.gtin);
        // Enhanced weighted scoring with improved weights for better accuracy
        let totalWeight = 0;
        let weightedSum = 0;
        // Name similarity (reduced weight to prevent false positives)
        const nameWeight = 0.25;
        weightedSum += nameScore * nameWeight;
        totalWeight += nameWeight;
        // Brand similarity (increased weight - critical for matching)
        if (product1.brand && product2.brand) {
            const brandWeight = 0.35;
            weightedSum += brandScore * brandWeight;
            totalWeight += brandWeight;
        }
        // GTIN similarity (highest confidence if both present)
        if (product1.gtin && product2.gtin) {
            const gtinWeight = 0.25;
            weightedSum += gtinScore * gtinWeight;
            totalWeight += gtinWeight;
        }
        // Category similarity (increased weight - must match product type)
        const categoryWeight = 0.25;
        weightedSum += categoryScore * categoryWeight;
        totalWeight += categoryWeight;
        // Price similarity (reduced weight - less critical)
        if (product1.price && product2.price) {
            const priceWeight = 0.05;
            weightedSum += priceScore * priceWeight;
            totalWeight += priceWeight;
        }
        // Normalize by total weight
        const overall = totalWeight > 0 ? weightedSum / totalWeight : 0;
        return {
            overall: Math.min(overall, 1.0),
            breakdown: {
                name: nameScore,
                brand: brandScore,
                category: categoryScore,
                price: priceScore,
                gtin: gtinScore
            }
        };
    }
    /**
     * Enhanced price similarity calculation
     */
    static calculatePriceSimilarity(price1, price2) {
        if (!price1 || !price2)
            return 0;
        const diff = Math.abs(price1 - price2);
        const avgPrice = (price1 + price2) / 2;
        if (avgPrice === 0)
            return 0;
        const percentageDiff = (diff / avgPrice) * 100;
        // More granular price similarity scoring
        if (percentageDiff <= 2)
            return 1.0;
        if (percentageDiff <= 5)
            return 0.95;
        if (percentageDiff <= 10)
            return 0.9;
        if (percentageDiff <= 15)
            return 0.8;
        if (percentageDiff <= 20)
            return 0.7;
        if (percentageDiff <= 25)
            return 0.6;
        if (percentageDiff <= 30)
            return 0.5;
        if (percentageDiff <= 40)
            return 0.3;
        return 0.1;
    }
    /**
     * GTIN similarity calculation
     */
    static calculateGTINSimilarity(gtin1, gtin2) {
        if (!gtin1 || !gtin2)
            return 0;
        // Exact match
        if (gtin1 === gtin2)
            return 1.0;
        // Normalize GTINs (remove spaces, dashes)
        const norm1 = gtin1.replace(/[\s-]/g, '');
        const norm2 = gtin2.replace(/[\s-]/g, '');
        if (norm1 === norm2)
            return 1.0;
        // Check if one is a subset of the other (different GTIN formats)
        if (norm1.includes(norm2) || norm2.includes(norm1))
            return 0.8;
        // Use Levenshtein for partial GTIN similarity
        const maxLen = Math.max(norm1.length, norm2.length);
        if (maxLen > 0) {
            const distance = levenshtein.get(norm1, norm2);
            const similarity = (maxLen - distance) / maxLen;
            return similarity > 0.8 ? similarity * 0.7 : 0; // Only return if highly similar
        }
        return 0;
    }
}
exports.FuzzyMatchingHelper = FuzzyMatchingHelper;
FuzzyMatchingHelper.stemmer = natural.PorterStemmer;
FuzzyMatchingHelper.tokenizer = new natural.WordTokenizer();
//# sourceMappingURL=FuzzyMatchingHelper.js.map