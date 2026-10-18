const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const connStr = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected!\n');

  const migrationPath = path.join(__dirname, '..', 'supabase/migrations/20260713_m113_portal_security_rls.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Split by major blocks (sections separated by -- =)
  const blocks = sql.split(/\n(?=-- ===|-- \d\.|CREATE OR REPLACE|DO |DROP POLICY|CREATE POLICY|COMMENT ON)/);
  
  let ok = 0, err = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block || block.startsWith('--') || block.length < 10) continue;
    
    try {
      await client.query(block);
      process.stdout.write('.');
      ok++;
    } catch(e) {
      const msg = e.message;
      if (msg.includes('already exists') || msg.includes('duplicate') || 
          msg.includes('does not exist') && msg.includes('policy')) {
        process.stdout.write('s');
        ok++;
      } else {
        console.log(`\n[${i}] ${msg.substring(0, 120)}`);
        err++;
      }
    }
  }
  
  console.log(`\n\n${ok} OK, ${err} errors`);
  
  // Verify
  console.log('\n=== VERIFICATION ===');
  const policies = await client.query(`
    SELECT tablename, policyname FROM pg_policies
    WHERE tablename IN ('clientes','ordens_servico','financeiro_receber','portal_pedidos',
      'portal_notificacoes','portal_ocorrencias','portal_avaliacoes','portal_faturas',
      'portal_protocolos','rotas','rota_paradas','entregas_protocolo')
      AND policyname LIKE '%own%'
    ORDER BY tablename
  `);
  console.log(`Portal RLS policies with _own suffix: ${policies.rows.length}`);
  
  const liberar = await client.query(`
    SELECT count(*) FROM pg_policies
    WHERE policyname LIKE '%liberar%' OR policyname LIKE '%allow_all%'
  `);
  console.log(`Old liberar/allow_all policies remaining: ${liberar.rows[0].count}`);
  
  await client.end();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
