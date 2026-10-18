const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, statement_timeout: 30000 });
  await c.connect();

  // Get ALL columns for one non-explained record
  const r = await c.query(`
    SELECT pp.*
    FROM pagamentos_prestadores pp
    WHERE pp.id = 'eeb5c299-0f59-4cbb-9ad2-f9acdc5be35f'
  `);
  
  if (r.rows.length > 0) {
    const row = r.rows[0];
    console.log('=== FULL pp RECORD (1926f400 case) ===');
    for (const [key, val] of Object.entries(row)) {
      if (val !== null && val !== 0 && val !== false && val !== '' && val !== 0.00) {
        console.log('  ' + key + ':', val);
      }
    }
    console.log('\n=== ALL NUMERIC COLUMNS ===');
    for (const [key, val] of Object.entries(row)) {
      if (typeof val === 'number' || (typeof val === 'string' && !isNaN(parseFloat(val)) && val !== '')) {
        const num = parseFloat(val);
        if (num !== 0) console.log('  ' + key + ':', val);
      }
    }
  }

  // Also check: does fp.valor have a 'desconto' column?
  const r2 = await c.query(`
    SELECT fp.*
    FROM financeiro_pagar fp
    WHERE fp.id = '1926f400-1a47-434e-a26e-609230a64e13'
  `);
  if (r2.rows.length > 0) {
    console.log('\n=== FULL fp RECORD ===');
    for (const [key, val] of Object.entries(r2.rows[0])) {
      if (val !== null && val !== 0 && val !== false && val !== '') {
        console.log('  ' + key + ':', val);
      }
    }
  }

  await c.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
