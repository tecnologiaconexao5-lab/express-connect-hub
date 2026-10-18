const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  const outLines = [];

  // Helper
  const log = (s) => { console.log(s); outLines.push(s); };

  const rpcs = ['f_buscar_operacoes_motorista', 'f_avancar_etapa_app_motorista', 'f_atualizar_reversa_app'];

  for (const rpc of rpcs) {
    log(`\n${'='.repeat(70)}`);
    log(`RPC: ${rpc}`);
    log(`${'='.repeat(70)}`);

    // Full definition
    const defRes = await client.query(`
      SELECT pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = $1
    `, [rpc]);

    if (defRes.rows.length === 0) {
      log('  NOT FOUND');
      continue;
    }

    const def = defRes.rows[0].definition;
    const sha256 = crypto.createHash('sha256').update(def).digest('hex');
    log(`  SHA256: ${sha256}`);
    log(`  Length: ${def.length} chars`);

    // Metadata
    const metaRes = await client.query(`
      SELECT p.pronargs, p.pronargdefaults,
             p.prorettype::regtype::text as return_type,
             p.provolatile, p.prosecdef,
             p.proconfig, p.proargnames::text[] as arg_names
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = $1
    `, [rpc]);

    const m = metaRes.rows[0];
    log(`  Args: ${m.pronargs} (${m.pronargdefaults} defaults)`);
    log(`  Arg names: ${JSON.stringify(m.arg_names)}`);
    log(`  Return: ${m.return_type}`);
    log(`  Volatile: ${m.provolatile} (${m.provolatile === 'v' ? 'VOLATILE' : m.provolatile === 's' ? 'STABLE' : m.provolatile === 'i' ? 'IMMUTABLE' : 'UNKNOWN'})`);
    log(`  SECURITY DEFINER: ${m.prosecdef}`);
    log(`  search_path: ${JSON.stringify(m.proconfig)}`);

    // Grants
    const grantRes = await client.query(`
      SELECT grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE specific_schema = 'public' AND routine_name = $1
      ORDER BY grantee, privilege_type
    `, [rpc]);

    log('  Grants:');
    for (const g of grantRes.rows) {
      log(`    ${g.grantee} -> ${g.privilege_type}`);
    }

    // Owner
    const ownerRes = await client.query(`
      SELECT pg_catalog.pg_get_userbyid(p.proowner) as owner
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = $1
    `, [rpc]);
    log(`  Owner: ${ownerRes.rows[0].owner}`);

    // Save full definition to file
    const safeName = rpc.replace(/_/g, '-');
    fs.writeFileSync(`docs/auditoria/02_evidencias/sql/${safeName}_remota.sql`, def);
    log(`  Saved: docs/auditoria/02_evidencias/sql/${safeName}_remota.sql`);
  }

  // Also dump all grants summary
  log(`\n${'='.repeat(70)}`);
  log('GRANTS SUMMARY (all 3 RPCs)');
  log(`${'='.repeat(70)}`);

  const allGrants = await client.query(`
    SELECT routine_name, grantee, privilege_type
    FROM information_schema.routine_privileges
    WHERE specific_schema = 'public'
      AND routine_name IN ('f_buscar_operacoes_motorista','f_avancar_etapa_app_motorista','f_atualizar_reversa_app')
    ORDER BY routine_name, grantee
  `);

  log('routine_name | grantee | privilege_type');
  log('--- | --- | ---');
  for (const g of allGrants.rows) {
    log(`${g.routine_name} | ${g.grantee} | ${g.privilege_type}`);
  }

  await client.end();

  // Write full log
  fs.writeFileSync('docs/auditoria/02_evidencias/sql/2026-07-27_freeze_remoto.log', outLines.join('\n') + '\n');
  console.log('\nDone. Log saved.');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
