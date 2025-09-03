const { Client } = require('pg');

// Database configuration - update with your actual credentials
const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'pim',  // Your database name
  user: 'devuser', // Your database user
  password: 'VerifyTen102025', // Your database password
};

async function runCleanup() {
  const client = new Client(dbConfig);
  
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected to database\n');

    console.log('🗑️  Starting cleanup of optional tables...\n');

    // Remove foreign key constraints first
    console.log('1️⃣ Removing foreign key constraints...');
    try {
      await client.query('ALTER TABLE nc_product_matches DROP CONSTRAINT IF EXISTS nc_product_matches_rule_id_fkey;');
      await client.query('ALTER TABLE nc_product_matches DROP CONSTRAINT IF EXISTS nc_product_matches_session_id_fkey;');
      console.log('✅ Foreign key constraints removed');
    } catch (error) {
      console.log('ℹ️  No foreign key constraints to remove');
    }

    // Drop optional tables
    console.log('\n2️⃣ Dropping optional tables...');
    
    const tablesToDrop = [
      'nc_product_match_brand_synonyms',
      'nc_product_match_category_map', 
      'nc_product_match_rules',
      'nc_product_match_sessions'
    ];

    for (const table of tablesToDrop) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
        console.log(`✅ Dropped table: ${table}`);
      } catch (error) {
        console.log(`⚠️  Could not drop ${table}:`, error.message);
      }
    }

    // Remove columns from nc_product_matches
    console.log('\n3️⃣ Cleaning up nc_product_matches table...');
    try {
      await client.query('ALTER TABLE nc_product_matches DROP COLUMN IF EXISTS rule_id;');
      console.log('✅ Removed rule_id column');
    } catch (error) {
      console.log('ℹ️  rule_id column already removed or not found');
    }

    try {
      await client.query('ALTER TABLE nc_product_matches DROP COLUMN IF EXISTS session_id;');
      console.log('✅ Removed session_id column');
    } catch (error) {
      console.log('ℹ️  session_id column already removed or not found');
    }

    // Verify remaining tables
    console.log('\n4️⃣ Verifying remaining tables...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE '%product%'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('\n📋 Remaining product-related tables:');
    result.rows.forEach(row => {
      const status = [
        'odoo_moombs_int_product_data',
        'nc_external_products', 
        'nc_product_match_sources',
        'nc_product_matches'
      ].includes(row.table_name) ? '✅ ESSENTIAL' : '❌ UNEXPECTED';
      
      console.log(`   ${row.table_name} - ${status}`);
    });

    console.log('\n🎉 Cleanup completed successfully!');
    console.log('\n📊 Final setup:');
    console.log('   ✅ odoo_moombs_int_product_data (internal products)');
    console.log('   ✅ nc_external_products (external products)');
    console.log('   ✅ nc_product_match_sources (data sources)');
    console.log('   ✅ nc_product_matches (confirmed matches)');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the cleanup
runCleanup().catch(console.error);
