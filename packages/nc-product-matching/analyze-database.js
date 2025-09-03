const { Client } = require('pg');

// Database configuration - update with your actual credentials
const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'pim',  // Your database name
  user: 'devuser', // Your database user
  password: 'VerifyTen102025', // Your database password
};

async function analyzeDatabase() {
  const client = new Client(dbConfig);
  
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected to database\n');

    console.log('🔍 ANALYZING DATABASE STRUCTURE...\n');

    // 1. Check which product-related tables exist
    console.log('1️⃣ CHECKING PRODUCT-RELATED TABLES:');
    console.log('=' .repeat(50));
    
    const tablesResult = await client.query(`
      SELECT table_name, 
             table_type,
             CASE 
               WHEN table_name IN ('odoo_moombs_int_product_data', 'nc_external_products', 'nc_product_match_sources', 'nc_product_matches') 
               THEN '✅ ESSENTIAL'
               WHEN table_name LIKE '%product%' OR table_name LIKE '%match%'
               THEN '❌ SHOULD BE REMOVED'
               ELSE '⚪ OTHER'
             END as status
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE '%product%' OR table_name LIKE '%match%')
        AND table_type = 'BASE TABLE'
      ORDER BY status DESC, table_name;
    `);

    tablesResult.rows.forEach(row => {
      console.log(`   ${row.table_name.padEnd(35)} - ${row.status}`);
    });

    // 2. Check essential table structures
    console.log('\n2️⃣ CHECKING ESSENTIAL TABLE STRUCTURES:');
    console.log('=' .repeat(50));

    const essentialTables = [
      'odoo_moombs_int_product_data',
      'nc_external_products', 
      'nc_product_match_sources',
      'nc_product_matches'
    ];

    for (const tableName of essentialTables) {
      console.log(`\n📋 ${tableName.toUpperCase()}:`);
      
      try {
        // Check if table exists and get column info
        const columnsResult = await client.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = $1
          ORDER BY ordinal_position;
        `, [tableName]);

        if (columnsResult.rows.length === 0) {
          console.log(`   ❌ TABLE NOT FOUND`);
        } else {
          console.log(`   ✅ Table exists with ${columnsResult.rows.length} columns:`);
          columnsResult.rows.forEach(col => {
            const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
            console.log(`      - ${col.column_name.padEnd(25)} ${col.data_type.padEnd(15)} ${nullable}`);
          });
        }

        // Check row count
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${tableName};`);
        const count = parseInt(countResult.rows[0].count);
        console.log(`   📊 Row count: ${count} ${count === 0 ? '⚠️  (EMPTY - needs data)' : '✅'}`);

      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
      }
    }

    // 3. Check foreign key relationships
    console.log('\n3️⃣ CHECKING FOREIGN KEY RELATIONSHIPS:');
    console.log('=' .repeat(50));
    
    const fkResult = await client.query(`
      SELECT 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'public'
        AND (tc.table_name LIKE '%product%' OR tc.table_name LIKE '%match%')
      ORDER BY tc.table_name, kcu.column_name;
    `);

    if (fkResult.rows.length === 0) {
      console.log('   ℹ️  No foreign key constraints found');
    } else {
      fkResult.rows.forEach(fk => {
        console.log(`   ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
    }

    // 4. Check for any orphaned tables that should be removed
    console.log('\n4️⃣ CHECKING FOR ORPHANED TABLES:');
    console.log('=' .repeat(50));
    
    const orphanedTables = [
      'nc_product_match_brand_synonyms',
      'nc_product_match_category_map', 
      'nc_product_match_rules',
      'nc_product_match_sessions'
    ];

    let foundOrphaned = false;
    for (const tableName of orphanedTables) {
      try {
        const result = await client.query(`SELECT 1 FROM ${tableName} LIMIT 1;`);
        console.log(`   ❌ ${tableName} - SHOULD BE REMOVED`);
        foundOrphaned = true;
      } catch (error) {
        if (error.code === '42P01') { // Table does not exist
          console.log(`   ✅ ${tableName} - ALREADY REMOVED`);
        } else {
          console.log(`   ⚠️  ${tableName} - ERROR: ${error.message}`);
        }
      }
    }

    if (!foundOrphaned) {
      console.log('   ✅ All orphaned tables have been removed!');
    }

    // 5. Sample data check
    console.log('\n5️⃣ SAMPLE DATA CHECK:');
    console.log('=' .repeat(50));

    // Check internal products
    try {
      const internalSample = await client.query(`
        SELECT id, product_name, brand, category, price 
        FROM odoo_moombs_int_product_data 
        WHERE product_name IS NOT NULL 
        LIMIT 3;
      `);
      
      console.log('\n📦 INTERNAL PRODUCTS SAMPLE:');
      if (internalSample.rows.length === 0) {
        console.log('   ⚠️  No internal products found - you need to add data');
      } else {
        internalSample.rows.forEach((row, i) => {
          console.log(`   ${i+1}. ID: ${row.id} | Name: ${row.product_name} | Brand: ${row.brand || 'N/A'}`);
        });
      }
    } catch (error) {
      console.log('   ❌ Error checking internal products:', error.message);
    }

    // Check external products
    try {
      const externalSample = await client.query(`
        SELECT external_product_key, product_name, brand, source_id 
        FROM nc_external_products 
        LIMIT 3;
      `);
      
      console.log('\n🌐 EXTERNAL PRODUCTS SAMPLE:');
      if (externalSample.rows.length === 0) {
        console.log('   ⚠️  No external products found - you need to add data');
      } else {
        externalSample.rows.forEach((row, i) => {
          console.log(`   ${i+1}. Key: ${row.external_product_key} | Name: ${row.product_name} | Source: ${row.source_id}`);
        });
      }
    } catch (error) {
      console.log('   ❌ Error checking external products:', error.message);
    }

    // Check sources
    try {
      const sourcesSample = await client.query(`
        SELECT id, name, code, is_active 
        FROM nc_product_match_sources 
        ORDER BY name 
        LIMIT 5;
      `);
      
      console.log('\n🏪 DATA SOURCES:');
      if (sourcesSample.rows.length === 0) {
        console.log('   ⚠️  No data sources found - you need to add sources');
      } else {
        sourcesSample.rows.forEach((row, i) => {
          const status = row.is_active ? '✅ Active' : '❌ Inactive';
          console.log(`   ${i+1}. ${row.name} (${row.code}) - ${status}`);
        });
      }
    } catch (error) {
      console.log('   ❌ Error checking sources:', error.message);
    }

    // 6. Final assessment
    console.log('\n6️⃣ FINAL ASSESSMENT:');
    console.log('=' .repeat(50));

    const essentialTablesExist = essentialTables.length;
    let existingCount = 0;
    let tablesWithData = 0;

    for (const tableName of essentialTables) {
      try {
        await client.query(`SELECT 1 FROM ${tableName} LIMIT 1;`);
        existingCount++;
        
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${tableName};`);
        if (parseInt(countResult.rows[0].count) > 0) {
          tablesWithData++;
        }
      } catch (error) {
        // Table doesn't exist
      }
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Essential tables: ${existingCount}/${essentialTablesExist} ${existingCount === essentialTablesExist ? '✅' : '❌'}`);
    console.log(`   Tables with data: ${tablesWithData}/${essentialTablesExist} ${tablesWithData === essentialTablesExist ? '✅' : tablesWithData > 0 ? '⚠️' : '❌'}`);

    if (existingCount === essentialTablesExist && tablesWithData >= 3) {
      console.log(`\n🎉 DATABASE LOOKS GOOD!`);
      console.log(`   ✅ All essential tables exist`);
      console.log(`   ✅ Tables contain data`);
      console.log(`   ✅ Ready for product matching!`);
    } else if (existingCount === essentialTablesExist) {
      console.log(`\n⚠️  DATABASE STRUCTURE IS CORRECT BUT NEEDS DATA:`);
      console.log(`   ✅ All essential tables exist`);
      console.log(`   ❌ Some tables are empty - add data to use matching`);
    } else {
      console.log(`\n❌ DATABASE NEEDS ATTENTION:`);
      console.log(`   ❌ Missing essential tables`);
      console.log(`   🔧 Run the setup or migration scripts`);
    }

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the analysis
analyzeDatabase().catch(console.error);
