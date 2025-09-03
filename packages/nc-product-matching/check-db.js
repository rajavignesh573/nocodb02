const { Client } = require('pg');
const dbConfig = require('./config.js').database;

async function checkDatabase() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('🔗 Connected to database');
    
    // Check external product count (using nc_external_products in PIM)
    const countResult = await client.query('SELECT COUNT(*) FROM nc_external_products');
    console.log(`📊 Total external products: ${countResult.rows[0].count}`);
    
    // Check availability distribution
    const availResult = await client.query('SELECT availability, COUNT(*) as count FROM nc_external_products GROUP BY availability');
    console.log('📈 Availability distribution:');
    availResult.rows.forEach(row => {
      console.log(`   ${row.availability ? 'Available' : 'Not Available'}: ${row.count} products`);
    });
    
    // Check sample external products
    const productsResult = await client.query('SELECT id, external_product_key, product_name, brand, product_category FROM nc_external_products LIMIT 5');
    console.log('📋 Sample external products:');
    productsResult.rows.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.product_name || product.external_product_key} (${product.brand || 'No Brand'}) - ${product.product_category || 'No Category'}`);
    });
    
    // Check sources (now in PIM database)
    const sourcesResult = await client.query('SELECT COUNT(*) FROM nc_product_match_sources');
    console.log(`🏪 Total sources: ${sourcesResult.rows[0].count}`);
    
    // Check external products (now in PIM database)
    const externalResult = await client.query('SELECT COUNT(*) FROM nc_external_products');
    console.log(`🌐 Total external products: ${externalResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await client.end();
  }
}

checkDatabase().catch(console.error);
