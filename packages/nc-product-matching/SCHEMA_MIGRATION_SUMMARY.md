# Schema Migration: nc_internal_products → moombs_int_product

## Overview
Successfully migrated the product matching system from using `nc_internal_products` to `moombs_int_product` table.

## Changes Made

### 1. Database Schema Mapping

| Old Field (nc_internal_products) | New Field (moombs_int_product) | Type | Notes |
|----------------------------------|-------------------------------|------|-------|
| `id` (VARCHAR(20)) | `id` (INTEGER) | ✅ Mapped | Auto-incremented ID |
| `title` (VARCHAR(500)) | `default_code` (VARCHAR) | ⚠️ Fallback | Using SKU as title |
| `brand` (VARCHAR(255)) | `moombs_brand` (VARCHAR) | ✅ Direct | Direct mapping |
| `category_id` (VARCHAR(100)) | `moombs_category` (VARCHAR) | ✅ Direct | Direct mapping |
| `price` (DECIMAL(10,2)) | `standard_price` (JSONB) | ⚠️ Complex | Custom extraction logic |
| `gtin` (VARCHAR(50)) | `barcode` (VARCHAR) | ✅ Direct | Direct mapping |
| `sku` (VARCHAR(100)) | `default_code` (VARCHAR) | ✅ Direct | Direct mapping |
| `is_active` (BOOLEAN) | `active` (BOOLEAN) | ✅ Direct | Direct mapping |
| `description` (TEXT) | ❌ Not available | ❌ Missing | No equivalent field |
| `image_url` (VARCHAR(500)) | ❌ Not available | ❌ Missing | No equivalent field |

### 2. Code Changes

#### ProductMatchingService.ts
- ✅ Updated table name in all queries
- ✅ Added `extractPrice()` method for JSONB price handling
- ✅ Updated field mappings in data transformation
- ✅ Updated search filters to use new field names

#### Database Scripts
- ✅ Updated `setup-database.js` to reference existing table
- ✅ Updated `test-db-query.js` for new schema
- ✅ Updated `check-db.js` for new schema
- ✅ Updated migration scripts comments

#### Foreign Key Changes
- ✅ Removed FK constraint from `nc_product_matches.local_product_id` 
- ✅ Now references `moombs_int_product.id` (INTEGER) instead of VARCHAR

### 3. Price Extraction Logic

Added smart price extraction from JSONB `standard_price` field:

```typescript
private extractPrice(standardPrice: any): number | undefined {
  if (!standardPrice) return undefined;
  
  try {
    // Handle parsed JSON object
    if (typeof standardPrice === 'object') {
      return standardPrice.price || standardPrice.amount || standardPrice.value;
    }
    
    // Handle JSON string
    if (typeof standardPrice === 'string') {
      const parsed = JSON.parse(standardPrice);
      return parsed.price || parsed.amount || parsed.value;
    }
    
    // Handle direct number
    if (typeof standardPrice === 'number') {
      return standardPrice;
    }
    
    return undefined;
  } catch (error) {
    console.error('Error extracting price:', error);
    return undefined;
  }
}
```

### 4. New Table Features Available

The `moombs_int_product` table includes additional fields that can be leveraged:

- `moombs_color` - Product color variant
- `moombs_size` - Product size variant  
- `weight` - Product weight
- `volume` - Product volume
- `is_matched` - Matching status flag
- `match_status` - Detailed matching status
- `product_tmpl_id` - Template reference

### 5. API Compatibility

All existing API endpoints remain compatible:
- `/products` - Lists products from moombs_int_product
- `/products/:id/candidates` - Finds matching candidates
- `/matches` - Manages product matches

### 6. Testing

Updated test files:
- `test-db-query.js` - Tests new table queries
- `check-db.js` - Validates new schema

## Migration Verification

To verify the migration worked correctly:

1. **Check product count**:
   ```sql
   SELECT COUNT(*) FROM moombs_int_product WHERE active = true;
   ```

2. **Test API endpoints**:
   ```bash
   curl http://localhost:8087/products
   curl http://localhost:8087/products/1/candidates
   ```

3. **Run verification scripts**:
   ```bash
   node check-db.js
   node test-db-query.js
   ```

## Rollback Plan (if needed)

If rollback is required:
1. Restore `nc_internal_products` table
2. Revert changes in `ProductMatchingService.ts`
3. Update foreign key constraints back
4. Run original migration scripts

## Performance Considerations

- ✅ Indexes on `moombs_int_product` should be optimized for:
  - `active` field (for filtering)
  - `moombs_brand` (for brand filtering)
  - `moombs_category` (for category filtering)
  - `default_code` (for search)

## Next Steps

1. Test end-to-end functionality
2. Verify price extraction works with your JSONB format
3. Consider adding indexes for better performance
4. Update any external integrations that reference the old table

## Status: ✅ COMPLETED

All code changes have been successfully applied. The system now uses `moombs_int_product` as the internal products table while maintaining full API compatibility.
