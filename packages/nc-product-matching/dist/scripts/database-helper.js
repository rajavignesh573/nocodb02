"use strict";
/**
 * Database Helper for Bulk Product Comparison
 *
 * This module provides database connection and query methods
 * for loading real product data from NocoDB tables.
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
exports.DatabaseHelper = void 0;
const knex = __importStar(require("knex"));
class DatabaseHelper {
    /**
     * Initialize database connection
     */
    static async initialize(config) {
        if (this.db)
            return;
        // User's actual database configuration
        const defaultConfig = {
            client: 'pg',
            connection: {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432'),
                user: process.env.DB_USER || 'devuser',
                password: process.env.DB_PASSWORD || 'VerifyTen102025',
                database: process.env.DB_NAME || 'pim',
                searchPath: [process.env.DB_SCHEMA || 'public']
            },
            pool: {
                min: 2,
                max: 10
            }
        };
        this.db = knex.knex(config || defaultConfig);
        try {
            // Test connection
            await this.db.raw('SELECT 1');
            console.log('✅ Database connection established');
        }
        catch (error) {
            console.error('❌ Database connection failed:', error);
            throw error;
        }
    }
    /**
     * Load internal products from odoo_moombs_int_product_data table
     */
    static async loadInternalProducts(limit, offset, filters) {
        if (!this.db) {
            throw new Error('Database not initialized. Call DatabaseHelper.initialize() first.');
        }
        try {
            console.log('🔍 Loading internal products from odoo_moombs_int_product_data...');
            let query = this.db
                .select('*') // Select all columns first to see what's available
                .from('odoo_moombs_int_product_data');
            // Apply basic filters
            if (filters?.hasGtin) {
                query = query.whereNotNull('gtin').where('gtin', '!=', '');
            }
            // Apply pagination for large dataset (8000 products)
            if (limit) {
                query = query.limit(limit);
            }
            if (offset) {
                query = query.offset(offset);
            }
            const results = await query;
            console.log(`✅ Found ${results.length} internal products`);
            if (results.length > 0) {
                console.log('📋 Sample internal product columns:', Object.keys(results[0]));
            }
            return results.map(row => ({
                id: row.id,
                title: row.product_name,
                brand: row.brand,
                moombs_brand: row.brand, // Use same brand field
                category_id: row.category,
                moombs_category: row.category, // Use same category field
                price: parseFloat(row.price || 0),
                gtin: row.ean,
                description: row.product_name // Use product_name as description fallback
            }));
        }
        catch (error) {
            console.error('❌ Error loading internal products:', error);
            throw error;
        }
    }
    /**
     * Load external products from nc_external_products table
     */
    static async loadExternalProducts(limit, offset, filters) {
        if (!this.db) {
            throw new Error('Database not initialized. Call DatabaseHelper.initialize() first.');
        }
        try {
            console.log('🔍 Loading external products from nc_external_products...');
            let query = this.db
                .select('*') // Select all columns first to see what's available
                .from('nc_external_products');
            // Apply basic filters
            if (filters?.hasGtin) {
                query = query.whereNotNull('gtin').where('gtin', '!=', '');
            }
            // Apply pagination for large dataset (4000 products)
            if (limit) {
                query = query.limit(limit);
            }
            if (offset) {
                query = query.offset(offset);
            }
            const results = await query;
            console.log(`✅ Found ${results.length} external products`);
            if (results.length > 0) {
                console.log('📋 Sample external product columns:', Object.keys(results[0]));
            }
            return results.map(row => ({
                external_product_key: row.external_product_key,
                title: row.product_name,
                brand: row.brand,
                category_id: row.product_category,
                price: parseFloat(row.price || 0),
                gtin: row.ean,
                image_url: row.image,
                discount: row.discount,
                offer_price: parseFloat(row.offer_price || 0) || undefined,
                product_type: row.product_type,
                short_description: row.short_description,
                long_description: row.long_description,
                color_options: row.color_options,
                size_options: row.size_options,
                color: row.color,
                measurements: row.measurements,
                specifications: row.specifications,
                dimensions: row.dimensions,
                sku: row.sku,
                url: row.url
            }));
        }
        catch (error) {
            console.error('❌ Error loading external products:', error);
            throw error;
        }
    }
    /**
     * Get database statistics for actual tables
     */
    static async getStatistics() {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        try {
            console.log('📊 Getting database statistics...');
            const [internalCount, externalCount, internalGtinCount, externalGtinCount] = await Promise.all([
                this.db('odoo_moombs_int_product_data').count('* as count').first(),
                this.db('nc_external_products').count('* as count').first(),
                this.db('odoo_moombs_int_product_data').whereNotNull('gtin').where('gtin', '!=', '').count('* as count').first().catch(() => ({ count: 0 })),
                this.db('nc_external_products').whereNotNull('gtin').where('gtin', '!=', '').count('* as count').first().catch(() => ({ count: 0 }))
            ]);
            return {
                internalProductCount: parseInt(internalCount?.count) || 0,
                externalProductCount: parseInt(externalCount?.count) || 0,
                gtinCoverage: {
                    internal: parseInt(internalGtinCount?.count) || 0,
                    external: parseInt(externalGtinCount?.count) || 0
                }
            };
        }
        catch (error) {
            console.error('❌ Error getting database statistics:', error);
            throw error;
        }
    }
    /**
     * Close database connection
     */
    static async close() {
        if (this.db) {
            await this.db.destroy();
            this.db = null;
            console.log('✅ Database connection closed');
        }
    }
}
exports.DatabaseHelper = DatabaseHelper;
DatabaseHelper.db = null;
//# sourceMappingURL=database-helper.js.map