const pg = require('pg');
const fs = require('fs');
const path = require('path');

const client = new pg.Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected!\n');

  const migrationPath = path.join(__dirname, '..', 'supabase/migrations/20260713_m111_app_integracao_tms.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Split by sections (each === section header)
  const sections = sql.split(/^-- ={3,}/m).filter(s => s.trim().length > 0);
  
  let success = 0;
  let errors = 0;

  for (let i = 0; i < sections.length; i++) {
    // Skip empty or pure comment sections
    const section = sections[i].trim();
    if (!section || section.startsWith('-- VALIDATION') || section.startsWith('-- SELECT')) continue;
    
    // Extract the actual SQL content (skip the section header comment)
    const lines = section.split('\n');
    const sqlStart = lines.findIndex(l => l.startsWith('-- ') === false && l.trim().length > 0);
    const sqlContent = lines.slice(sqlStart).join('\n').trim();
    
    if (!sqlContent) continue;

    try {
      await client.query(sqlContent);
      process.stdout.write(`Section ${i + 1}: OK\n`);
      success++;
    } catch (err) {
      // Ignore "already exists" errors
      if (err.message.includes('already exists') && 
          (err.message.includes('relation') || err.message.includes('type') || 
           err.message.includes('index') || err.message.includes('policy') || 
           err.message.includes('trigger'))) {
        process.stdout.write(`Section ${i + 1}: SKIP (exists)\n`);
        success++;
        continue;
      }
      process.stdout.write(`Section ${i + 1}: ERROR - ${err.message.substring(0, 150)}\n`);
      errors++;
    }
  }

  console.log(`\nDone! Success: ${success}, Errors: ${errors}`);
  await client.end();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
