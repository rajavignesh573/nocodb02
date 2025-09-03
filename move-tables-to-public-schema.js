const { Client } = require('pg');

// Database configuration for PIM database
const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'pim',
  user: 'devuser',
  password: 'VerifyTen102025',
};

// Tables to move from prd_enrichment to public schema
const tablesToMove = [
  'nc_product_match_brand_synonyms_01',
  'nc_product_match_category_map_01',
  'nc_product_match_rules',
  'nc_product_match_sessions_01',
  'nc_product_match_sources_01',
  'nc_product_matches'
];

async function getTableStructure(client, tableName, schema = 'prd_enrichment') {
  console.log(`📋 Getting structure for ${schema}.${tableName}`);
  
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
    AND table_schema = $2
    ORDER BY ordinal_position
  `;
  
  const result = await client.query(query, [tableName, schema]);
  return result.rows;
}

async function getPrimaryKeys(client, tableName, schema = 'prd_enrichment') {
  const query = `
    SELECT a.attname
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass AND i.indisprimary
  `;
  
  const result = await client.query(query, [`${schema}.${tableName}`]);
  return result.rows.map(row => row.attname);
}

async function getForeignKeys(client, tableName, schema = 'prd_enrichment') {
  const query = `
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
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
    AND tc.table_schema = $2
  `;
  
  const result = await client.query(query, [tableName, schema]);
  return result.rows;
}

async function getIndexes(client, tableName, schema = 'prd_enrichment') {
  const query = `
    SELECT 
      i.relname AS index_name,
      a.attname AS column_name,
      ix.indisunique AS is_unique,
      ix.indisprimary AS is_primary
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE t.relname = $1
    AND n.nspname = $2
    AND NOT ix.indisprimary
    ORDER BY i.relname, a.attnum
  `;
  
  const result = await client.query(query, [tableName, schema]);
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

async function createTableInPublicSchema(client, tableName, structure, primaryKeys) {
  console.log(`🔨 Creating table: public.${tableName}`);
  
  const columnDefs = structure.map(buildColumnDefinition);
  
  // Add primary key constraint
  if (primaryKeys.length > 0) {
    columnDefs.push(`PRIMARY KEY (${primaryKeys.join(', ')})`);
  }
  
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS public.${tableName} (
      ${columnDefs.join(',\n      ')}
    )
  `;
  
  await client.query(createTableQuery);
  console.log(`✅ Table public.${tableName} created`);
}

