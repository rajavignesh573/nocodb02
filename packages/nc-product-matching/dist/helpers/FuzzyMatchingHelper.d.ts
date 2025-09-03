/**
 * Enhanced fuzzy matching helper for product comparison
 * Incorporates multiple algorithms for better matching accuracy
 */
export declare class FuzzyMatchingHelper {
    private static readonly stemmer;
    private static readonly tokenizer;
    /**
     * Enhanced name similarity with multiple fuzzy matching algorithms
     */
    static calculateNameSimilarity(name1: string, name2: string): number;
    /**
     * Enhanced brand similarity with strict matching requirements
     */
    static calculateBrandSimilarity(brand1?: string, brand2?: string): number;
    /**
     * Calculate category similarity with category mapping system
     */
    static calculateCategorySimilarity(category1?: string, category2?: string): number;
    /**
     * Get category similarity using mapping table
     */
    private static getCategoryMappedSimilarity;
    /**
     * Normalize product names for better comparison
     */
    private static normalizeProductName;
    /**
     * Normalize brand names for better comparison
     */
    private static normalizeBrand;
    /**
     * Jaccard similarity (set-based similarity)
     */
    private static getJaccardSimilarity;
    /**
     * Cosine similarity using term frequency
     */
    private static getCosineSimilarity;
    /**
     * Levenshtein similarity (edit distance based)
     */
    private static getLevenshteinSimilarity;
    /**
     * Dice similarity coefficient
     */
    private static getDiceSimilarity;
    /**
     * Semantic similarity using stemming and word relationships
     */
    private static getSemanticSimilarity;
    /**
     * Extract key product terms that are important for matching
     */
    private static extractKeyProductTerms;
    /**
     * Calculate overlap between key product terms
     */
    private static calculateKeyTermOverlap;
    /**
     * Calculate overall product similarity with enhanced algorithm
     */
    static calculateProductSimilarity(product1: {
        title: string;
        brand?: string;
        category?: string;
        price?: number;
        gtin?: string;
    }, product2: {
        title: string;
        brand?: string;
        category?: string;
        price?: number;
        gtin?: string;
    }): {
        overall: number;
        breakdown: {
            name: number;
            brand: number;
            category: number;
            price: number;
            gtin: number;
        };
    };
    /**
     * Enhanced price similarity calculation
     */
    private static calculatePriceSimilarity;
    /**
     * GTIN similarity calculation
     */
    private static calculateGTINSimilarity;
}
//# sourceMappingURL=FuzzyMatchingHelper.d.ts.map