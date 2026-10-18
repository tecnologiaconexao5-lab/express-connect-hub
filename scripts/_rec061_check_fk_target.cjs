const { Client } = require('pg');
const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  // Check if prestador and recrutamento_prestadores share IDs
  const shared = await c.query(`
    SELECT p.id as prest_id, p.nome_completo as prest_nome, p.status as prest_status,
           rp.id as rp_id, rp.nome as rp_nome, rp.status as rp_status
    FROM public.prestadores p
    JOIN public.recrutamento_prestadores rp ON p.id = rp.id
  `);
  console.log('=== Shared IDs (prestadores ∩ recrutamento_prestadores) ===');
  console.log('Count:', shared.rows.length);
  shared.rows.forEach(r => {
    console.log('  ID:', r.prest_id);
    console.log('    prestadores:', r.prest_nome, '|', r.prest_status);
    console.log('    recrutamento_prestadores:', r.rp_nome, '|', r.rp_status);
  });

  // Check the linked candidato's prestador in both tables
  const linked = await c.query(`
    SELECT rc.prestador_id, rc.nome as candidato,
           p.id as p_id, p.nome_completo as p_nome,
           rp.id as rp_id, rp.nome as rp_nome
    FROM public.recrutamento_candidatos rc
    LEFT JOIN public.prestadores p ON rc.prestador_id = p.id
    LEFT JOIN public.recrutamento_prestadores rp ON rc.prestador_id = rp.id
    WHERE rc.prestador_id IS NOT NULL
  `);
  console.log('\n=== Linked candidato check ===');
  linked.rows.forEach(r => {
    console.log('  candidato:', r.candidato, '| prestador_id:', r.prestador_id);
    console.log('    in prestadores:', r.p_id ? 'YES' : 'NO', '|', r.p_nome);
    console.log('    in recrutamento_prestadores:', r.rp_id ? 'YES' : 'NO', '|', r.rp_nome);
  });

  // Check the "teste 2" prestador - does it exist in recrutamento_prestadores?
  const teste2 = await c.query(`
    SELECT p.id, p.nome_completo, p.origem
    FROM public.prestadores p
    WHERE p.origem = 'app_prestador'
  `);
  console.log('\n=== App prestador in recrutamento_prestadores? ===');
  for (const p of teste2.rows) {
    const rp = await c.query(`SELECT id FROM public.recrutamento_prestadores WHERE id = '${p.id}'`);
    console.log('  ' + p.id + ' (' + p.nome_completo + '):', rp.rows.length > 0 ? 'EXISTS' : 'MISSING');
  }

  // Check: does conversaoCandidatoService insert into recrutamento_prestadores?
  // Look at the code — it calls prestadoresService.criar() then sincronizarComOperacao()
  // The sincronizar inserts into 'prestadores' (operational table)
  // But the FK needs recrutamento_prestadores...

  // Check if there's a second FK or if the bridge needs to also write recrutamento_prestadores
  const allFK = await c.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND (ccu.table_name = 'recrutamento_prestadores' OR kcu.table_name = 'recrutamento_prestadores')
    AND tc.table_schema = 'public'
  `);
  console.log('\n=== All FKs involving recrutamento_prestadores ===');
  allFK.rows.forEach(r => {
    console.log('  ' + r.table_name + '.' + r.column_name + ' -> ' + r.foreign_table_name + '.' + r.foreign_column_name);
    console.log('    on_delete=' + r.delete_rule);
  });

  await c.end();
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
