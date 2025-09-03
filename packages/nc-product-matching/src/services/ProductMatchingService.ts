import type { NcContext } from '../interface/config';
import ProductMatch from '../models/ProductMatch';
import ProductMatchSource from '../models/ProductMatchSource';
import { FuzzyMatchingHelper } from '../helpers/FuzzyMatchingHelper';
import { EnhancedMatchingEngine } from '../helpers/EnhancedMatchingEngine';

export interface Product {
  id: string;
  title: string;
  brand?: string;
  moombs_brand?: string;  // Internal products use this field
  category_id?: string;
  moombs_category?: string;  // Internal products use this field
  price?: number;
  gtin?: string;
  description?: string;
  media?: Array<{ url: string }>;
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
  // ProductMatchingRules.md fields
  confidence?: number;        // 0-100 scale confidence score
  tier?: 'high' | 'review' | 'low';  // Confidence tier
  reasons?: string[];         // Match reasons array
  subscores?: {               // Individual component scores
    name: number;
    brand: number;
    category: number;
    price: number;
  };
  // Legacy compatibility
  matchReasons?: string[];    // Alias for reasons
  warnings?: string[];        // Match warnings
  // Enhanced schema fields
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
  limit?: number; // Default: 250 (increased from 20)
  offset?: number;
  sortBy?: 'title' | 'brand' | 'updated_at';
  sortDir?: 'asc' | 'desc';
}

export class ProductMatchingService {
  private filterOptionsCache: {
    data?: { brands: string[]; categories: string[]; sources: Array<{code: string, name: string}> };
    timestamp?: number;
  } = {};
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  constructor(private readonly ncMeta: any) {}

  /**
   * Clear the filter options cache - useful when sources are added/updated
   */
  clearFilterOptionsCache(): void {
    this.filterOptionsCache = {};
    console.log('🧹 Filter options cache cleared');
  }

