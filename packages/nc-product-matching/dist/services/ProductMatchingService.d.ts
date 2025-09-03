import type { NcContext } from '../interface/config';
export interface Product {
    id: string;
    title: string;
    brand?: string;
    moombs_brand?: string;
    category_id?: string;
    moombs_category?: string;
    price?: number;
    gtin?: string;
    description?: string;
    media?: Array<{
        url: string;
    }>;
    tenant_id?: string;
}
export interface ExternalProduct {
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
    explanations: {
        name: number;
        brand: number;
        category: number;
        price: number;
        gtin?: number;
    };
    confidence?: number;
    tier?: 'high' | 'review' | 'low';
    reasons?: string[];
    subscores?: {
        name: number;
        brand: number;
        category: number;
        price: number;
    };
    matchReasons?: string[];
    warnings?: string[];
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
export interface CandidateFilter {
    sources?: string[];
    brand?: string;
    categoryId?: string;
    priceBandPct?: number;
    ruleId?: string;
    limit?: number;
}
export interface ProductFilter {
    q?: string;
    categoryId?: string;
    brand?: string;
    status?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'title' | 'brand' | 'updated_at';
    sortDir?: 'asc' | 'desc';
}
export declare class ProductMatchingService {
    private readonly ncMeta;
    private filterOptionsCache;
    private readonly CACHE_TTL;
    constructor(ncMeta: any);
    /**
     * Clear the filter options cache - useful when sources are added/updated
     */
    clearFilterOptionsCache(): void;
    getFilterOptions(context: NcContext): Promise<{
        brands: string[];
        categories: string[];
        sources: Array<{
            code: string;
            name: string;
        }>;
    }>;
    getProducts(context: NcContext, filter: ProductFilter): Promise<{
        items: Product[];
        page: number;
        total: number;
    }>;
    getProductById(context: NcContext, productId: string): Promise<Product | null>;
    getExternalCandidates(context: NcContext, localProduct: Product, filter: CandidateFilter): Promise<{
        items: ExternalProduct[];
        generated_at: string;
    }>;
    private findCandidatesForSource;
    /**
     * @deprecated Use FuzzyMatchingHelper.calculateProductSimilarity instead
     * Legacy similarity calculation for backward compatibility
     */
    private calculateSimilarityScore;
    /**
     * @deprecated Use FuzzyMatchingHelper.calculateNameSimilarity instead
     */
    private calculateNameSimilarity;
    /**
     * @deprecated Use FuzzyMatchingHelper.calculateBrandSimilarity instead
     */
    private calculateBrandSimilarity;
    /**
     * Check if two categories represent relevant product types
     */
    private isRelevantProductMatch;
    /**
     * Check for brand variations and abbreviations
     */
    private checkBrandVariations;
    /**
     * Check if a short string is an acronym of a longer string
     */
    private isAcronym;
    /**
     * Infer category from product name when category is too generic
     */
    private inferCategoryFromProductName;
    /**
     * Get category similarity using the mapping table
     */
    private getCategorySimilarity;
    private calculatePriceSimilarity;
    confirmMatch(context: NcContext, matchData: {
        local_product_id: string;
        external_product_key: string;
        source_code: string;
        score: number;
        price_delta_pct: number;
        status: 'matched' | 'not_matched';
        notes?: string;
    }, userId: string): Promise<{
        match_id: string;
    }>;
    getMatches(context: NcContext, filters?: {
        localProductId?: string;
        externalProductKey?: string;
        source?: string;
        reviewedBy?: string;
        status?: string;
    }, limit?: number, offset?: number): Promise<{
        items: any[];
        page: number;
        total: number;
    }>;
    deleteMatch(context: NcContext, matchId: string): Promise<void>;
    createMatch(context: NcContext, matchData: {
        local_product_id: string;
        external_product_key: string;
        source_code: string;
        score: number;
        price_delta_pct: number;
        notes?: string;
    }, userId: string): Promise<{
        match_id: string;
    }>;
    removeMatch(context: NcContext, matchData: {
        local_product_id: string;
        external_product_key: string;
        source_code: string;
    }, userId: string): Promise<{
        success: boolean;
    }>;
    /**
     * Extract numeric ID from string format (int-123 → 123) or return as is
     */
    private extractNumericId;
    /**
     * Extract price from JSONB standard_price field in moombs_int_product
     */
    private extractPrice;
}
//# sourceMappingURL=ProductMatchingService.d.ts.map