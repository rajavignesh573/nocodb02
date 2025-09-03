import type { NcContext } from '../interface/config';
export interface Product {
    id: string;
    title: string;
    brand?: string;
    category_id?: string;
    price?: number;
    gtin?: string;
    description?: string;
    media?: Array<{
        url: string;
    }>;
    tenant_id?: string;
    source_id?: string;
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
export declare class ProductMatchingServiceFixed {
    private readonly ncMeta;
    private readonly pimMeta;
    private filterOptionsCache;
    private readonly CACHE_TTL;
    constructor(ncMeta: any, // For nocodb_prd (matching data)
    pimMeta: any);
    /**
     * FIXED: Get internal products from PIM database
     * Only products without source_id (internal products)
     */
    getProducts(context: NcContext, filter?: ProductFilter): Promise<{
        items: Product[];
        total: number;
    }>;
    /**
     * FIXED: Get external products from PIM database
     * Only products WITH source_id (external products)
     */
    findCandidates(context: NcContext, productId: string, filter?: CandidateFilter): Promise<ExternalProduct[]>;
    /**
     * Extract price from meta JSON field
     */
    private extractPriceFromMeta;
    /**
     * Calculate overall match score between internal and external product
     */
    private calculateMatchScore;
    /**
     * Calculate name similarity score
     */
    private calculateNameScore;
    /**
     * Calculate brand similarity score
     */
    private calculateBrandScore;
    /**
     * Calculate price similarity score
     */
    private calculatePriceScore;
}
//# sourceMappingURL=ProductMatchingService-fixed.d.ts.map