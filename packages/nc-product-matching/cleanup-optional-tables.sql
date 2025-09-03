-- ============================================================================
-- CLEANUP SCRIPT: Remove Optional Product Matching Tables
-- ============================================================================
-- This script removes the optional tables while keeping the 4 essential ones:
-- ✅ KEEP: odoo_moombs_int_product_data (internal products)
-- ✅ KEEP: nc_external_products (external products)  
-- ✅ KEEP: nc_product_match_sources (sources)
-- ✅ KEEP: nc_product_matches (confirmed matches)
-- ============================================================================

-- Remove foreign key constraints first (if they exist)
-- This prevents constraint violation errors when dropping tables

-- Drop foreign key constraints from nc_product_matches table
ALTER TABLE nc_product_matches DROP CONSTRAINT IF EXISTS nc_product_matches_rule_id_fkey;
ALTER TABLE nc_product_matches DROP CONSTRAINT IF EXISTS nc_product_matches_session_id_fkey;

-- Drop the optional tables
-- ============================================================================

-- 1. Drop Brand Synonyms table
DROP TABLE IF EXISTS nc_product_match_brand_synonyms CASCADE;
COMMENT ON SCHEMA public IS 'Removed nc_product_match_brand_synonyms - brand matching will use exact matching only';

-- 2. Drop Category Mapping table  
DROP TABLE IF EXISTS nc_product_match_category_map CASCADE;
COMMENT ON SCHEMA public IS 'Removed nc_product_match_category_map - category matching will use direct comparison';

-- 3. Drop Rules table
DROP TABLE IF EXISTS nc_product_match_rules CASCADE;
COMMENT ON SCHEMA public IS 'Removed nc_product_match_rules - system will use hardcoded default rules';

-- 4. Drop Sessions table
DROP TABLE IF EXISTS nc_product_match_sessions CASCADE;
COMMENT ON SCHEMA public IS 'Removed nc_product_match_sessions - matching will be ad-hoc without session tracking';

-- Clean up the nc_product_matches table columns that reference deleted tables
-- ============================================================================

-- Remove rule_id column (references deleted nc_product_match_rules)
ALTER TABLE nc_product_matches DROP COLUMN IF EXISTS rule_id;

-- Remove session_id column (references deleted nc_product_match_sessions)  
ALTER TABLE nc_product_matches DROP COLUMN IF EXISTS session_id;

-- Verify remaining tables
-- ============================================================================
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('odoo_moombs_int_product_data', 'nc_external_products', 'nc_product_match_sources', 'nc_product_matches') 
        THEN '✅ ESSENTIAL'
        ELSE '❌ SHOULD BE DELETED'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name LIKE '%product%'
    AND table_type = 'BASE TABLE'
ORDER BY status DESC, table_name;

-- Summary
-- ============================================================================
COMMENT ON SCHEMA public IS 'Product Matching Cleanup Complete - Kept 4 essential tables only';

SELECT 'Cleanup completed! Kept only essential tables: odoo_moombs_int_product_data, nc_external_products, nc_product_match_sources, nc_product_matches' as summary;
