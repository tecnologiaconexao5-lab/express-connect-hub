const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const connStr = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function main() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected!\n');

  const sqlFull = fs.readFileSync(path.join(__dirname, '..', 'supabase/migrations/20260713_m114_portal_conclusao.sql'), 'utf8');
  
  // Split by major section headers
  const lines = sqlFull.split('\n');
  const blocks = [];
  let current = [];
  
  for (const line of lines) {
    if ((line.startsWith('-- ===') || line.startsWith('-- FASE') || 
         line.startsWith('ALTER TABLE') || line.startsWith('CREATE OR REPLACE') || 
         line.startsWith('DO ') || line.startsWith('DROP POLICY') || 
         line.startsWith('CREATE POLICY') || line.startsWith('REVOKE') || 
         line.startsWith('GRANT') || line.startsWith('COMMENT ON') ||
         line.startsWith('CREATE INDEX') || line.startsWith('CREATE UNIQUE') ||
         line.startsWith('CREATE TRIGGER') || line.startsWith('CREATE VIEW')) && current.length > 0) {
      blocks.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current.join('\n'));
  
  let ok = 0, errs = 0;
  
  for (const block of blocks) {
    const sql = block.trim();
    if (!sql || sql.replace(/^--.*$/gm, '').trim().length < 5) continue;
    
    try {
      await client.query(sql);
      process.stdout.write('.');
      ok++;
    } catch(e) {
      const msg = e.message;
      if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('does not exist')) {
        process.stdout.write('s');
        ok++; continue;
      }
      console.log('\n[' + errs + '] ' + msg.substring(0, 120));
      errs++;
    }
  }
  
  console.log(`\n${ok} OK, ${errs} errors`);

  // Verify
  const checks = [
    `SELECT count(*) as cnt FROM information_schema.columns WHERE table_name='portal_pedidos' AND column_name='erro_processamento'`,
    `SELECT count(*) as cnt FROM pg_policies WHERE policyname='ptr_select_auth' AND tablename='portal_tracking_realtime'`,
    `SELECT count(*) as cnt FROM pg_views WHERE viewname='vw_portal_financeiro_cliente'`,
    `SELECT count(*) as cnt FROM pg_proc WHERE proname='f_reprocessar_pedido_portal'`,
  ];
  
  for (const check of checks) {
    try {
      const r = await client.query(check);
      const name = check.match(/column_name='(\w+)'/)?.[1] || check.match(/viewname='(\w+)'/)?.[1] || 
                   check.match(/proname='(\w+)'/)?.[1] || check.match(/policyname='(\w+)'/)?.[1] || '?';
      console.log(`${parseInt(r.rows[0].cnt) > 0 ? 'OK' : 'FAIL'}: ${name}`);
    } catch(e) {
      console.log('ERR:', e.message.substring(0, 60));
    }
  }

  await client.end();
}
main().catch(err => { console.error('FATAL:', err); process.exit(1); });
