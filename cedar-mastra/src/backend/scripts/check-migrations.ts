/**
 * Check Migration Status
 * 
 * Verifies that all required tables and migrations have been applied.
 */

import 'dotenv/config';
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

interface TableCheck {
  name: string;
  exists: boolean;
  required: boolean;
}

interface ColumnCheck {
  table: string;
  column: string;
  type: string;
  exists: boolean;
  actualType?: string;
}

async function checkMigrations() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable required');
    process.exit(1);
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('\n🔍 Checking Migration Status');
  console.log('='.repeat(80));

  try {
    // Check required tables
    const requiredTables = [
      'security_intelligence',
      'cwe_cve_mapping',
      'owasp_cve_mapping',
      'code_examples',
      'breach_case_studies',
      'remediation_guidance',
      'ingestion_state',
    ];

    console.log('\n📋 Checking Tables:');
    const tableResults: TableCheck[] = [];

    for (const tableName of requiredTables) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )`,
        [tableName]
      );

      const exists = result.rows[0].exists;
      tableResults.push({ name: tableName, exists, required: true });

      if (exists) {
        console.log(`   ✅ ${tableName}`);
      } else {
        console.log(`   ❌ ${tableName} (MISSING)`);
      }
    }

    // Check field lengths
    console.log('\n📏 Checking Field Lengths:');
    const fieldChecks: ColumnCheck[] = [
      { table: 'cwe_cve_mapping', column: 'cwe_id', type: 'character varying(30)', exists: false },
      { table: 'cwe_cve_mapping', column: 'cve_id', type: 'character varying(30)', exists: false },
      { table: 'code_examples', column: 'cwe_id', type: 'character varying(30)', exists: false },
      { table: 'code_examples', column: 'cve_id', type: 'character varying(30)', exists: false },
    ];

    for (const check of fieldChecks) {
      try {
        const result = await client.query(
          `SELECT data_type, character_maximum_length
           FROM information_schema.columns
           WHERE table_name = $1 AND column_name = $2`,
          [check.table, check.column]
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          const actualType = row.character_maximum_length 
            ? `${row.data_type}(${row.character_maximum_length})`
            : row.data_type;
          
          check.exists = true;
          check.actualType = actualType;

          if (actualType === check.type) {
            console.log(`   ✅ ${check.table}.${check.column}: ${actualType}`);
          } else {
            console.log(`   ⚠️  ${check.table}.${check.column}: ${actualType} (expected ${check.type})`);
          }
        } else {
          console.log(`   ❌ ${check.table}.${check.column}: NOT FOUND`);
        }
      } catch (error) {
        console.log(`   ❌ ${check.table}.${check.column}: ERROR checking`);
      }
    }

    // Check functions
    console.log('\n⚙️  Checking Functions:');
    const requiredFunctions = [
      'get_ingestion_state',
      'update_ingestion_state',
      'reset_ingestion_state',
    ];

    for (const funcName of requiredFunctions) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM pg_proc 
          WHERE proname = $1
        )`,
        [funcName]
      );

      if (result.rows[0].exists) {
        console.log(`   ✅ ${funcName}()`);
      } else {
        console.log(`   ❌ ${funcName}() (MISSING)`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    const missingTables = tableResults.filter(t => !t.exists);
    const incorrectFields = fieldChecks.filter(f => f.exists && f.actualType !== f.type);

    if (missingTables.length === 0 && incorrectFields.length === 0) {
      console.log('✅ All migrations applied successfully!');
      console.log('\n🚀 Ready to run ingestion scripts');
    } else {
      console.log('⚠️  Migration Issues Detected\n');
      
      if (missingTables.length > 0) {
        console.log('Missing tables:');
        missingTables.forEach(t => console.log(`  - ${t.name}`));
        console.log('\nTo fix: Run migrations 001, 002, and 003');
      }

      if (incorrectFields.length > 0) {
        console.log('\nIncorrect field types:');
        incorrectFields.forEach(f => 
          console.log(`  - ${f.table}.${f.column}: ${f.actualType} (should be ${f.type})`)
        );
        console.log('\nTo fix: Run migration 004');
      }

      console.log('\n📚 Migration Commands:');
      console.log('  psql $DATABASE_URL -f migrations/001_initial_schema.sql');
      console.log('  psql $DATABASE_URL -f migrations/002_code_examples_and_mappings.sql');
      console.log('  psql $DATABASE_URL -f migrations/003_ingestion_state_tracking.sql');
      console.log('  psql $DATABASE_URL -f migrations/004_fix_field_lengths.sql');
    }

    console.log('='.repeat(80) + '\n');

  } finally {
    await client.end();
  }
}

checkMigrations().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

