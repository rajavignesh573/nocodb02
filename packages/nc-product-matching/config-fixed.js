// UPDATED Database configuration - All data now in PIM database
module.exports = {
  // Main database - PIM contains all data now (matching + products)
  database: {
    host: 'localhost',
    port: 5432,
    database: 'pim',  // Changed from nocodb_prd to pim
    user: 'devuser',
    password: 'VerifyTen102025',
  },
  
  // Legacy PIM database config (now same as main database)
  pimDatabase: {
    host: 'localhost',
    port: 5432,
    database: 'pim',
    user: 'devuser',
    password: 'VerifyTen102025',
    schema: 'public'  // Changed from prd_enrichment to public
  },
  
  server: {
    port: process.env.PORT || 8087,
  },
  
  // Database mapping configuration - All tables now in PIM
  mapping: {
    // Internal products from PIM
    internalProducts: {
      database: 'pim',
      schema: 'public',  // Changed from prd_enrichment to public
      table: 'products',
      fields: {
        id: 'product_id',
        title: 'title',
        brand: 'brand',
        category: 'category_id',
        description: 'description',
        // Price needs custom extraction from meta field
        status: 'status'
      }
    },
    
    // External products from PIM - UPDATED for new schema
    externalProducts: {
      database: 'pim',
      schema: 'public',  // Changed from prd_enrichment to public
      table: 'nc_external_products',  // Updated table name
              condition: '', // No filtering - all external products considered
      fields: {
        id: 'id',
        external_product_key: 'external_product_key',
        title: 'product_name',              // NEW: product_name (was title)
        brand: 'brand',
        category: 'product_category',       // NEW: product_category (was category_id)
        source_id: 'source_id',
        gtin: 'ean',                        // NEW: ean (was gtin)
        image_url: 'image',                 // NEW: image (was image_url)
        product_url: 'url',                 // NEW: url (was product_url)
        description: 'long_description',    // NEW: long_description (was description)
        // NEW: Additional enhanced fields
        product_type: 'product_type',
        short_description: 'short_description',
        discount: 'discount',
        offer_price: 'offer_price',
        color_options: 'color_options',
        size_options: 'size_options',
        color: 'color',
        measurements: 'measurements',
        specifications: 'specifications',
        dimensions: 'dimensions',
        sku: 'sku'
      }
    },
    
    // Matching data now also in PIM (migrated from nocodb_prd)
    matching: {
      database: 'pim',  // Changed from nocodb_prd to pim
      schema: 'public',
      tables: {
        matches: 'nc_product_matches',
        sources: 'nc_product_match_sources_01',
        rules: 'nc_product_match_rules',
        sessions: 'nc_product_match_sessions_01',
        brandSynonyms: 'nc_product_match_brand_synonyms_01',
        categoryMap: 'nc_product_match_category_map_01'
      }
    }
  }
};
