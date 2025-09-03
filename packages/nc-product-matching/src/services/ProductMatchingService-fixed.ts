import type { NcContext } from '../interface/config';
import ProductMatch from '../models/ProductMatch';
import ProductMatchSource from '../models/ProductMatchSource';
import { FuzzyMatchingHelper } from '../helpers/FuzzyMatchingHelper';
import { EnhancedMatchingEngine } from '../helpers/EnhancedMatchingEngine';

// SENIOR DEV FIX: Updated service to use proper architecture
// - Internal products from PIM database (prd_enrichment.products)
// - External products from PIM database (different source_id)
// - Matching logic stays in nocodb_prd

export interface Product {
  id: string;
  title: string;
  brand?: string;
  category_id?: string;
  price?: number;
  gtin?: string;
  description?: string;
  media?: Array<{ url: string }>;
  tenant_id?: string;
  source_id?: string; // Added to distinguish internal vs external
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

export class ProductMatchingServiceFixed {
  private filterOptionsCache: {
    data?: { brands: string[]; categories: string[]; sources: Array<{code: string, name: string}> };
    timestamp?: number;
  } = {};
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  constructor(
    private readonly ncMeta: any,      // For nocodb_prd (matching data)
    private readonly pimMeta: any      // For PIM database (product data)
  ) {}

  /**
   * FIXED: Get internal products from PIM database
   * Only products without source_id (internal products)
   */
  async getProducts(
    context: NcContext,
    filter: ProductFilter = {}
  ): Promise<{ items: Product[]; total: number }> {
    try {
      console.log('🔍 FIXED: Getting internal products from PIM database');
      
      const queryOptions: any = {
        limit: filter.limit || 250,
        offset: filter.offset || 0,
        condition: {
          // Internal products have no source_id
          source_id: null,
          is_deleted: false,
          status: ['active', 'draft'] // Include both active and draft
        }
      };

      // Add search filter
      if (filter.q) {
        queryOptions.condition = {
          ...queryOptions.condition,
          _or: [
            { title: { _like: `%${filter.q}%` } },
            { brand: { _like: `%${filter.q}%` } },
            { description: { _like: `%${filter.q}%` } }
          ]
        };
      }

      // Add brand filter
      if (filter.brand) {
        queryOptions.condition.brand = filter.brand;
      }

      // Add category filter
      if (filter.categoryId) {
        queryOptions.condition.category_id = parseInt(filter.categoryId);
      }

      // Add sorting
      if (filter.sortBy) {
        const sortField = filter.sortBy === 'title' ? 'title' : 
                         filter.sortBy === 'brand' ? 'brand' : 'updated_at';
        queryOptions.orderBy = { [sortField]: filter.sortDir || 'asc' };
      }

      // Query PIM database for internal products
      const products = await this.pimMeta.metaList2(
        'default', // workspace_id
        'default', // base_id  
        'prd_enrichment.products', // Use PIM products table
        queryOptions
      );

      // Get total count
      const totalResult = await this.pimMeta.metaCount(
        'default',
        'default', 
        'prd_enrichment.products',
        queryOptions.condition
      );

      // Transform to Product interface
      const items: Product[] = products.map((product: any) => ({
        id: product.product_id?.toString() || '',
        title: product.title || '',
        brand: product.brand || '',
        category_id: product.category_id?.toString() || '',
        price: this.extractPriceFromMeta(product.meta),
        description: product.description || '',
        tenant_id: product.tenant_id?.toString() || '',
        source_id: null // Internal products
      }));

      console.log(`✅ Found ${items.length} internal products from PIM`);

      return {
        items,
        total: totalResult?.count || items.length
      };

    } catch (error) {
      console.error('❌ Error getting internal products from PIM:', error);
      throw error;
    }
  }

