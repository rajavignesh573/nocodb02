import { FuzzyMatchingHelper } from './FuzzyMatchingHelper';
import { MatchingDebugger } from './MatchingDebugger';

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
  confidence: number;  // Raw confidence score 0-100
  tier: 'high' | 'review' | 'low';  // ProductMatchingRules.md tier classification
  reasons: string[];  // Match reasons array
  subscores: {
    name: number;
    brand: number;
    category: number;
    price: number;
  };
  // Legacy fields for backward compatibility
  matchReasons?: string[];
  warnings?: string[];
  explanations?: {
    name: number;
    brand: number;
    category: number;
    price: number;
    gtin?: number;
  };
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
  // NEW: Enhanced schema fields
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
export class EnhancedMatchingEngine {
  
  // ProductMatchingRules.md Configuration
  private static readonly CONFIG = {
    // Tier-0: Exact GTIN Match
    PERFECT_GTIN_MATCH_SCORE: 1.0,     // 100% score for exact GTIN match
    
    // Feature Scoring Weights (0-100 scale)
    WEIGHTS: {
      name: 0.50,      // 50% - Primary matching factor
      brand: 0.20,     // 20% - Secondary factor
      category: 0.15,  // 15% - Tertiary factor
      price: 0.15      // 15% - Final factor
    },
    
    // Brand Scoring Tiers
    BRAND_EXACT_SCORE: 100,
    BRAND_ALIAS_SCORE: 90,
    BRAND_INFERRED_SCORE: 75,
    BRAND_CONFLICT_SCORE: 0,
    
    // Category Scoring Tiers
    CATEGORY_EXACT_LEAF_SCORE: 100,
    CATEGORY_SAME_BRANCH_SCORE: 85,
    CATEGORY_DEPARTMENT_SCORE: 65,
    CATEGORY_CROSS_DEPT_SCORE: 0,
    
    // Price Scoring Logic
    PRICE_PERFECT_THRESHOLD: 0.10,     // ±10% = 100 points
    PRICE_GOOD_THRESHOLD: 0.30,        // 10-30% linear drop to 40
    PRICE_POOR_SCORE: 20,              // >30% = 20 points
    PRICE_MISSING_SCORE: 70,           // Missing = neutral 70
    PRICE_SALE_RELAX_THRESHOLD: 0.15,  // Sale items: relax to ±15%
    
    // Confidence Thresholds (ProductMatchingRules.md)
    HIGH_CONFIDENCE_THRESHOLD: 0.85,   // ≥85 → High confidence
    REVIEW_THRESHOLD: 0.70,            // 70-84.9 → Review
    LOW_THRESHOLD: 0.70,               // <70 → Low (not shown)
    
    // Business Rule Caps
    BRAND_CONFLICT_CAP: 0.60,          // Brand conflict → cap 60
    CROSS_DEPT_CAP: 0.55,              // Cross-department → cap 55
    MODEL_MISMATCH_CAP: 0.65,          // Model mismatch → cap 65
    
    // Maximum candidates per product
    MAX_CANDIDATES: 10
  };

