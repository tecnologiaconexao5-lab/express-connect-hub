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
  let sql = fs.readFileSync(migrationPath, 'utf8');

  // Remove comment-only lines at start/end
  sql = sql.replace(/^-- .*\n/gm, '').trim();

  // Execute in batches split by empty lines between independent blocks
  // We need to properly split around function/DO bodies
  const blocks = sql.split(/\n\n(?=CREATE|ALTER|DROP|GRANT|REVOKE|SELECT)/);
  
  let success = 0;
  let errors = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    try {
      await client.query(block);
      process.stdout.write('.');
      success++;
    } catch (err) {
      // Skip idempotent errors
      const msg = err.message;
      if (msg.includes('already exists') || 
          msg.includes('duplicate key') ||
          msg.includes('duplicate_object')) {
        process.stdout.write('s');
        success++;
        continue;
      }
      console.log(`\nBlock ${i + 1} ERROR: ${msg.substring(0, 200)}`);
      console.log(`First 100 chars: ${block.substring(0, 100)}`);
      errors++;
    }
  }

  console.log(`\n\nDone! ${success} OK, ${errors} errors.`);
  await client.end();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
