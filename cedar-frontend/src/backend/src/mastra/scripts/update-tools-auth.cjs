#!/usr/bin/env node

/**
 * Script to update all tools that need database authentication
 * This updates them to use the shared database-auth module
 */

const fs = require('fs').promises;
const path = require('path');

const toolsToUpdate = [
  'analyze-scan-tool.ts',
  'cve-analysis-tool.ts',
  'remediation-prioritization-tool.ts',
  'github-advisory-ingestion-tool.ts'
];

async function updateTool(toolPath) {
  console.log(`📝 Updating ${path.basename(toolPath)}...`);

  try {
    let content = await fs.readFile(toolPath, 'utf8');
    const originalContent = content;

    // Step 1: Update imports if it has direct pg Client usage
    if (content.includes("import { Client } from 'pg'")) {
      // Replace the import
      content = content.replace(
        /import\s+{\s*Client\s*}\s+from\s+['"]pg['"];?/g,
        `import {
  getPostgresPool,
  executeQueryWithRetry,
  validateEnvironment
} from '../lib/database-auth';`
      );
    } else if (content.includes("from 'pg'") && !content.includes('database-auth')) {
      // Add our imports after other imports
      const lastImportMatch = content.match(/import[^;]+from\s+['"][^'"]+['"];?\s*$/m);
      if (lastImportMatch) {
        const insertPos = lastImportMatch.index + lastImportMatch[0].length;
        content = content.slice(0, insertPos) +
          `\nimport {
  getPostgresPool,
  executeQueryWithRetry,
  validateEnvironment
} from '../lib/database-auth';` +
          content.slice(insertPos);
      }
    }

    // Step 2: Add environment validation at the start of execute function
    const executeMatch = content.match(/execute:\s*async\s*\([^)]*\)\s*=>\s*{/);
    if (executeMatch && !content.includes('validateEnvironment()')) {
      const insertPos = executeMatch.index + executeMatch[0].length;
      const indent = '    '; // Standard indentation

      // Find if there's already a DATABASE_URL check we need to replace
      if (content.includes('if (!process.env.DATABASE_URL)')) {
        // Replace the existing check with our validation
        content = content.replace(
          /if\s*\(!process\.env\.DATABASE_URL\)\s*{[^}]+}/g,
          `// Validate environment before proceeding
    const envValidation = validateEnvironment();
    if (!envValidation.valid) {
      throw new Error(
        \`Missing required environment variables: \${envValidation.missing.join(', ')}. \` +
        'Please configure your environment variables for database access.'
      );
    }

    // Log any warnings
    if (envValidation.warnings.length > 0) {
      console.log('⚠️  Environment warnings:', envValidation.warnings.join('; '));
    }`
        );
      } else {
        // Add validation at the beginning of execute
        const validationCode = `
${indent}// Validate environment before proceeding
${indent}const envValidation = validateEnvironment();
${indent}if (!envValidation.valid) {
${indent}  throw new Error(
${indent}    \`Missing required environment variables: \${envValidation.missing.join(', ')}. \` +
${indent}    'Please configure your environment variables for database access.'
${indent}  );
${indent}}
${indent}
${indent}// Log any warnings
${indent}if (envValidation.warnings.length > 0) {
${indent}  console.log('⚠️  Environment warnings:', envValidation.warnings.join('; '));
${indent}}
`;

        content = content.slice(0, insertPos) + validationCode + content.slice(insertPos);
      }
    }

    // Step 3: Replace direct Client usage with pool
    if (content.includes('new Client(')) {
      // Remove client creation
      content = content.replace(
        /const\s+\w+\s*=\s*new\s+Client\([^)]*\);?\s*/g,
        ''
      );

      // Remove await client.connect()
      content = content.replace(
        /await\s+\w+\.connect\(\);?\s*/g,
        ''
      );

      // Replace client.query with executeQueryWithRetry
      content = content.replace(
        /await\s+(\w+)\.query\(/g,
        'await executeQueryWithRetry('
      );

      // Remove await client.end() in finally blocks
      content = content.replace(
        /finally\s*{\s*await\s+\w+\.end\(\);?\s*}/g,
        ''
      );

      // Remove standalone client.end() calls
      content = content.replace(
        /await\s+\w+\.end\(\);?\s*/g,
        ''
      );
    }

    // Step 4: Update error handling to be more specific
    if (content.includes('} catch (error') && !content.includes('DATABASE_URL')) {
      content = content.replace(
        /(}\s*catch\s*\(error[^)]*\)\s*{)/g,
        `$1
      // Check if it's a database connection issue
      if (error.message?.includes('DATABASE_URL')) {
        throw new Error(
          'Database connection not configured. Please set DATABASE_URL environment variable.'
        );
      }
`
      );
    }

    // Only write if content changed
    if (content !== originalContent) {
      await fs.writeFile(toolPath, content);
      console.log(`✅ Updated ${path.basename(toolPath)}`);
      return true;
    } else {
      console.log(`⏭️  No changes needed for ${path.basename(toolPath)}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating ${path.basename(toolPath)}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Updating tools with shared authentication module...\n');

  const toolsDir = path.join(__dirname, '..', 'tools');
  let updated = 0;
  let failed = 0;

  for (const toolFile of toolsToUpdate) {
    const toolPath = path.join(toolsDir, toolFile);
    const success = await updateTool(toolPath);
    if (success) {
      updated++;
    } else {
      failed++;
    }
  }

  console.log(`\n📊 Summary: ${updated} tools updated, ${failed} failed or unchanged`);

  if (updated > 0) {
    console.log('\n⚠️  Remember to:');
    console.log('1. Set DATABASE_URL environment variable');
    console.log('2. Set SCANNER_SERVICE_URL, SCANNER_USERNAME, and SCANNER_PASSWORD if needed');
    console.log('3. Restart the Mastra service to apply changes');
  }
}

main().catch(console.error);