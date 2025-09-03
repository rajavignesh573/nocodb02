const { Client } = require('pg');
const dbConfig = require('./config.js').database;

async function testQuery() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('🔗 Connected to database');
    
    // Check what values exist in the database
    console.log('🔍 Checking database values...');
    
    // Check moombs_int_product table structure
    const tenantResult = await client.query('SELECT COUNT(*) FROM moombs_int_product WHERE active = true LIMIT 5');
    console.log('📋 Active products count:', tenantResult.rows);
    
    const activeResult = await client.query('SELECT DISTINCT active FROM moombs_int_product LIMIT 5');
    console.log('📋 Active values:', activeResult.rows);
    
    // Test moombs_int_product query
    const query = 'SELECT * FROM moombs_int_product WHERE active = $1 LIMIT $2 OFFSET $3';
    const values = [true, 5, 0];
    
    console.log('🔍 Testing query without is_active filter:', query);
    console.log('📋 Values:', values);
    
    const result = await client.query(query, values);
    console.log(`✅ Found ${result.rows.length} products`);
    
    if (result.rows.length > 0) {
      console.log('📋 First product:', result.rows[0]);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

testQuery().catch(console.error);
