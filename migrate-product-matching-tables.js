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

// Tables to migrate
const tablesToMigrate = [
  'nc_product_match_brand_synonyms_01',
  'nc_product_match_category_map_01',
  'nc_product_match_rules',
  'nc_product_match_sessions_01',
  'nc_product_match_sources_01',
  'nc_product_matches'
];

async function createTargetSchema(targetClient) {
  console.log('🏗️ Creating target schema...');
  try {
    await targetClient.query('CREATE SCHEMA IF NOT EXISTS prd_enrichment');
    console.log('✅ Schema prd_enrichment created/verified');
  } catch (error) {
    console.error('❌ Error creating schema:', error.message);
    throw error;
  }
}

async function getTableStructure(sourceClient, tableName) {
  console.log(`📋 Getting structure for table: ${tableName}`);
  
  const query = `
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
  
  const result = await sourceClient.query(query, [tableName]);
  return result.rows;
}

async function getPrimaryKeys(sourceClient, tableName) {
  const query = `
    SELECT a.attname
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass AND i.indisprimary
  `;
  
  const result = await sourceClient.query(query, [tableName]);
  return result.rows.map(row => row.attname);
}

async function getForeignKeys(sourceClient, tableName) {
  const query = `
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = $1
    AND tc.table_schema = 'public'
  `;
  
  const result = await sourceClient.query(query, [tableName]);
  return result.rows;
}

function buildColumnDefinition(column) {
  let def = `${column.column_name} ${column.data_type.toUpperCase()}`;
  
  // Handle character types
  if (column.character_maximum_length) {
    def += `(${column.character_maximum_length})`;
  }
  
  // Handle numeric types
  if (column.numeric_precision && column.data_type === 'numeric') {
    if (column.numeric_scale) {
      def += `(${column.numeric_precision},${column.numeric_scale})`;
    } else {
      def += `(${column.numeric_precision})`;
    }
  }
  
  // Handle nullability
  if (column.is_nullable === 'NO') {
    def += ' NOT NULL';
  }
  
  // Handle defaults
  if (column.column_default) {
    def += ` DEFAULT ${column.column_default}`;
  }
  
  return def;
}

async function createTable(targetClient, tableName, structure, primaryKeys, foreignKeys) {
  console.log(`🔨 Creating table: prd_enrichment.${tableName}`);
  
  const columnDefs = structure.map(buildColumnDefinition);
  
  // Add primary key constraint
  if (primaryKeys.length > 0) {
    columnDefs.push(`PRIMARY KEY (${primaryKeys.join(', ')})`);
  }
  
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS prd_enrichment.${tableName} (
      ${columnDefs.join(',\n      ')}
    )
  `;
  
  await targetClient.query(createTableQuery);
  console.log(`✅ Table prd_enrichment.${tableName} created`);
}