  /**
   * FIXED: Get external products from PIM database  
   * Only products WITH source_id (external products)
   */
  async findCandidates(
    context: NcContext,
    productId: string,
    filter: CandidateFilter = {}
  ): Promise<ExternalProduct[]> {
    try {
      console.log(`🔍 FIXED: Finding external product candidates from PIM for product ${productId}`);

      // Get the internal product first
      const internalProduct = await this.pimMeta.metaGet2(
        'default',
        'default',
        'prd_enrichment.products',
        { product_id: parseInt(productId), source_id: null }
      );

      if (!internalProduct) {
        console.log(`❌ Internal product ${productId} not found in PIM`);
        return [];
      }

      // Build query for external products (have source_id)
      const condition: any = {
        source_id: { _not: null }, // External products have source_id
        is_deleted: false,
        status: 'active'
      };

      // Add source filter
      if (filter.sources?.length) {
        condition.source_id = { _in: filter.sources.map(s => parseInt(s)) };
      }

      // Add brand filter
      if (filter.brand) {
        condition.brand = filter.brand;
      }

      // Add category filter
      if (filter.categoryId) {
        condition.category_id = parseInt(filter.categoryId);
      }

      // Query external products from PIM
      const externalProducts = await this.pimMeta.metaList2(
        'default',
        'default',
        'prd_enrichment.products',
        {
          condition,
          limit: filter.limit || 100
        }
      );

      // Get source information for mapping
      const sources = await this.ncMeta.metaList2(
        'default',
        'default', 
        'nc_product_match_sources_01', // Sources still in nocodb_prd
        { condition: { is_active: true } }
      );

      const sourceMap = new Map(sources.map((s: any) => [s.id, { code: s.code, name: s.name }]));

      // Transform and score candidates
      const candidates: ExternalProduct[] = [];

      for (const extProduct of externalProducts) {
        const source = sourceMap.get(extProduct.source_id?.toString());
        if (!source) continue;

        // Calculate matching score using existing logic
        const score = this.calculateMatchScore(internalProduct, extProduct);
        
        if (score >= 0.5) { // Minimum threshold
          candidates.push({
            external_product_key: `${(source as any).code}-${extProduct.product_id}`,
            source: {
              id: extProduct.source_id.toString(),
              code: (source as any).code,
              name: (source as any).name
            },
            title: extProduct.title,
            brand: extProduct.brand,
            price: this.extractPriceFromMeta(extProduct.meta) || 0,
            gtin: extProduct.meta?.gtin || '',
            score,
            explanations: {
              name: this.calculateNameScore(internalProduct.title, extProduct.title),
              brand: this.calculateBrandScore(internalProduct.brand, extProduct.brand),
              category: 0.8, // Placeholder
              price: this.calculatePriceScore(
                this.extractPriceFromMeta(internalProduct.meta) || 0,
                this.extractPriceFromMeta(extProduct.meta) || 0
              )
            }
          });
        }
      }

      // Sort by score descending
      candidates.sort((a, b) => b.score - a.score);

      console.log(`✅ Found ${candidates.length} external candidates from PIM`);
      return candidates;

    } catch (error) {
      console.error('❌ Error finding external candidates from PIM:', error);
      throw error;
    }
  }

  /**
   * Extract price from meta JSON field
   */
  private extractPriceFromMeta(meta: any): number | undefined {
    if (!meta) return undefined;
    
    // Handle different price formats in meta
    if (meta.price) return parseFloat(meta.price);
    if (meta.standard_price) return parseFloat(meta.standard_price);
    if (meta.list_price) return parseFloat(meta.list_price);
    
    return undefined;
  }

  /**
   * Calculate overall match score between internal and external product
   */
  private calculateMatchScore(internal: any, external: any): number {
    const nameScore = this.calculateNameScore(internal.title, external.title);
    const brandScore = this.calculateBrandScore(internal.brand, external.brand);
    const priceScore = this.calculatePriceScore(
      this.extractPriceFromMeta(internal.meta) || 0,
      this.extractPriceFromMeta(external.meta) || 0
    );

    // Weighted average
    return (nameScore * 0.4) + (brandScore * 0.3) + (priceScore * 0.3);
  }

  /**
   * Calculate name similarity score
   */
  private calculateNameScore(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;
    
    // Use fuzzy matching helper
    return FuzzyMatchingHelper.calculateNameSimilarity(
      name1.toLowerCase(),
      name2.toLowerCase()
    );
  }

  /**
   * Calculate brand similarity score
   */
  private calculateBrandScore(brand1: string, brand2: string): number {
    if (!brand1 || !brand2) return 0;
    
    if (brand1.toLowerCase() === brand2.toLowerCase()) return 1.0;
    
    return FuzzyMatchingHelper.calculateBrandSimilarity(
      brand1.toLowerCase(),
      brand2.toLowerCase()
    );
  }

  /**
   * Calculate price similarity score
   */
  private calculatePriceScore(price1: number, price2: number): number {
    if (!price1 || !price2) return 0;
    
    const diff = Math.abs(price1 - price2);
    const avg = (price1 + price2) / 2;
    const diffPct = (diff / avg) * 100;
    
    // Score decreases as price difference increases
    if (diffPct <= 5) return 1.0;
    if (diffPct <= 10) return 0.9;
    if (diffPct <= 20) return 0.7;
    if (diffPct <= 30) return 0.5;
    return 0.2;
  }

  // ... rest of the methods (confirmMatch, etc.) stay similar
  // but use ncMeta for matching data and pimMeta for product data
}