  async getFilterOptions(
    context: NcContext,
  ): Promise<{ brands: string[]; categories: string[]; sources: Array<{code: string, name: string}> }> {
    // Check cache first
    const now = Date.now();
    if (this.filterOptionsCache.data && 
        this.filterOptionsCache.timestamp && 
        (now - this.filterOptionsCache.timestamp) < this.CACHE_TTL) {
      console.log('✅ Returning cached filter options');
      return this.filterOptionsCache.data;
    }

    try {
      // Get unique brands from internal products
      const products = await this.ncMeta.metaList2(
        context.workspace_id,
        'default',
        'odoo_moombs_int_product_data',
        { limit: 1000 } // Get enough to find all unique brands
      );

      const brands = Array.from(new Set(
        products
          .map((p: any) => p.brand)
          .filter((brand: string) => brand && brand.trim() !== '')
      )).sort() as string[];

      const categories = Array.from(new Set(
        products
          .map((p: any) => p.category)
          .filter((category: string) => category && category.trim() !== '' && category !== 'All')
      )).sort() as string[];

      // Get sources from ProductMatchSource table
      let sources: Array<{code: string, name: string}> = [];
      try {
        const sourcesList = await ProductMatchSource.list(context, 100, 0, this.ncMeta);
        sources = sourcesList
          .filter((source: any) => 
            source.is_active && 
            source.name && 
            source.code &&
            source.name.trim() !== '' &&
            source.code.trim() !== ''
          )
          .map((source: any) => ({
            code: source.code.trim(),
            name: source.name.trim()
          }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        
        console.log(`✅ Loaded ${sources.length} active sources:`, sources.map(s => `${s.name} (${s.code})`).join(', '));
      } catch (sourceError) {
        console.error('❌ Error loading sources:', sourceError);
        // Continue with empty sources array rather than failing completely
        sources = [];
      }

      const result = {
        brands,
        categories,
        sources
      };

      // Cache the result
      this.filterOptionsCache = {
        data: result,
        timestamp: Date.now()
      };

      return result;
    } catch (error) {
      console.error('Error getting filter options:', error);
      return {
        brands: [],
        categories: [],
        sources: []
      };
    }
  }

  async getProducts(
    context: NcContext,
    filter: ProductFilter,
  ): Promise<{ items: Product[]; page: number; total: number }> {
    try {
      // Query internal products from database
      const queryOptions: any = {
        limit: filter.limit || 250, // Increased default from 20 to 250
        offset: filter.offset || 0
      };

      // Apply search filter
      if (filter.q) {
        // For now, we'll filter in memory since the mock NcMeta doesn't support complex queries
        // In a real implementation, this would be a database query
      }

      // Apply sorting - map to odoo_moombs_int_product_data fields
      if (filter.sortBy === 'title') {
        queryOptions.orderBy = { product_name: filter.sortDir || 'asc' };
      } else if (filter.sortBy === 'brand') {
        queryOptions.orderBy = { brand: filter.sortDir || 'asc' };
      }
      // If no sorting is specified, don't include orderBy in queryOptions

      const products = await this.ncMeta.metaList2(
        context.workspace_id,
        'default',
        'odoo_moombs_int_product_data',
        queryOptions
      );

      // Apply filters in memory (in real implementation, these would be database queries)
      let filteredProducts = products;

      console.log(`🔍 DEBUG: Initial products count: ${products.length}`);
      console.log(`🔍 DEBUG: Filter applied - brand: "${filter.brand}", q: "${filter.q}"`);

      if (filter.q) {
        const searchTerm = filter.q.toLowerCase();
        const beforeCount = filteredProducts.length;
        filteredProducts = filteredProducts.filter((product: any) =>
          product.product_name?.toLowerCase().includes(searchTerm) ||
          product.brand?.toLowerCase().includes(searchTerm) ||
          product.ean?.toLowerCase().includes(searchTerm) ||
          product.product_code?.toLowerCase().includes(searchTerm)
        );
        console.log(`🔍 DEBUG: Search filter "${searchTerm}" - ${beforeCount} -> ${filteredProducts.length} products`);
      }

      if (filter.brand) {
        const beforeCount = filteredProducts.length;
        console.log(`🔍 DEBUG: Before brand filter - sample brands: ${filteredProducts.slice(0,3).map((p: any) => `"${p.brand}"`).join(', ')}`);
        // Case-insensitive brand filter
        const filterBrandLower = filter.brand.toLowerCase();
        filteredProducts = filteredProducts.filter((product: any) => 
          product.brand && product.brand.toLowerCase() === filterBrandLower
        );
        console.log(`🔍 DEBUG: Brand filter "${filter.brand}" (case-insensitive) - ${beforeCount} -> ${filteredProducts.length} products`);
      }

      if (filter.categoryId) {
        filteredProducts = filteredProducts.filter((product: any) => product.category === filter.categoryId);
      }

      // Transform to Product interface - mapping odoo_moombs_int_product_data schema
      const items: Product[] = filteredProducts.map((product: any) => ({
        id: product.id?.toString() || '', // Convert integer to string
        title: product.product_name || `Product ${product.id}`, // Use product name as title
        brand: product.brand,
        moombs_brand: product.brand, // Store original brand field
        category_id: product.category,
        moombs_category: product.category, // Store original category field
        price: product.price ? parseFloat(product.price) : undefined, // Direct decimal price
        gtin: product.ean,
        description: product.product_code, // Use product_code as description since no description field
        media: product.image_url ? [{ url: product.image_url }] : undefined,
        tenant_id: undefined // No tenant_id in this table
      }));

      const page = filter.offset ? Math.floor(filter.offset / (filter.limit || 250)) + 1 : 1;
      const total = items.length;

      return { items, page, total };
    } catch (error) {
      console.error('Error getting products:', error);
      // Fallback to empty result
      return { items: [], page: 1, total: 0 };
    }
  }

  async getProductById(
    context: NcContext,
    productId: string,
  ): Promise<Product | null> {
    try {
      // Handle both string format (int-123) and integer format (123) IDs
      const actualId = this.extractNumericId(productId);
      
      const product = await this.ncMeta.metaGet2(
        context.workspace_id,
        'default',
        'odoo_moombs_int_product_data',
        actualId
      );

      if (!product) return null;

      return {
        id: product.id?.toString() || '',
        title: product.product_name || `Product ${product.id}`,
        brand: product.brand,
        moombs_brand: product.brand, // Store original brand field
        category_id: product.category,
        moombs_category: product.category, // Store original category field
        price: product.price ? parseFloat(product.price) : undefined,
        gtin: product.ean,
        description: product.product_code,
        media: product.image_url ? [{ url: product.image_url }] : undefined,
        tenant_id: undefined
      };
    } catch (error) {
      console.error('Error getting product by ID:', error);
      return null;
    }
  }

  async getExternalCandidates(
    context: NcContext,
    localProduct: Product,
    filter: CandidateFilter,
  ): Promise<{ items: ExternalProduct[]; generated_at: string }> {
    try {
      const candidates: ExternalProduct[] = [];
      const generated_at = new Date().toISOString();

      // Get active sources
      const sources = await ProductMatchSource.list(context, 100, 0, this.ncMeta);
      const activeSources = sources.filter((source: any) => 
        !filter.sources || filter.sources.includes(source.code || '')
      );

      // For each source, find candidates
      console.log(`🔍 DEBUG: Finding candidates for internal product: "${localProduct.title}" (Brand: "${localProduct.moombs_brand || localProduct.brand}", Category: "${localProduct.moombs_category || localProduct.category_id}")`);
      
      for (const source of activeSources) {
        const sourceCandidates = await this.findCandidatesForSource(
          context,
          localProduct,
          source,
          filter,
        );
        candidates.push(...sourceCandidates);
      }

      // Sort by score and limit results
      candidates.sort((a, b) => b.score - a.score);
      const limit = filter.limit || 25;
      const limitedCandidates = candidates.slice(0, limit);

      return {
        items: limitedCandidates,
        generated_at,
      };
    } catch (error) {
      console.error('Error getting external candidates:', error);
      return { items: [], generated_at: new Date().toISOString() };
    }
  }

  private async findCandidatesForSource(
    context: NcContext,
    localProduct: Product,
    source: any,
    filter: CandidateFilter,
  ): Promise<ExternalProduct[]> {
    try {
      console.log(`🚀 ENHANCED MATCHING: Starting search for "${localProduct.title}" in source ${source.name}`);
      
      // Build condition object for external products query
      // Sequential Cascade Matching: Compare ALL external products with internal product
      // NO FILTERING - Every external product will be compared regardless of brand, category, etc.
      const condition: any = {};
      
      // ✅ NO FILTERS APPLIED - Let the sequential cascade matching handle everything

      // Query external products from database for this source
      const externalProducts = await this.ncMeta.metaList2(
        context.workspace_id,
        'default',
        'nc_external_products',
        {
          condition: condition,
          limit: 500 // Increased limit to get more candidates for better matching
        }
      );

      console.log(`📋 Found ${externalProducts.length} external products to analyze`);

      // Convert to proper format for enhanced matching engine
      const internalProductFormatted = {
        id: localProduct.id,
        title: localProduct.title,
        brand: localProduct.brand,
        moombs_brand: localProduct.moombs_brand,
        category_id: localProduct.category_id,
        moombs_category: localProduct.moombs_category,
        price: localProduct.price,
        gtin: localProduct.gtin
      };

      const externalProductsFormatted = externalProducts.map((ext: any) => ({
        external_product_key: ext.external_product_key,
        title: ext.product_name,                    // NEW: product_name (was title)
        brand: ext.brand,
        category_id: ext.product_category,          // NEW: product_category (was category_id)
        price: ext.price ? Number(ext.price) : undefined,
        gtin: ext.ean,                              // NEW: ean (was gtin)
        image_url: ext.image,                       // NEW: image (was image_url)
        // NEW: Additional fields from enhanced schema
        product_type: ext.product_type,
        short_description: ext.short_description,
        long_description: ext.long_description,
        discount: ext.discount ? Number(ext.discount) : undefined,
        offer_price: ext.offer_price ? Number(ext.offer_price) : undefined,
        color_options: ext.color_options,
        size_options: ext.size_options,
        color: ext.color,
        measurements: ext.measurements,
        specifications: ext.specifications,
        dimensions: ext.dimensions,
        sku: ext.sku,
        url: ext.url                                // NEW: url (was product_url)
      }));

      // Use enhanced matching engine
      const matchCandidates = await EnhancedMatchingEngine.findMatches(
        internalProductFormatted,
        externalProductsFormatted,
        {
          id: source.id || '',
          code: source.code || '',
          name: source.name || ''
        }
      );

      // Get quality summary
      const qualitySummary = EnhancedMatchingEngine.getMatchQualitySummary(matchCandidates);
      console.log(`📊 MATCH QUALITY SUMMARY:`, qualitySummary);

      // Convert back to expected format with backward compatibility
      const candidates: ExternalProduct[] = matchCandidates.map(candidate => ({
        external_product_key: candidate.external_product_key,
        source: candidate.source,
        title: candidate.title,
        brand: candidate.brand,
        price: candidate.price,
        image: candidate.image,
        gtin: candidate.gtin,
        score: candidate.score, // 0-1 scale for backward compatibility
        explanations: candidate.explanations || {
          name: candidate.subscores?.name || 0,
          brand: candidate.subscores?.brand || 0,
          category: candidate.subscores?.category || 0,
          price: candidate.subscores?.price || 0,
          gtin: candidate.tier === 'high' && candidate.confidence === 100 ? 100 : 0
        },
        // NEW: Enhanced schema fields
        product_type: candidate.product_type,
        short_description: candidate.short_description,
        long_description: candidate.long_description,
        discount: candidate.discount,
        offer_price: candidate.offer_price,
        color_options: candidate.color_options,
        size_options: candidate.size_options,
        color: candidate.color,
        measurements: candidate.measurements,
        specifications: candidate.specifications,
        dimensions: candidate.dimensions,
        sku: candidate.sku,
        url: candidate.url,
        // NEW: Enhanced fields from ProductMatchingRules.md
        confidence: candidate.confidence,      // 0-100 scale
        tier: candidate.tier,                  // 'high'|'review'|'low'
        reasons: candidate.reasons,            // Match reasons array
        subscores: candidate.subscores,        // Individual component scores
        // Legacy compatibility
        matchReasons: candidate.reasons,       // Alias for reasons
        warnings: candidate.warnings || []    // Empty array if no warnings
      } as any));

      console.log(`✅ ENHANCED MATCHING COMPLETE: ${candidates.length} high-quality matches found`);
      return candidates;
      
    } catch (error) {
      console.error('❌ Error in enhanced matching:', error);
      return [];
    }
  }

  /**
   * @deprecated Use FuzzyMatchingHelper.calculateProductSimilarity instead
   * Legacy similarity calculation for backward compatibility
   */
  private calculateSimilarityScore(localProduct: Product, externalProduct: any): number {
    // Use the enhanced fuzzy matching helper
    const result = FuzzyMatchingHelper.calculateProductSimilarity(
      {
        title: localProduct.title,
        brand: localProduct.brand,
        category: localProduct.category_id,
        price: localProduct.price,
        gtin: localProduct.gtin
      },
      {
        title: externalProduct.title,
        brand: externalProduct.brand,
        category: undefined,
        price: externalProduct.price ? Number(externalProduct.price) : undefined,
        gtin: externalProduct.gtin
      }
    );

    return result.overall;
  }

  /**
   * @deprecated Use FuzzyMatchingHelper.calculateNameSimilarity instead
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    return FuzzyMatchingHelper.calculateNameSimilarity(name1, name2);
  }

  /**
   * @deprecated Use FuzzyMatchingHelper.calculateBrandSimilarity instead
   */
  private calculateBrandSimilarity(brand1?: string, brand2?: string): number {
    return FuzzyMatchingHelper.calculateBrandSimilarity(brand1, brand2);
  }

  /**
   * Check if two categories represent relevant product types
   */
  private isRelevantProductMatch(internalCategory: string, externalCategory: string): boolean {
    // Product type groups that are related
    const productTypeGroups = {
      'strollers': ['stroller', 'pram', 'pushchair', 'buggy', 'carriage', 'paseo', 'capota', 'base'],
      'car_seats': ['car-seat', 'car seat', 'safety seat', 'child seat', 'booster', 'carseat'],
      'baby_gear': ['baby-gear', 'baby gear', 'baby-accessories', 'baby-accessory', 'accessories'],
      'sleep': ['sleep', 'bedding', 'blanket', 'manta', 'sleeping', 'cuna', 'crib'],
      'feeding': ['feeding', 'bottle', 'food', 'nutrition', 'eating', 'alimentacion'],
      'bath': ['bath', 'bathing', 'hygiene', 'care', 'bano', 'higiene'],
      'toys': ['toys', 'play', 'games', 'juguetes', 'juegos'],
      'clothing': ['clothing', 'clothes', 'apparel', 'ropa', 'vestimenta'],
      'all': ['all', 'general', 'various', 'multiple', 'diverse'] // "All" category is very generic
    };

    const internal = internalCategory.toLowerCase();
    const external = externalCategory.toLowerCase();

    // Check if both categories belong to the same product type group
    for (const [groupKey, groupMembers] of Object.entries(productTypeGroups)) {
      if (groupMembers.includes(internal) && groupMembers.includes(external)) {
        return true;
      }
    }

    // Direct match
    if (internal === external) {
      return true;
    }

    // Partial match (one contains the other)
    if (internal.includes(external) || external.includes(internal)) {
      return true;
    }

    // Special case: "All" category can match with many categories
    if (internal === 'all' || external === 'all') {
      return true; // "All" is very generic, allow most matches
    }

    return false;
  }

  /**
   * Check for brand variations and abbreviations
   */
  private checkBrandVariations(brand1: string, brand2: string): boolean {
    const b1 = brand1.toLowerCase().trim();
    const b2 = brand2.toLowerCase().trim();

    // Exact match
    if (b1 === b2) return true;

    // Common brand variations
    const brandVariations: { [key: string]: string[] } = {
      'bugaboo': ['bgb', 'bugaboo'],
      'jane': ['jn', 'jane'],
      'britax': ['br', 'britax', 'britax römer', 'britax romer'],
      'maxi-cosi': ['mc', 'maxi cosi', 'maxicosi'],
      'uppababy': ['uppa', 'uppababy'],
      'inglesina': ['ing', 'inglesina'],
      'cotinfant': ['ct', 'cotinfant'],
      'besafe': ['besafe', 'be safe'],
      'joie': ['joi', 'joie'],
      'micuna': ['mc', 'micuna']
    };

    // Check if either brand is a variation of the other
    for (const [fullBrand, variations] of Object.entries(brandVariations)) {
      if (variations.includes(b1) && variations.includes(b2)) {
        return true;
      }
    }

    // Check for partial matches (one brand contains the other)
    if (b1.includes(b2) || b2.includes(b1)) {
      return true;
    }

    // Check for acronyms (e.g., "BGB" vs "Bugaboo")
    if (b1.length <= 4 && b2.length > 4) {
      // b1 is short, check if it's an acronym of b2
      if (this.isAcronym(b1, b2)) return true;
    } else if (b2.length <= 4 && b1.length > 4) {
      // b2 is short, check if it's an acronym of b1
      if (this.isAcronym(b2, b1)) return true;
    }

    return false;
  }

  /**
   * Check if a short string is an acronym of a longer string
   */
  private isAcronym(shortStr: string, longStr: string): boolean {
    if (shortStr.length > longStr.length) return false;
    
    const words = longStr.split(/[\s\-_]+/);
    const acronym = words.map(word => word.charAt(0)).join('').toLowerCase();
    
    return acronym === shortStr.toLowerCase();
  }

  /**
   * Infer category from product name when category is too generic
   */
  private inferCategoryFromProductName(productName: string, externalCategory: string): boolean {
    const name = productName.toLowerCase();
    const extCategory = externalCategory.toLowerCase();

    // Product name keywords that suggest specific categories
    const categoryKeywords = {
      'stroller': ['stroller', 'pram', 'pushchair', 'buggy', 'carriage', 'paseo', 'capota', 'base'],
      'car_seat': ['car seat', 'safety seat', 'child seat', 'booster', 'carseat'],
      'sleep': ['sleep', 'bedding', 'blanket', 'manta', 'sleeping', 'cuna', 'crib', 'capota'],
      'feeding': ['feeding', 'bottle', 'food', 'nutrition', 'eating', 'alimentacion'],
      'bath': ['bath', 'bathing', 'hygiene', 'care', 'bano', 'higiene'],
      'toys': ['toys', 'play', 'games', 'juguetes', 'juegos']
    };

    // Check if product name contains keywords that match the external category
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        // Check if external category is related
        if (this.isRelevantProductMatch(category, extCategory)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get category similarity using the mapping table
   */
  private async getCategorySimilarity(internalCategory: string, externalCategory: string): Promise<number> {
    try {
      // Query the category mapping table
      const mappingResult = await this.ncMeta.metaList2(
        'default', // workspace_id
        'default', // base_id
        'nc_product_match_category_map',
        {
          condition: {
            internal_category: internalCategory,
            external_category: externalCategory
          },
          limit: 1
        }
      );

      if (mappingResult && mappingResult.length > 0) {
        return mappingResult[0].similarity_score || 0.0;
      }

      // Check reverse mapping
      const reverseMappingResult = await this.ncMeta.metaList2(
        'default', // workspace_id
        'default', // base_id
        'nc_product_match_category_map',
        {
          condition: {
            internal_category: externalCategory,
            external_category: internalCategory
          },
          limit: 1
        }
      );

      if (reverseMappingResult && reverseMappingResult.length > 0) {
        return reverseMappingResult[0].similarity_score || 0.0;
      }

      // No mapping found, return 0
      return 0.0;
    } catch (error) {
      console.error('Error getting category similarity:', error);
      return 0.0;
    }
  }

  private calculatePriceSimilarity(price1?: number, price2?: number): number {
    if (!price1 || !price2) return 0;
    
    const diff = Math.abs(price1 - price2);
    const avgPrice = (price1 + price2) / 2;
    
    if (avgPrice === 0) return 0;
    
    const percentageDiff = (diff / avgPrice) * 100;
    
    // Higher score for smaller price differences
    if (percentageDiff <= 5) return 1.0;
    if (percentageDiff <= 10) return 0.9;
    if (percentageDiff <= 15) return 0.8;
    if (percentageDiff <= 20) return 0.7;
    if (percentageDiff <= 25) return 0.6;
    return 0.5;
  }

  async confirmMatch(
    context: NcContext,
    matchData: {
      local_product_id: string;
      external_product_key: string;
      source_code: string;
      score: number;
      price_delta_pct: number;
      status: 'matched' | 'not_matched';
      notes?: string;
    },
    userId: string,
  ): Promise<{ match_id: string }> {
    // Get source by code
    const source = await ProductMatchSource.getByCode(
      context,
      matchData.source_code,
      this.ncMeta,
    );

    if (!source) {
      throw new Error(`Source not found: ${matchData.source_code}`);
    }

    // Create the match
    const match = await ProductMatch.insert(
      context,
      {
        tenant_id: context.workspace_id,
        local_product_id: matchData.local_product_id,
        external_product_key: matchData.external_product_key,
        source_id: source.id,
        score: matchData.score,
        price_delta_pct: matchData.price_delta_pct,
        status: matchData.status,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        notes: matchData.notes,
        created_by: userId,
      },
      this.ncMeta,
    );

    return { match_id: match.id || '' };
  }

  async getMatches(
    context: NcContext,
    filters: {
      localProductId?: string;
      externalProductKey?: string;
      source?: string;
      reviewedBy?: string;
      status?: string;
    } = {},
    limit = 50,
    offset = 0,
  ): Promise<{ items: any[]; page: number; total: number }> {
    const matches = await ProductMatch.list(
      context,
      {
        localProductId: filters.localProductId,
        externalProductKey: filters.externalProductKey,
        sourceId: filters.source,
        reviewedBy: filters.reviewedBy,
        status: filters.status,
        tenantId: context.workspace_id,
      },
      limit,
      offset,
      this.ncMeta,
    );

    return {
      items: matches,
      page: Math.floor(offset / limit) + 1,
      total: matches.length, // This should be a count query in real implementation
    };
  }

  async deleteMatch(
    context: NcContext,
    matchId: string,
  ): Promise<void> {
    await ProductMatch.delete(context, matchId, this.ncMeta);
  }

  // New method for creating matches via Match button
  async createMatch(
    context: NcContext,
    matchData: {
      local_product_id: string;
      external_product_key: string;
      source_code: string;
      score: number;
      price_delta_pct: number;
      notes?: string;
    },
    userId: string,
  ): Promise<{ match_id: string }> {
    // Get source by code
    const source = await ProductMatchSource.getByCode(
      context,
      matchData.source_code,
      this.ncMeta,
    );

    if (!source) {
      throw new Error(`Source not found: ${matchData.source_code}`);
    }

    // Check if match already exists
    const existingMatch = await ProductMatch.findByProductPair(
      context,
      matchData.local_product_id,
      matchData.external_product_key,
      this.ncMeta,
    );

    if (existingMatch) {
      throw new Error('Match already exists between these products');
    }

    // Create the match
    const match = await ProductMatch.insert(
      context,
      {
        tenant_id: context.workspace_id,
        local_product_id: matchData.local_product_id,
        external_product_key: matchData.external_product_key,
        source_id: source.id,
        score: matchData.score,
        price_delta_pct: matchData.price_delta_pct,
        status: 'matched',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        notes: matchData.notes || 'Created via Match button',
        created_by: userId,
      },
      this.ncMeta,
    );

    return { match_id: match.id || '' };
  }

  // New method for removing matches via Unmatch button
  async removeMatch(
    context: NcContext,
    matchData: {
      local_product_id: string;
      external_product_key: string;
      source_code: string;
    },
    userId: string,
  ): Promise<{ success: boolean }> {
    // Find the existing match
    const existingMatch = await ProductMatch.findByProductPair(
      context,
      matchData.local_product_id,
      matchData.external_product_key,
      this.ncMeta,
    );

    if (!existingMatch) {
      throw new Error('No match found between these products');
    }

    // Delete the match
    if (!existingMatch.id) {
      throw new Error('Match ID is undefined');
    }
    await ProductMatch.delete(context, existingMatch.id, this.ncMeta);

    return { success: true };
  }

  /**
   * Extract numeric ID from string format (int-123 → 123) or return as is
   */
  private extractNumericId(productId: string): string | number {
    if (typeof productId === 'string' && productId.startsWith('int-')) {
      return productId.substring(4); // Remove 'int-' prefix
    }
    return productId;
  }

  /**
   * Extract price from JSONB standard_price field in moombs_int_product
   */
  private extractPrice(standardPrice: any): number | undefined {
    if (!standardPrice) return undefined;
    
    try {
      // If it's already parsed JSON
      if (typeof standardPrice === 'object') {
        // Try common price field names first
        const directPrice = standardPrice.price || standardPrice.amount || standardPrice.value;
        if (directPrice !== undefined) return directPrice;
        
        // Handle moombs format like {"1": 18.84} - take first numeric key's value
        const keys = Object.keys(standardPrice);
        for (const key of keys) {
          const value = standardPrice[key];
          if (typeof value === 'number') {
            return value;
          }
        }
        
        return undefined;
      }
      
      // If it's a JSON string, parse it
      if (typeof standardPrice === 'string') {
        const parsed = JSON.parse(standardPrice);
        
        // Try common price field names first
        const directPrice = parsed.price || parsed.amount || parsed.value;
        if (directPrice !== undefined) return directPrice;
        
        // Handle moombs format like {"1": 18.84} - take first numeric key's value
        const keys = Object.keys(parsed);
        for (const key of keys) {
          const value = parsed[key];
          if (typeof value === 'number') {
            return value;
          }
        }
        
        return undefined;
      }
      
      // If it's a number, return as is
      if (typeof standardPrice === 'number') {
        return standardPrice;
      }
      
      return undefined;
    } catch (error) {
      console.error('Error extracting price from standard_price:', error);
      return undefined;
    }
  }
}