async function copyTableData(sourceClient, targetClient, tableName) {
  console.log(`📊 Copying data from ${tableName}...`);
  
  // Get column names
  const structure = await getTableStructure(sourceClient, tableName);
  const columns = structure.map(col => col.column_name);
  
  // Check if source table has data
  const countResult = await sourceClient.query(`SELECT COUNT(*) FROM ${tableName}`);
  const rowCount = parseInt(countResult.rows[0].count);
  
  if (rowCount === 0) {
    console.log(`ℹ️ Table ${tableName} is empty, skipping data copy`);
    return;
  }
  
  console.log(`📈 Found ${rowCount} rows to copy`);
  
  // Clear existing data in target table
  await targetClient.query(`DELETE FROM prd_enrichment.${tableName}`);
  
  // Copy data in batches
  const batchSize = 1000;
  let offset = 0;
  
  while (offset < rowCount) {
    const selectQuery = `
      SELECT ${columns.join(', ')} 
      FROM ${tableName} 
      ORDER BY ${columns[0]}
      LIMIT ${batchSize} OFFSET ${offset}
    `;
    
    const sourceData = await sourceClient.query(selectQuery);
    
    if (sourceData.rows.length > 0) {
      // Build insert query with placeholders
      const placeholders = sourceData.rows.map((_, rowIndex) => {
        const rowPlaceholders = columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`);
        return `(${rowPlaceholders.join(', ')})`;
      }).join(', ');
      
      const insertQuery = `
        INSERT INTO prd_enrichment.${tableName} (${columns.join(', ')})
        VALUES ${placeholders}
        ON CONFLICT DO NOTHING
      `;
      
      // Flatten the data for parameterized query
      const flatData = sourceData.rows.reduce((acc, row) => {
        columns.forEach(col => acc.push(row[col]));
        return acc;
      }, []);
      
      await targetClient.query(insertQuery, flatData);
      
      offset += batchSize;
      console.log(`   📋 Copied ${Math.min(offset, rowCount)}/${rowCount} rows`);
    } else {
      break;
    }
  }
  
  // Verify final count
  const finalCountResult = await targetClient.query(`SELECT COUNT(*) FROM prd_enrichment.${tableName}`);
  const finalCount = parseInt(finalCountResult.rows[0].count);
  
  console.log(`✅ Successfully copied ${finalCount} rows to prd_enrichment.${tableName}`);
}

async function addForeignKeyConstraints(targetClient, tableName, foreignKeys) {
  if (foreignKeys.length === 0) return;
  
  console.log(`🔗 Adding foreign key constraints for ${tableName}...`);
  
  for (const fk of foreignKeys) {
    try {
      const constraintQuery = `
        ALTER TABLE prd_enrichment.${tableName}
        ADD CONSTRAINT ${fk.constraint_name}
        FOREIGN KEY (${fk.column_name})
        REFERENCES prd_enrichment.${fk.foreign_table_name}(${fk.foreign_column_name})
      `;
      
      await targetClient.query(constraintQuery);
      console.log(`✅ Added FK constraint: ${fk.constraint_name}`);
    } catch (error) {
      console.warn(`⚠️ Could not add FK constraint ${fk.constraint_name}: ${error.message}`);
    }
  }
}

async function createIndexes(targetClient, tableName) {
  console.log(`📊 Creating indexes for ${tableName}...`);
  
  // Create common indexes based on table patterns
  const indexQueries = [];
  
  switch (tableName) {
    case 'nc_product_matches':
      indexQueries.push(
        `CREATE INDEX IF NOT EXISTS idx_${tableName}_tenant_local ON prd_enrichment.${tableName}(tenant_id, local_product_id)`,
        `CREATE INDEX IF NOT EXISTS idx_${tableName}_tenant_external ON prd_enrichment.${tableName}(tenant_id, external_product_key, source_id)`,
        `CREATE INDEX IF NOT EXISTS idx_${tableName}_score ON prd_enrichment.${tableName}(score DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON prd_enrichment.${tableName}(status)`
      );
      break;
      
    case 'nc_product_match_brand_synonyms_01':
      indexQueries.push(
        `CREATE INDEX IF NOT EXISTS idx_${tableName}_canonical ON prd_enrichment.${tableName}(brand_canonical)`,
        `CREATE INDEX IF NOT EXISTS idx_${tableName}_variant ON prd_enrichment.${tableName}(brand_variant)`
      );
      break;
      
    case 'nc_product_match_sources_01':
      indexQueries.push(
        `CREATE INDEX IF NOT EXISTS idx_${tableName}_code ON prd_enrichment.${tableName}(code)`,
        `CREATE INDEX IF NOT EXISTS idx_${tableName}_active ON prd_enrichment.${tableName}(is_active)`
      );
      break;
      
    case 'nc_product_match_sessions_01':
      indexQueries.push(
        `CREATE INDEX IF NOT EXISTS idx_${tableName}_tenant ON prd_enrichment.${tableName}(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_${tableName}_created ON prd_enrichment.${tableName}(created_at)`
      );
      break;
      
    case 'nc_product_match_rules':
      indexQueries.push(
        `CREATE INDEX IF NOT EXISTS idx_${tableName}_tenant ON prd_enrichment.${tableName}(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_${tableName}_default ON prd_enrichment.${tableName}(is_default)`
      );
      break;
      
    case 'nc_product_match_category_map_01':
      indexQueries.push(
        `CREATE INDEX IF NOT EXISTS idx_${tableName}_tenant ON prd_enrichment.${tableName}(tenant_id)`
      );
      break;
  }
  
  for (const query of indexQueries) {
    try {
      await targetClient.query(query);
      console.log(`✅ Created index`);
    } catch (error) {
      console.warn(`⚠️ Could not create index: ${error.message}`);
    }
  }
}

async function migrateProductMatchingTables() {
  let sourceClient, targetClient;
  
  try {
    console.log('🚀 Starting Product Matching Tables Migration');
    console.log('================================================');
    
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
    
    // Create target schema
    await createTargetSchema(targetClient);
    
    // First pass: Create all tables without foreign key constraints
    console.log('\n📋 Phase 1: Creating table structures...');
    console.log('==========================================');
    
    const tableStructures = {};
    const tablePrimaryKeys = {};
    const tableForeignKeys = {};
    
    for (const tableName of tablesToMigrate) {
      try {
        // Check if source table exists
        const tableExistsResult = await sourceClient.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `, [tableName]);
        
        if (!tableExistsResult.rows[0].exists) {
          console.log(`⚠️ Source table ${tableName} does not exist, skipping...`);
          continue;
        }
        
        const structure = await getTableStructure(sourceClient, tableName);
        const primaryKeys = await getPrimaryKeys(sourceClient, tableName);
        const foreignKeys = await getForeignKeys(sourceClient, tableName);
        
        tableStructures[tableName] = structure;
        tablePrimaryKeys[tableName] = primaryKeys;
        tableForeignKeys[tableName] = foreignKeys;
        
        // Create table without foreign keys first
        await createTable(targetClient, tableName, structure, primaryKeys, []);
        
      } catch (error) {
        console.error(`❌ Error processing table ${tableName}:`, error.message);
        continue;
      }
    }
    
    // Second pass: Copy data
    console.log('\n📊 Phase 2: Copying table data...');
    console.log('===================================');
    
    for (const tableName of tablesToMigrate) {
      if (tableStructures[tableName]) {
        try {
          await copyTableData(sourceClient, targetClient, tableName);
        } catch (error) {
          console.error(`❌ Error copying data for ${tableName}:`, error.message);
          continue;
        }
      }
    }
    
    // Third pass: Add foreign key constraints
    console.log('\n🔗 Phase 3: Adding foreign key constraints...');
    console.log('==============================================');
    
    for (const tableName of tablesToMigrate) {
      if (tableForeignKeys[tableName]) {
        try {
          await addForeignKeyConstraints(targetClient, tableName, tableForeignKeys[tableName]);
        } catch (error) {
          console.error(`❌ Error adding foreign keys for ${tableName}:`, error.message);
          continue;
        }
      }
    }
    
    // Fourth pass: Create indexes
    console.log('\n📊 Phase 4: Creating indexes...');
    console.log('================================');
    
    for (const tableName of tablesToMigrate) {
      if (tableStructures[tableName]) {
        try {
          await createIndexes(targetClient, tableName);
        } catch (error) {
          console.error(`❌ Error creating indexes for ${tableName}:`, error.message);
          continue;
        }
      }
    }
    
    // Final verification
    console.log('\n🔍 Phase 5: Verification...');
    console.log('============================');
    
    for (const tableName of tablesToMigrate) {
      if (tableStructures[tableName]) {
        try {
          const sourceCountResult = await sourceClient.query(`SELECT COUNT(*) FROM ${tableName}`);
          const targetCountResult = await targetClient.query(`SELECT COUNT(*) FROM prd_enrichment.${tableName}`);
          
          const sourceCount = parseInt(sourceCountResult.rows[0].count);
          const targetCount = parseInt(targetCountResult.rows[0].count);
          
          if (sourceCount === targetCount) {
            console.log(`✅ ${tableName}: ${targetCount} rows migrated successfully`);
          } else {
            console.log(`⚠️ ${tableName}: Source has ${sourceCount} rows, target has ${targetCount} rows`);
          }
        } catch (error) {
          console.error(`❌ Error verifying ${tableName}:`, error.message);
        }
      }
    }
    
    console.log('\n🎉 Migration completed!');
    console.log('=======================');
    console.log('📍 Target location: pim.prd_enrichment');
    console.log('📋 Tables migrated:', Object.keys(tableStructures).join(', '));
    
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
  migrateProductMatchingTables().catch(error => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });
}

module.exports = { migrateProductMatchingTables };
