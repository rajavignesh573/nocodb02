export interface MatchCandidate {
    external_product_key: string;
    source: {
        id: string;
        code: string;
        name: string;
    };
    title: string;
    brand?: string;
    price?: number;
    image?: string;
    gtin?: string;
    score: number;
    confidence: number;
    tier: 'high' | 'review' | 'low';
    reasons: string[];
    subscores: {
        name: number;
        brand: number;
        category: number;
        price: number;
    };
    matchReasons?: string[];
    warnings?: string[];
    explanations?: {
        name: number;
        brand: number;
        category: number;
        price: number;
        gtin?: number;
    };
    product_type?: string;
    short_description?: string;
    long_description?: string;
    discount?: number;
    offer_price?: number;
    color_options?: string;
    size_options?: string;
    color?: string;
    measurements?: string;
    specifications?: string;
    dimensions?: string;
    sku?: string;
    url?: string;
}
export interface InternalProduct {
    id: string;
    title: string;
    brand?: string;
    moombs_brand?: string;
    category_id?: string;
    moombs_category?: string;
    price?: number;
    gtin?: string;
}
export interface ExternalProduct {
    external_product_key: string;
    title: string;
    brand?: string;
    category_id?: string;
    price?: number;
    gtin?: string;
    image_url?: string;
    product_type?: string;
    short_description?: string;
    long_description?: string;
    discount?: number;
    offer_price?: number;
    color_options?: string;
    size_options?: string;
    color?: string;
    measurements?: string;
    specifications?: string;
    dimensions?: string;
    sku?: string;
    url?: string;
}
/**
 * Enhanced Product Matching Engine following ProductMatchingRules.md specification
 *
 * This engine implements the standardized matching process:
 * 1. Tier-0: Exact GTIN Match (100%)
 * 2. Feature Scoring: Name (50%), Brand (20%), Category (15%), Price (15%)
 * 3. Business Rule Caps and Penalties
 * 4. Confidence Tiers: ≥85 High, 70-84.9 Review, <70 Low
 */
export declare class EnhancedMatchingEngine {
    private static readonly CONFIG;
    /**
     * Find high-quality matches for an internal product
     */
    static findMatches(internalProduct: InternalProduct, externalProducts: ExternalProduct[], sourceInfo: {
        id: string;
        code: string;
        name: string;
    }): Promise<MatchCandidate[]>;
    /**
     * Sequential Cascade Matching - NO FILTERING, ALL PRODUCTS COMPARED
     * Every internal product is compared with EVERY external product
     */
    private static checkMandatoryRequirements;
    /**
     * ProductMatchingRules.md Algorithm Implementation
     * 1. Tier-0: Exact GTIN Match → 100%
     * 2. Feature Scoring: Final = 0.50×Name + 0.20×Brand + 0.15×Category + 0.15×Price
     * 3. Apply business rule caps and penalties
     */
    private static calculateEnhancedSimilarity;
    /**
     * Calculate GTIN/EAN match - ProductMatchingRules.md Tier-0
     */
    private static calculateGtinMatch;
    /**
     * Calculate Name Score (0-100) - ProductMatchingRules.md
     * Semantic similarity, token Jaccard, char fuzzy with penalties
     */
    private static calculateNameScore;
    /**
     * Calculate Brand Score (0-100) - ProductMatchingRules.md
     * Exact=100, Alias=90, Inferred=75, Conflict=0
     */
    private static calculateBrandScore;
    /**
     * Calculate Category Score (0-100) - ProductMatchingRules.md
     * Exact leaf=100, Same branch=85, Department=65, Cross-department=0
     */
    private static calculateCategoryScore;
    /**
     * Calculate Price Score (0-100) - ProductMatchingRules.md
     * ±10%=100, 10-30% linear to 40, >30%=20, missing=70, sale relax to 15%
     */
    private static calculatePriceScore;
    /**
     * Helper methods for business logic detection
     */
    private static detectAccessoryMismatch;
    private static detectPackMismatch;
    private static detectModelMismatch;
    private static areBrandAliases;
    private static areSameBranch;
    private static areSameDepartment;
    /**
     * Create match candidate following ProductMatchingRules.md output contract
     */
    private static createMatchCandidate;
    /**
     * Get match quality summary for debugging
     */
    static getMatchQualitySummary(candidates: MatchCandidate[]): {
        total: number;
        highTier: number;
        reviewTier: number;
        lowTier: number;
        highConfidence: number;
        mediumConfidence: number;
        lowConfidence: number;
        averageScore: number;
        topScore: number;
    };
}
//# sourceMappingURL=EnhancedMatchingEngine.d.ts.map