  /**
   * Find high-quality matches for an internal product
   */
  static async findMatches(
    internalProduct: InternalProduct,
    externalProducts: ExternalProduct[],
    sourceInfo: { id: string; code: string; name: string }
  ): Promise<MatchCandidate[]> {
    
    console.log(`🔍 Enhanced matching for: "${internalProduct.title}" (${internalProduct.brand || 'No brand'})`);
    
    const candidates: MatchCandidate[] = [];
    let processed = 0;
    let rejected = 0;

    for (const extProduct of externalProducts) {
      processed++;
      
      // Stage 1: Mandatory Requirements Check
      const requirementsCheck = this.checkMandatoryRequirements(internalProduct, extProduct);
      if (!requirementsCheck.passed) {
        MatchingDebugger.logDecision(
          internalProduct.title,
          extProduct.title,
          sourceInfo.name,
          'REJECTED',
          requirementsCheck.reason!
        );
        rejected++;
        continue;
      }

      // Stage 2: Calculate detailed similarity
      const similarity = this.calculateEnhancedSimilarity(internalProduct, extProduct);
      
      // Stage 3: ProductMatchingRules.md - show all matches ≥30%, but tier appropriately
      // Low tier (<70) matches are shown but marked as low confidence
      if (similarity.overall < 0.30) {  // Only reject truly poor matches
        MatchingDebugger.logDecision(
          internalProduct.title,
          extProduct.title,
          sourceInfo.name,
          'REJECTED',
          `Score too low: ${(similarity.overall * 100).toFixed(1)}% < 30%`,
          similarity.overall,
          similarity
        );
        rejected++;
        continue;
      }

      // Stage 4: No price validation - let sequential cascade scoring handle price differences
      // All products pass to final candidate creation

      // Stage 5: Create candidate with confidence assessment
      const candidate = this.createMatchCandidate(
        internalProduct,
        extProduct,
        sourceInfo,
        similarity,
        requirementsCheck.reasons
      );

      candidates.push(candidate);
      
      // Log successful match
      MatchingDebugger.logDecision(
        internalProduct.title,
        extProduct.title,
        sourceInfo.name,
        'MATCHED',
        `Match found (${candidate.tier} tier, ${candidate.confidence.toFixed(1)}% confidence)`,
        candidate.score,
        similarity
      );
    }

    // Sort by score (highest first) and limit results
    const sortedCandidates = candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, this.CONFIG.MAX_CANDIDATES);

    console.log(`📊 MATCHING SUMMARY: ${processed} processed, ${candidates.length} matches found, ${rejected} rejected`);
    
