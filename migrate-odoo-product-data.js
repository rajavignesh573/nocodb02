const { Client } = require('pg');

// Database configurations
const sourceDbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'nocodb_prd',
  user: 'devuser',
  password: 'VerifyTen102025',
};

const targetDbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'pim',
  user: 'devuser',
  password: 'VerifyTen102025',
};

const tableName = 'odoo_moombs_int_product_data';

async function migrateOdooProductData() {
  let sourceClient, targetClient;
  
  try {
    console.log('🚀 Starting Odoo Product Data Migration');
    console.log('=====================================');
    console.log(`📋 Table: ${tableName}`);
    console.log(`📤 Source: nocodb_prd.public.${tableName}`);
    console.log(`📥 Target: pim.public.${tableName}`);
    console.log('');
    
    // Connect to source database
    console.log('🔌 Connecting to source database (nocodb_prd)...');
    sourceClient = new Client(sourceDbConfig);
    await sourceClient.connect();
    console.log('✅ Connected to source database');
    
    // Connect to target database
    console.log('🔌 Connecting to target database (pim)...');
    targetClient = new Client(targetDbConfig);
    await targetClient.connect();
    console.log('✅ Connected to target database');
    
    // Get table structure from source
    console.log('\n📋 Phase 1: Analyzing table structure...');
    console.log('==========================================');
    
    const structureQuery = `
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    const structureResult = await sourceClient.query(structureQuery, [tableName]);
    const columns = structureResult.rows;
    
    console.log(`📊 Found ${columns.length} columns:`);
    columns.forEach(col => {
      let type = col.data_type.toUpperCase();
      if (col.character_maximum_length) {
        type += `(${col.character_maximum_length})`;
      } else if (col.numeric_precision && col.data_type === 'numeric') {
        if (col.numeric_scale) {
          type += `(${col.numeric_precision},${col.numeric_scale})`;
        } else {
          type += `(${col.numeric_precision})`;
        }
      }
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`   ${col.column_name}: ${type} ${nullable}${defaultVal}`);
    });
    
    // Get row count
    const countResult = await sourceClient.query(`SELECT COUNT(*) FROM ${tableName}`);
    const totalRows = parseInt(countResult.rows[0].count);
    console.log(`📈 Total rows to migrate: ${totalRows}`);
    
    // Create table in target database
    console.log('\n🔨 Phase 2: Creating table in target database...');
    console.log('==================================================');
    
    // Build CREATE TABLE statement
    const columnDefs = columns.map(col => {
      let def = `${col.column_name} `;
      
      // Data type
      if (col.data_type === 'character varying' && col.character_maximum_length) {
        def += `VARCHAR(${col.character_maximum_length})`;
      } else if (col.data_type === 'numeric' && col.numeric_precision) {
        if (col.numeric_scale) {
          def += `NUMERIC(${col.numeric_precision},${col.numeric_scale})`;
        } else {
          def += `NUMERIC(${col.numeric_precision})`;
        }
      } else if (col.data_type === 'timestamp without time zone') {
        def += 'TIMESTAMP';
      } else if (col.data_type === 'text') {
        def += 'TEXT';
      } else if (col.data_type === 'integer') {
        def += 'INTEGER';
      } else {
        def += col.data_type.toUpperCase();
      }
      
      // Nullable
      if (col.is_nullable === 'NO') {
        def += ' NOT NULL';
      }
      
      // Default value
      if (col.column_default) {
        if (col.column_default.includes('nextval')) {
          // Handle sequence for auto-increment
          def += ` DEFAULT nextval('${tableName}_id_seq'::regclass)`;
        } else {
          def += ` DEFAULT ${col.column_default}`;
        }
      }
      
      return def;
    });
    
    // Drop table if exists
    await targetClient.query(`DROP TABLE IF EXISTS public.${tableName} CASCADE`);
    console.log(`🗑️ Dropped existing table if it existed`);
    
    // Create sequence for id column
    await targetClient.query(`CREATE SEQUENCE IF NOT EXISTS ${tableName}_id_seq`);
    console.log(`📊 Created sequence: ${tableName}_id_seq`);
    
    // Create table
    const createTableQuery = `
      CREATE TABLE public.${tableName} (
        ${columnDefs.join(',\n        ')}
      )
    `;
    
    await targetClient.query(createTableQuery);
    console.log(`✅ Created table: public.${tableName}`);
    
    // Add primary key constraint
    await targetClient.query(`ALTER TABLE public.${tableName} ADD CONSTRAINT ${tableName}_pkey PRIMARY KEY (id)`);
    console.log(`🔑 Added primary key constraint`);
    
    // Copy data
    console.log('\n📊 Phase 3: Copying data...');
    console.log('============================');
    
    if (totalRows === 0) {
      console.log('ℹ️ No data to copy');
    } else {
      const columnNames = columns.map(col => col.column_name);
      const batchSize = 1000;
      let copiedRows = 0;
      
      // Copy data in batches
      for (let offset = 0; offset < totalRows; offset += batchSize) {
        const selectQuery = `
          SELECT ${columnNames.join(', ')} 
          FROM ${tableName} 
          ORDER BY id
          LIMIT ${batchSize} OFFSET ${offset}
        `;
        
        const sourceData = await sourceClient.query(selectQuery);
        
        if (sourceData.rows.length > 0) {
          // Build insert query with placeholders
          const placeholders = sourceData.rows.map((_, rowIndex) => {
            const rowPlaceholders = columnNames.map((_, colIndex) => `$${rowIndex * columnNames.length + colIndex + 1}`);
            return `(${rowPlaceholders.join(', ')})`;
          }).join(', ');
          
          const insertQuery = `
            INSERT INTO public.${tableName} (${columnNames.join(', ')})
            VALUES ${placeholders}
          `;
          
          // Flatten the data for parameterized query
          const flatData = sourceData.rows.reduce((acc, row) => {
            columnNames.forEach(col => acc.push(row[col]));
            return acc;
          }, []);
          
          await targetClient.query(insertQuery, flatData);
          
          copiedRows += sourceData.rows.length;
          console.log(`   📋 Copied ${copiedRows}/${totalRows} rows`);
        }
      }
      
      console.log(`✅ Successfully copied ${copiedRows} rows`);
      
      // Update sequence to current max value
      const maxIdResult = await targetClient.query(`SELECT COALESCE(MAX(id), 0) + 1 as next_val FROM public.${tableName}`);
      const nextVal = maxIdResult.rows[0].next_val;
      await targetClient.query(`SELECT setval('${tableName}_id_seq', ${nextVal}, false)`);
      console.log(`📊 Updated sequence to start from ${nextVal}`);
    }
    
    // Create indexes
    console.log('\n📊 Phase 4: Creating indexes...');
    console.log('================================');
    
    // Create useful indexes
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_brand ON public.${tableName}(brand)`,
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_category ON public.${tableName}(category)`,
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_product_code ON public.${tableName}(product_code)`,
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_ean ON public.${tableName}(ean)`,
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_source ON public.${tableName}(source)`,
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON public.${tableName}(created_at)`
    ];
    
    for (const indexQuery of indexes) {
      try {
        await targetClient.query(indexQuery);
        console.log(`✅ Created index`);
      } catch (error) {
        console.warn(`⚠️ Could not create index: ${error.message}`);
      }
    }
    
    // Final verification
    console.log('\n🔍 Phase 5: Verification...');
    console.log('============================');
    
    const finalCountResult = await targetClient.query(`SELECT COUNT(*) FROM public.${tableName}`);
    const finalCount = parseInt(finalCountResult.rows[0].count);
    
    console.log(`📊 Source rows: ${totalRows}`);
    console.log(`📊 Target rows: ${finalCount}`);
    
    if (totalRows === finalCount) {
      console.log(`✅ Migration successful! All ${finalCount} rows copied correctly.`);
    } else {
      console.log(`⚠️ Row count mismatch! Expected ${totalRows}, got ${finalCount}`);
    }
    
    // Show sample data
    const sampleResult = await targetClient.query(`SELECT id, product_name, brand, category, price FROM public.${tableName} LIMIT 5`);
    console.log('\n📋 Sample data in target table:');
    sampleResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ID:${row.id} - ${row.product_name} (${row.brand || 'No Brand'}) - ${row.category || 'No Category'} - $${row.price || 'No Price'}`);
    });
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('====================================');
    console.log(`📍 Table location: pim.public.${tableName}`);
    console.log(`📊 Total rows: ${finalCount}`);
    console.log(`🔗 Table ready for use in PIM database`);
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  } finally {
    if (sourceClient) {
      await sourceClient.end();
      console.log('🔌 Disconnected from source database');
    }
    if (targetClient) {
      await targetClient.end();
      console.log('🔌 Disconnected from target database');
    }
  }
}

// Run the migration
if (require.main === module) {
  migrateOdooProductData().catch(error => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });
}

module.exports = { migrateOdooProductData };
