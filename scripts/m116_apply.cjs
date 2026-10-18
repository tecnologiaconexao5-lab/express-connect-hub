const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Connected!\n');

  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase/migrations/20260713_m116_reversa_cols.sql'), 'utf8');
  
  // Split by sections
  const lines = sql.split('\n');
  const blocks = [];
  let current = [];
  let inDollar = false;

  for (const line of lines) {
    if ((line.startsWith('-- ===') || line.startsWith('-- ')) && !inDollar && current.length > 0) {
      const content = current.join('\n').trim();
      if (content.replace(/^--.*$/gm, '').trim().length > 0) {
        blocks.push(content);
      }
      current = [line];
    } else {
      current.push(line);
      if (line.includes('$$') && current.join('\n').trim().startsWith('CREATE OR REPLACE FUNCTION')) {
        const fullText = current.join('\n');
        if (fullText.trim().endsWith('$$;') || fullText.trim().includes('GRANT EXECUTE')) {
          blocks.push(fullText.trim());
          current = [];
        }
      }
    }
  }
  const remaining = current.join('\n').trim();
  if (remaining.replace(/^--.*$/gm, '').trim().length > 0) blocks.push(remaining);

  console.log(`Executing ${blocks.length} blocks...\n`);
  
  let ok = 0, err = 0;
  for (const block of blocks) {
    try {
      await client.query(block);
      process.stdout.write('.');
      ok++;
    } catch(e) {
      if (e.message.includes('already exists') || e.message.includes('duplicate')) {
        process.stdout.write('s');
        ok++; continue;
      }
      console.log(`\nERROR: ${e.message.substring(0, 100)}`);
      err++;
    }
  }
  
  console.log(`\n\n${ok} OK, ${err} errors`);

  // Verify
  const checks = [
    `SELECT count(*) as cnt FROM information_schema.columns WHERE table_name='alocacoes_escala' AND column_name='reversa_qtd_coletada'`,
    `SELECT count(*) as cnt FROM information_schema.columns WHERE table_name='alocacoes_escala' AND column_name='reversa_endereco_coleta'`,
    `SELECT count(*) as cnt FROM pg_views WHERE viewname='vw_app_motorista_operacoes'`,
    `SELECT count(*) as cnt FROM pg_proc WHERE proname='f_atualizar_reversa_app'`,
  ];
  console.log('\n=== Verification ===');
  for (const check of checks) {
    try {
      const r = await client.query(check);
      const name = check.match(/column_name='(\w+)'/)?.[1] || check.match(/viewname='(\w+)'/)?.[1] || check.match(/proname='(\w+)'/)?.[1] || '?';
      console.log(`${parseInt(r.rows[0].cnt) > 0 ? 'OK' : '----'} : ${name}`);
    } catch(e) { console.log(`ERR: ${e.message.substring(0, 60)}`); }
  }

  // Verify view doesn't expose reversa_valor_cliente
  const viewDef = await client.query(`SELECT definition FROM pg_views WHERE viewname='vw_app_motorista_operacoes'`);
  if (viewDef.rows.length > 0) {
    const def = viewDef.rows[0].definition;
    console.log('\nView security:');
    console.log('  reversa_valor_cliente exposed: ' + def.includes('reversa_valor_cliente'));
    console.log('  reversa_valor_prestador exposed: ' + def.includes('reversa_valor_prestador'));
    console.log('  reversa_assinatura_url: ' + def.includes('reversa_assinatura_url'));
  }

  await client.end();
}
main().catch(err => { console.error('FATAL:', err); process.exit(1); });