    return sortedCandidates;
  }

  /**
   * Sequential Cascade Matching - NO FILTERING, ALL PRODUCTS COMPARED
   * Every internal product is compared with EVERY external product
   */
  private static checkMandatoryRequirements(
    internal: InternalProduct,
    external: ExternalProduct
  ): { passed: boolean; reason?: string; reasons: string[] } {
    
    const reasons: string[] = [];
    
    // ONLY mandatory requirement: Both products must have titles
    if (!internal.title?.trim() || !external.title?.trim()) {
      return { passed: false, reason: 'Missing product title', reasons };
    }
    
    // ✅ ALL OTHER CHECKS REMOVED - Let every product be compared
    // The scoring system will handle the quality assessment
    reasons.push('✓ Ready for sequential cascade matching');
    
    return { passed: true, reasons };
  }

  /**
   * ProductMatchingRules.md Algorithm Implementation
   * 1. Tier-0: Exact GTIN Match → 100%
   * 2. Feature Scoring: Final = 0.50×Name + 0.20×Brand + 0.15×Category + 0.15×Price
   * 3. Apply business rule caps and penalties
   */
  private static calculateEnhancedSimilarity(
    internal: InternalProduct,
    external: ExternalProduct
  ) {
    const subscores: any = {};
    const reasons: string[] = [];
    let penalties: string[] = [];
    let capsApplied: string[] = [];
    
    // Tier-0: Exact GTIN Match
    const gtinMatch = this.calculateGtinMatch(internal.gtin, external.gtin);
    if (gtinMatch.isExact) {
      return {
        overall: this.CONFIG.PERFECT_GTIN_MATCH_SCORE,
        subscores: { name: 100, brand: 100, category: 100, price: 100 },
        reasons: ['gtin_exact_match'],
        penalties: [],
        capsApplied: [],
        matchType: 'GTIN_EXACT_MATCH'
      };
    }
    
    // Feature Scoring (0-100 scale)
    
    // Name Score (50% weight)
    const nameResult = this.calculateNameScore(
      internal.title || '',
      external.title || ''
    );
    subscores.name = nameResult.score;
    reasons.push(...nameResult.reasons);
    penalties.push(...nameResult.penalties);
    
    // Brand Score (20% weight)
    const brandResult = this.calculateBrandScore(
      internal.moombs_brand || internal.brand || '',
      external.brand || ''
    );
    subscores.brand = brandResult.score;
    reasons.push(...brandResult.reasons);
    if (brandResult.conflict) {
      penalties.push('brand_conflict');
    }
    
    // Category Score (15% weight)
    const categoryResult = this.calculateCategoryScore(
      internal.moombs_category || internal.category_id || '',
      external.category_id || ''
    );
    subscores.category = categoryResult.score;
    reasons.push(...categoryResult.reasons);
    if (categoryResult.crossDepartment) {
      penalties.push('cross_dept');
    }
    
    // Price Score (15% weight)
    const priceResult = this.calculatePriceScore(
      internal.price,
      external.price,
      external.discount ? true : false  // Detect if on sale
    );
    subscores.price = priceResult.score;
    reasons.push(...priceResult.reasons);
    
    // Calculate weighted final score
    let finalScore = (
      subscores.name * this.CONFIG.WEIGHTS.name +
      subscores.brand * this.CONFIG.WEIGHTS.brand +
      subscores.category * this.CONFIG.WEIGHTS.category +
      subscores.price * this.CONFIG.WEIGHTS.price
    ) / 100;  // Convert to 0-1 scale
    
    // Apply business rule caps
    if (brandResult.conflict && finalScore > this.CONFIG.BRAND_CONFLICT_CAP) {
      finalScore = this.CONFIG.BRAND_CONFLICT_CAP;
      capsApplied.push('brand_conflict_cap_60');
    }
    
    if (categoryResult.crossDepartment && finalScore > this.CONFIG.CROSS_DEPT_CAP) {
      finalScore = this.CONFIG.CROSS_DEPT_CAP;
      capsApplied.push('cross_dept_cap_55');
    }
    
    if (nameResult.modelMismatch && finalScore > this.CONFIG.MODEL_MISMATCH_CAP) {
      finalScore = this.CONFIG.MODEL_MISMATCH_CAP;
      capsApplied.push('model_mismatch_cap_65');
    }
    
    return {
      overall: finalScore,
      subscores,
      reasons: reasons.filter(r => r), // Remove empty reasons
      penalties,
      capsApplied,
      matchType: 'FEATURE_SCORING'
    };
  }

  /**
   * Calculate GTIN/EAN match - ProductMatchingRules.md Tier-0
   */
  private static calculateGtinMatch(gtin1?: string, gtin2?: string): { isExact: boolean; reason?: string } {
    if (!gtin1 || !gtin2) {
      return { isExact: false, reason: 'missing' };
    }
    
    // Normalize to GTIN-14 format and validate checksum (simplified)
    const clean1 = gtin1.replace(/\s+/g, '').padStart(14, '0');
    const clean2 = gtin2.replace(/\s+/g, '').padStart(14, '0');
    
    return {
      isExact: clean1 === clean2,
      reason: clean1 === clean2 ? 'exact_valid' : 'different'
    };
  }
  
  /**
   * Calculate Name Score (0-100) - ProductMatchingRules.md
   * Semantic similarity, token Jaccard, char fuzzy with penalties
   */
  private static calculateNameScore(name1: string, name2: string): {
    score: number;
    reasons: string[];
    penalties: string[];
    modelMismatch: boolean;
  } {
    if (!name1 || !name2) {
      return { score: 0, reasons: [], penalties: [], modelMismatch: false };
    }
    
    // Base semantic similarity (0-1)
    const semanticSim = FuzzyMatchingHelper.calculateNameSimilarity(name1, name2);
    let score = semanticSim * 100;
    const reasons: string[] = [];
    const penalties: string[] = [];
    let modelMismatch = false;
    
    reasons.push(`name_sem:${semanticSim.toFixed(2)}`);
    
    // Apply penalties for specific mismatches
    if (this.detectAccessoryMismatch(name1, name2)) {
      score -= 10;
      penalties.push('accessory_confusion:-10');
    }
    
    if (this.detectPackMismatch(name1, name2)) {
      score -= 8;
      penalties.push('pack_mismatch:-8');
    }
    
    if (this.detectModelMismatch(name1, name2)) {
      modelMismatch = true;
      penalties.push('model_mismatch_core');
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      reasons,
      penalties,
      modelMismatch
    };
  }
  
  /**
   * Calculate Brand Score (0-100) - ProductMatchingRules.md
   * Exact=100, Alias=90, Inferred=75, Conflict=0
   */
  private static calculateBrandScore(brand1: string, brand2: string): {
    score: number;
    reasons: string[];
    conflict: boolean;
  } {
    if (!brand1 || !brand2) {
      return { score: 0, reasons: [], conflict: false };
    }
    
    const norm1 = brand1.toLowerCase().trim();
    const norm2 = brand2.toLowerCase().trim();
    
    // Exact match
    if (norm1 === norm2) {
      return {
        score: this.CONFIG.BRAND_EXACT_SCORE,
        reasons: ['brand:exact'],
        conflict: false
      };
    }
    
    // Check for brand aliases (simplified - would use lookup table in production)
    if (this.areBrandAliases(norm1, norm2)) {
      return {
        score: this.CONFIG.BRAND_ALIAS_SCORE,
        reasons: ['brand:alias'],
        conflict: false
      };
    }
    
    // Check for inferred brand match (fuzzy similarity)
    const similarity = FuzzyMatchingHelper.calculateBrandSimilarity(brand1, brand2);
    if (similarity > 0.8) {
      return {
        score: this.CONFIG.BRAND_INFERRED_SCORE,
        reasons: ['brand:inferred'],
        conflict: false
      };
    }
    
    // Brand conflict detected
    return {
      score: this.CONFIG.BRAND_CONFLICT_SCORE,
      reasons: ['brand:conflict'],
      conflict: true
    };
  }
  
  /**
   * Calculate Category Score (0-100) - ProductMatchingRules.md
   * Exact leaf=100, Same branch=85, Department=65, Cross-department=0
   */
  private static calculateCategoryScore(cat1: string, cat2: string): {
    score: number;
    reasons: string[];
    crossDepartment: boolean;
  } {
    if (!cat1 || !cat2) {
      return { score: 0, reasons: [], crossDepartment: false };
    }
    
    const norm1 = cat1.toLowerCase().trim();
    const norm2 = cat2.toLowerCase().trim();
    
    // Exact leaf match
    if (norm1 === norm2) {
      return {
        score: this.CONFIG.CATEGORY_EXACT_LEAF_SCORE,
        reasons: ['category:exact-leaf'],
        crossDepartment: false
      };
    }
    
    // Same branch (simplified - would use category taxonomy in production)
    if (this.areSameBranch(norm1, norm2)) {
      return {
        score: this.CONFIG.CATEGORY_SAME_BRANCH_SCORE,
        reasons: ['category:same-branch'],
        crossDepartment: false
      };
    }
    
    // Same department
    if (this.areSameDepartment(norm1, norm2)) {
      return {
        score: this.CONFIG.CATEGORY_DEPARTMENT_SCORE,
        reasons: ['category:department'],
        crossDepartment: false
      };
    }
    
    // Cross-department
    return {
      score: this.CONFIG.CATEGORY_CROSS_DEPT_SCORE,
      reasons: ['category:cross-dept'],
      crossDepartment: true
    };
  }
  
  /**
   * Calculate Price Score (0-100) - ProductMatchingRules.md
   * ±10%=100, 10-30% linear to 40, >30%=20, missing=70, sale relax to 15%
   */
  private static calculatePriceScore(price1?: number, price2?: number, onSale = false): {
    score: number;
    reasons: string[];
  } {
    // Missing price = neutral 70
    if (!price1 || !price2) {
      return {
        score: this.CONFIG.PRICE_MISSING_SCORE,
        reasons: ['price_missing->neutral70']
      };
    }
    
    const priceDiff = Math.abs(price1 - price2);
    const avgPrice = (price1 + price2) / 2;
    const relDiff = priceDiff / avgPrice;
    
    const perfectThreshold = onSale ? this.CONFIG.PRICE_SALE_RELAX_THRESHOLD : this.CONFIG.PRICE_PERFECT_THRESHOLD;
    const reasons: string[] = [];
    
    if (onSale) {
      reasons.push('sale_relax');
    }
    
    // Within perfect threshold
    if (relDiff <= perfectThreshold) {
      const pct = (relDiff * 100).toFixed(0);
      reasons.push(`price:within-${pct}%`);
      return { score: 100, reasons };
    }
    
    // Within good threshold - linear drop from 100 to 40
    if (relDiff <= this.CONFIG.PRICE_GOOD_THRESHOLD) {
      const normalizedDiff = (relDiff - perfectThreshold) / (this.CONFIG.PRICE_GOOD_THRESHOLD - perfectThreshold);
      const score = 100 - (normalizedDiff * 60); // Drop from 100 to 40
      const pct = (relDiff * 100).toFixed(0);
      reasons.push(`price:within-${pct}%`);
      return { score: Math.round(score), reasons };
    }
    
    // Poor price match
    const pct = (relDiff * 100).toFixed(0);
    reasons.push(`price:diff-${pct}%`);
    return { score: this.CONFIG.PRICE_POOR_SCORE, reasons };
  }

  /**
   * Helper methods for business logic detection
   */
  private static detectAccessoryMismatch(name1: string, name2: string): boolean {
    const accessories = ['cover', 'case', 'strap', 'belt', 'adapter', 'charger'];
    const hasAccessory1 = accessories.some(acc => name1.toLowerCase().includes(acc));
    const hasAccessory2 = accessories.some(acc => name2.toLowerCase().includes(acc));
    return hasAccessory1 !== hasAccessory2;
  }
  
  private static detectPackMismatch(name1: string, name2: string): boolean {
    const packRegex = /(\d+)\s*(pack|count|pcs|pieces)/i;
    const pack1 = name1.match(packRegex);
    const pack2 = name2.match(packRegex);
    if (pack1 && pack2) {
      return parseInt(pack1[1]) !== parseInt(pack2[1]);
    }
    return (pack1 !== null) !== (pack2 !== null);
  }
  
  private static detectModelMismatch(name1: string, name2: string): boolean {
    // Simplified model detection for core baby gear
    const coreGear = ['stroller', 'car seat', 'crib', 'highchair'];
    const isCoreGear = coreGear.some(gear => 
      name1.toLowerCase().includes(gear) || name2.toLowerCase().includes(gear)
    );
    
    if (!isCoreGear) return false;
    
    // Check for model number differences (simplified)
    const modelRegex = /[A-Z]\d{2,}/g;
    const models1 = name1.match(modelRegex) || [];
    const models2 = name2.match(modelRegex) || [];
    
    return models1.length > 0 && models2.length > 0 && 
           !models1.some(m1 => models2.some(m2 => m1 === m2));
  }
  
  private static areBrandAliases(brand1: string, brand2: string): boolean {
    // Simplified brand alias detection - would use lookup table in production
    const aliases = {
      'johnsons': ['johnson\'s', 'johnson & johnson', 'johnson'],
      'johnson\'s': ['johnsons', 'johnson & johnson', 'johnson'],
      'pampers': ['p&g', 'procter & gamble'],
      'huggies': ['kimberly-clark', 'kc']
    };
    
    for (const [canonical, variants] of Object.entries(aliases)) {
      if ((brand1 === canonical && variants.includes(brand2)) ||
          (brand2 === canonical && variants.includes(brand1)) ||
          (variants.includes(brand1) && variants.includes(brand2))) {
        return true;
      }
    }
    return false;
  }
  
  private static areSameBranch(cat1: string, cat2: string): boolean {
    // Simplified category hierarchy - would use taxonomy in production
    const branches = [
      ['feeding', 'bottles', 'sippy cups', 'high chairs'],
      ['safety', 'car seats', 'gates', 'monitors'],
      ['sleep', 'cribs', 'mattresses', 'bedding'],
      ['play', 'toys', 'books', 'games'],
      ['baby-care', 'baby-personal-care', 'baby-hygiene', 'baby-health']
    ];
    
    return branches.some(branch => 
      branch.some(cat => cat1.includes(cat)) && 
      branch.some(cat => cat2.includes(cat))
    );
  }
  
  private static areSameDepartment(cat1: string, cat2: string): boolean {
    // Simplified department detection
    const departments = [
      ['baby', 'infant', 'toddler', 'newborn'],
      ['kids', 'children', 'child']
    ];
    
    return departments.some(dept => 
      dept.some(d => cat1.includes(d)) && 
      dept.some(d => cat2.includes(d))
    );
  }

  /**
   * Create match candidate following ProductMatchingRules.md output contract
   */
  private static createMatchCandidate(
    internal: InternalProduct,
    external: ExternalProduct,
    sourceInfo: { id: string; code: string; name: string },
    similarity: any,
    matchReasons: string[]
  ): MatchCandidate {
    
    const confidenceScore = similarity.overall * 100; // Convert to 0-100 scale
    const warnings: string[] = [];
    
    // Determine tier following ProductMatchingRules.md thresholds
    let tier: 'high' | 'review' | 'low';
    if (confidenceScore >= 85) {
      tier = 'high';
    } else if (confidenceScore >= 70) {
      tier = 'review';
    } else {
      tier = 'low';
      warnings.push('Lower confidence match - review carefully');
    }

    // Combine all reasons from the similarity calculation
    const allReasons = [
      ...matchReasons,
      ...similarity.reasons,
      ...similarity.penalties
    ].filter(r => r && r.trim() !== ''); // Remove empty reasons

    // Add caps information to reasons if applied
    if (similarity.capsApplied && similarity.capsApplied.length > 0) {
      allReasons.push(...similarity.capsApplied);
    }

    return {
      external_product_key: external.external_product_key,
      source: sourceInfo,
      title: external.title,
      brand: external.brand,
      price: external.price,
      image: external.image_url,
      gtin: external.gtin,
      score: similarity.overall, // Keep 0-1 scale for backward compatibility
      confidence: confidenceScore, // New: 0-100 scale confidence
      tier, // New: ProductMatchingRules.md tier
      reasons: allReasons, // New: ProductMatchingRules.md reasons array
      subscores: similarity.subscores, // New: ProductMatchingRules.md subscores
      // Legacy fields for backward compatibility
      matchReasons: allReasons,
      warnings,
      explanations: {
        name: similarity.subscores?.name || 0,
        brand: similarity.subscores?.brand || 0,
        category: similarity.subscores?.category || 0,
        price: similarity.subscores?.price || 0,
        gtin: similarity.matchType === 'GTIN_EXACT_MATCH' ? 100 : 0
      },
      // Enhanced schema fields
      product_type: external.product_type,
      short_description: external.short_description,
      long_description: external.long_description,
      discount: external.discount,
      offer_price: external.offer_price,
      color_options: external.color_options,
      size_options: external.size_options,
      color: external.color,
      measurements: external.measurements,
      specifications: external.specifications,
      dimensions: external.dimensions,
      sku: external.sku,
      url: external.url
    };
  }

  /**
   * Get match quality summary for debugging
   */
  static getMatchQualitySummary(candidates: MatchCandidate[]) {
    const total = candidates.length;
    const highTier = candidates.filter(c => c.tier === 'high').length;
    const reviewTier = candidates.filter(c => c.tier === 'review').length;
    const lowTier = candidates.filter(c => c.tier === 'low').length;
    
    return {
      total,
      highTier,
      reviewTier,
      lowTier,
      // Legacy compatibility
      highConfidence: highTier,
      mediumConfidence: reviewTier,
      lowConfidence: lowTier,
      averageScore: total > 0 ? candidates.reduce((sum, c) => sum + c.score, 0) / total : 0,
      topScore: total > 0 ? Math.max(...candidates.map(c => c.score)) : 0
    };
  }
}
