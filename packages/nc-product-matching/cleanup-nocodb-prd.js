const { Client } = require('pg');
const config = require('./config');

// SENIOR DEV SOLUTION: Clean up nocodb_prd database
// Remove incorrect product data tables that should be in PIM

async function cleanupNocodbPrd() {
  const client = new Client(config.database);
  
  try {
    console.log('🔧 SENIOR DEV FIX: Cleaning up nocodb_prd database...');
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected to nocodb_prd database\n');

    // List of tables to remove (wrong architecture)
    const tablesToRemove = [
      // External product data (should be in PIM)
      'nc_external_products',
      
      // Internal product data (duplicated - use PIM instead)
      'moombs_int_product_01',
      'odoo_moombs_int_product_data',
      
      // Backup/unnecessary tables
      'moombs_int_product_backup_migration', 
      'nc_internal_products_backup_01',
      'nc_media_assets_01',
      'nc_media_links_01'
    ];

    // Tables to keep (core matching functionality)
    const tablesToKeep = [
      'nc_product_matches',
      'nc_product_match_sources_01',
      'nc_product_match_rules', 
      'nc_product_match_sessions_01',
      'nc_product_match_brand_synonyms_01',
      'nc_product_match_category_map_01'
    ];

    console.log('📊 Current table status:');
    for (const table of tablesToRemove) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`   ❌ ${table}: ${result.rows[0].count} rows (TO BE REMOVED)`);
      } catch (error) {
        console.log(`   ⚠️  ${table}: Not found (already removed)`);
      }
    }

    console.log('\n📋 Tables to keep:');
    for (const table of tablesToKeep) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`   ✅ ${table}: ${result.rows[0].count} rows (KEEPING)`);
      } catch (error) {
        console.log(`   ⚠️  ${table}: Not found`);
      }
    }

    // Ask for confirmation
    console.log('\n🚨 WARNING: This will permanently delete the above tables!');
    console.log('💡 Make sure you have backups if needed.');
    console.log('\n🎯 ARCHITECTURAL FIX:');
    console.log('   - nocodb_prd will only handle MATCHING LOGIC');
    console.log('   - PIM database will handle ALL PRODUCT DATA');
    
    // Uncomment the following lines after reviewing the plan:
    /*
    console.log('\n🗑️  Starting cleanup...');
    
    for (const table of tablesToRemove) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`   ✅ Removed ${table}`);
      } catch (error) {
        console.log(`   ⚠️  Could not remove ${table}: ${error.message}`);
      }
    }
    */

    console.log('\n🎉 CLEANUP PLAN READY!');
    console.log('📝 Next steps:');
    console.log('   1. Review the tables to be removed above');
    console.log('   2. Uncomment the cleanup code in this script');
    console.log('   3. Run this script again to execute cleanup');
    console.log('   4. Update ProductMatchingService to use PIM database');
    console.log('   5. Test the new architecture');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await client.end();
  }
}

// Run the cleanup analysis
cleanupNocodbPrd().catch(console.error);
