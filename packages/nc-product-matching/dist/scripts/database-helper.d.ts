/**
 * Database Helper for Bulk Product Comparison
 *
 * This module provides database connection and query methods
 * for loading real product data from NocoDB tables.
 */
import { InternalProduct, ExternalProduct } from '../helpers/EnhancedMatchingEngine';
export declare class DatabaseHelper {
    private static db;
    /**
     * Initialize database connection
     */
    static initialize(config?: any): Promise<void>;
    /**
     * Load internal products from odoo_moombs_int_product_data table
     */
    static loadInternalProducts(limit?: number, offset?: number, filters?: {
        category?: string;
        brand?: string;
        hasGtin?: boolean;
    }): Promise<InternalProduct[]>;
    /**
     * Load external products from nc_external_products table
     */
    static loadExternalProducts(limit?: number, offset?: number, filters?: {
        sources?: string[];
        category?: string;
        brand?: string;
        hasGtin?: boolean;
    }): Promise<ExternalProduct[]>;
    /**
     * Get database statistics for actual tables
     */
    static getStatistics(): Promise<{
        internalProductCount: number;
        externalProductCount: number;
        gtinCoverage: {
            internal: number;
            external: number;
        };
    }>;
    /**
     * Close database connection
     */
    static close(): Promise<void>;
}
//# sourceMappingURL=database-helper.d.ts.map