async function copyTableData(client, tableName, fromSchema = 'prd_enrichment', toSchema = 'public') {
  console.log(`📊 Copying data from ${fromSchema}.${tableName} to ${toSchema}.${tableName}...`);
  
  // Get column names
  const structure = await getTableStructure(client, tableName, fromSchema);
  const columns = structure.map(col => col.column_name);
  
  // Check if source table has data
  const countResult = await client.query(`SELECT COUNT(*) FROM ${fromSchema}.${tableName}`);
  const rowCount = parseInt(countResult.rows[0].count);
  
  if (rowCount === 0) {
    console.log(`ℹ️ Table ${fromSchema}.${tableName} is empty, skipping data copy`);
    return;
  }
  
  console.log(`📈 Found ${rowCount} rows to copy`);
  
  // Clear existing data in target table
  await client.query(`DELETE FROM ${toSchema}.${tableName}`);
  
  // Copy data in batches
  const batchSize = 1000;
  let offset = 0;
  
  while (offset < rowCount) {
    const selectQuery = `
      SELECT ${columns.join(', ')} 
      FROM ${fromSchema}.${tableName} 
      ORDER BY ${columns[0]}
      LIMIT ${batchSize} OFFSET ${offset}
    `;
    
    const sourceData = await client.query(selectQuery);
    
    if (sourceData.rows.length > 0) {
      // Build insert query with placeholders
      const placeholders = sourceData.rows.map((_, rowIndex) => {
        const rowPlaceholders = columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`);
        return `(${rowPlaceholders.join(', ')})`;
      }).join(', ');
      
      const insertQuery = `
        INSERT INTO ${toSchema}.${tableName} (${columns.join(', ')})
        VALUES ${placeholders}
        ON CONFLICT DO NOTHING
      `;
      
      // Flatten the data for parameterized query
      const flatData = sourceData.rows.reduce((acc, row) => {
        columns.forEach(col => acc.push(row[col]));
        return acc;
      }, []);
      
      await client.query(insertQuery, flatData);
      
      offset += batchSize;
      console.log(`   📋 Copied ${Math.min(offset, rowCount)}/${rowCount} rows`);
    } else {
      break;
    }
  }
  
  // Verify final count
  const finalCountResult = await client.query(`SELECT COUNT(*) FROM ${toSchema}.${tableName}`);
  const finalCount = parseInt(finalCountResult.rows[0].count);
  
  console.log(`✅ Successfully copied ${finalCount} rows to ${toSchema}.${tableName}`);
}

async function recreateIndexes(client, tableName, indexes, schema = 'public') {
  if (indexes.length === 0) return;
  
  console.log(`📊 Creating indexes for ${schema}.${tableName}...`);
  
  // Group indexes by index name
  const indexGroups = {};
  indexes.forEach(idx => {
    if (!indexGroups[idx.index_name]) {
      indexGroups[idx.index_name] = {
        name: idx.index_name,
        columns: [],
        is_unique: idx.is_unique
      };
    }
    indexGroups[idx.index_name].columns.push(idx.column_name);
  });
  
  for (const [indexName, indexInfo] of Object.entries(indexGroups)) {
    try {
      const uniqueClause = indexInfo.is_unique ? 'UNIQUE' : '';
      const newIndexName = `${indexName.replace('prd_enrichment_', 'public_')}`;
      
      const createIndexQuery = `
        CREATE ${uniqueClause} INDEX IF NOT EXISTS ${newIndexName}
        ON ${schema}.${tableName} (${indexInfo.columns.join(', ')})
      `;
      
      await client.query(createIndexQuery);
      console.log(`✅ Created index: ${newIndexName}`);
    } catch (error) {
      console.warn(`⚠️ Could not create index ${indexName}: ${error.message}`);
    }
  }
}

async function addForeignKeyConstraints(client, tableName, foreignKeys, schema = 'public') {
  if (foreignKeys.length === 0) return;
  
  console.log(`🔗 Adding foreign key constraints for ${schema}.${tableName}...`);
  
  for (const fk of foreignKeys) {
    try {
      // Update the constraint to reference the public schema
      const constraintQuery = `
        ALTER TABLE ${schema}.${tableName}
        ADD CONSTRAINT ${fk.constraint_name}
        FOREIGN KEY (${fk.column_name})
        REFERENCES public.${fk.foreign_table_name}(${fk.foreign_column_name})
      `;
      
      await client.query(constraintQuery);
      console.log(`✅ Added FK constraint: ${fk.constraint_name}`);
    } catch (error) {
      console.warn(`⚠️ Could not add FK constraint ${fk.constraint_name}: ${error.message}`);
    }
  }
}

async function dropTableFromSchema(client, tableName, schema = 'prd_enrichment') {
  console.log(`🗑️ Dropping table ${schema}.${tableName}...`);
  try {
    await client.query(`DROP TABLE IF EXISTS ${schema}.${tableName} CASCADE`);
    console.log(`✅ Dropped ${schema}.${tableName}`);
  } catch (error) {
    console.warn(`⚠️ Could not drop ${schema}.${tableName}: ${error.message}`);
  }
}

async function moveTablesFromPrdEnrichmentToPublic() {
  let client;
  
  try {
    console.log('🚀 Starting Schema Migration: prd_enrichment → public');
    console.log('=====================================================');
    
    // Connect to database
    console.log('🔌 Connecting to PIM database...');
    client = new Client(dbConfig);
    await client.connect();
    console.log('✅ Connected to PIM database');
    
    // Store table metadata before migration
    const tableMetadata = {};
    
    console.log('\n📋 Phase 1: Collecting table metadata...');
    console.log('==========================================');
    
    for (const tableName of tablesToMove) {
      try {
        // Check if source table exists in prd_enrichment schema
        const tableExistsResult = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'prd_enrichment' 
            AND table_name = $1
          )
        `, [tableName]);
        
        if (!tableExistsResult.rows[0].exists) {
          console.log(`⚠️ Table prd_enrichment.${tableName} does not exist, skipping...`);
          continue;
        }
        
        const structure = await getTableStructure(client, tableName, 'prd_enrichment');
        const primaryKeys = await getPrimaryKeys(client, tableName, 'prd_enrichment');
        const foreignKeys = await getForeignKeys(client, tableName, 'prd_enrichment');
        const indexes = await getIndexes(client, tableName, 'prd_enrichment');
        
        tableMetadata[tableName] = {
          structure,
          primaryKeys,
          foreignKeys,
          indexes
        };
        
        console.log(`✅ Collected metadata for ${tableName}`);
        
      } catch (error) {
        console.error(`❌ Error collecting metadata for ${tableName}:`, error.message);
        continue;
      }
    }
    
    // Phase 2: Create tables in public schema
    console.log('\n🔨 Phase 2: Creating tables in public schema...');
    console.log('================================================');
    
    for (const tableName of tablesToMove) {
      if (tableMetadata[tableName]) {
        try {
          await createTableInPublicSchema(
            client, 
            tableName, 
            tableMetadata[tableName].structure, 
            tableMetadata[tableName].primaryKeys
          );
        } catch (error) {
          console.error(`❌ Error creating table ${tableName}:`, error.message);
          continue;
        }
      }
    }
    
    // Phase 3: Copy data
    console.log('\n📊 Phase 3: Copying table data...');
    console.log('==================================');
    
    for (const tableName of tablesToMove) {
      if (tableMetadata[tableName]) {
        try {
          await copyTableData(client, tableName, 'prd_enrichment', 'public');
        } catch (error) {
          console.error(`❌ Error copying data for ${tableName}:`, error.message);
          continue;
        }
      }
    }
    
    // Phase 4: Recreate indexes
    console.log('\n📊 Phase 4: Creating indexes...');
    console.log('================================');
    
    for (const tableName of tablesToMove) {
      if (tableMetadata[tableName]) {
        try {
          await recreateIndexes(client, tableName, tableMetadata[tableName].indexes, 'public');
        } catch (error) {
          console.error(`❌ Error creating indexes for ${tableName}:`, error.message);
          continue;
        }
      }
    }
    
    // Phase 5: Add foreign key constraints
    console.log('\n🔗 Phase 5: Adding foreign key constraints...');
    console.log('===============================================');
    
    for (const tableName of tablesToMove) {
      if (tableMetadata[tableName]) {
        try {
          await addForeignKeyConstraints(client, tableName, tableMetadata[tableName].foreignKeys, 'public');
        } catch (error) {
          console.error(`❌ Error adding foreign keys for ${tableName}:`, error.message);
          continue;
        }
      }
    }
    
    // Phase 6: Verification
    console.log('\n🔍 Phase 6: Verification...');
    console.log('============================');
    
    let totalRowsMigrated = 0;
    const migratedTables = [];
    
    for (const tableName of tablesToMove) {
      if (tableMetadata[tableName]) {
        try {
          const sourceCountResult = await client.query(`SELECT COUNT(*) FROM prd_enrichment.${tableName}`);
          const targetCountResult = await client.query(`SELECT COUNT(*) FROM public.${tableName}`);
          
          const sourceCount = parseInt(sourceCountResult.rows[0].count);
          const targetCount = parseInt(targetCountResult.rows[0].count);
          
          if (sourceCount === targetCount) {
            console.log(`✅ ${tableName}: ${targetCount} rows migrated successfully`);
            totalRowsMigrated += targetCount;
            migratedTables.push(tableName);
          } else {
            console.log(`⚠️ ${tableName}: Source has ${sourceCount} rows, target has ${targetCount} rows`);
          }
        } catch (error) {
          console.error(`❌ Error verifying ${tableName}:`, error.message);
        }
      }
    }
    
    // Phase 7: Clean up old tables (optional - commented out for safety)
    console.log('\n🗑️ Phase 7: Cleanup (optional)...');
    console.log('==================================');
    console.log('ℹ️ Old tables in prd_enrichment schema are kept for safety');
    console.log('ℹ️ You can manually drop them after verifying the migration');
    
    /*
    for (const tableName of migratedTables) {
      try {
        await dropTableFromSchema(client, tableName, 'prd_enrichment');
      } catch (error) {
        console.error(`❌ Error dropping ${tableName}:`, error.message);
      }
    }
    */
    
    console.log('\n🎉 Schema Migration completed!');
    console.log('==============================');
    console.log('📍 Target location: pim.public');
    console.log(`📋 Tables migrated: ${migratedTables.join(', ')}`);
    console.log(`📈 Total rows migrated: ${totalRowsMigrated}`);
    console.log('\n💡 Manual cleanup commands (run when ready):');
    migratedTables.forEach(table => {
      console.log(`   DROP TABLE IF EXISTS prd_enrichment.${table} CASCADE;`);
    });
    
  } catch (error) {
    console.error('💥 Schema migration failed:', error);
    throw error;
  } finally {
    if (client) {
      await client.end();
      console.log('🔌 Disconnected from database');
    }
  }
}

// Run the migration
if (require.main === module) {
  moveTablesFromPrdEnrichmentToPublic().catch(error => {
    console.error('💥 Schema migration script failed:', error);
    process.exit(1);
  });
}

module.exports = { moveTablesFromPrdEnrichmentToPublic };
