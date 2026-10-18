const { Client } = require('pg');
const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  // 1. Check recrutamento_prestadores table
  const cols = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'recrutamento_prestadores' AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  console.log('=== recrutamento_prestadores columns ===');
  cols.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ')'));

  // 2. Count
  const cnt = await c.query(`SELECT COUNT(*) as cnt FROM public.recrutamento_prestadores`);
  console.log('\nCount:', cnt.rows[0].cnt);

  // 3. Sample
  const sample = await c.query(`SELECT * FROM public.recrutamento_prestadores LIMIT 5`);
  console.log('\nSample:');
  sample.rows.forEach(r => {
    console.log('  ID:', r.id, '| nome:', r.nome_completo || r.nome, '| status:', r.status);
  });

  // 4. Check existing recrutamento_candidatos with prestador_id
  const linked = await c.query(`
    SELECT rc.id, rc.nome, rc.prestador_id, rc.stage,
           rp.id as rp_id, rp.nome_completo as rp_nome
    FROM public.recrutamento_candidatos rc
    LEFT JOIN public.recrutamento_prestadores rp ON rc.prestador_id = rp.id
    WHERE rc.prestador_id IS NOT NULL
  `);
  console.log('\n=== Linked candidatos (checking FK target) ===');
  linked.rows.forEach(r => {
    console.log('  candidato:', r.nome, '| prestador_id:', r.prestador_id);
    console.log('    -> recrutamento_prestadores:', r.rp_id, '|', r.rp_nome);
  });

  // 5. Check if there's a recrutamento_prestadores entry for the app prestador "teste 2"
  const teste2 = await c.query(`
    SELECT * FROM public.recrutamento_prestadores 
    WHERE cpf_cnpj = '000' OR nome_completo LIKE '%teste%' OR nome LIKE '%teste%'
  `);
  console.log('\n=== teste 2 in recrutamento_prestadores ===');
  console.log('Found:', teste2.rows.length);
  teste2.rows.forEach(r => console.log('  ID:', r.id, '| nome:', r.nome_completo || r.nome));

  // 6. Check recrutamento_prestadores for any "app" origin
  const appRP = await c.query(`
    SELECT id, nome_completo, nome, status, created_at
    FROM public.recrutamento_prestadores
    WHERE id IN (
      SELECT prestador_id FROM public.recrutamento_candidatos WHERE prestador_id IS NOT NULL
    )
  `);
  console.log('\n=== recrutamento_prestadores linked to candidatos ===');
  console.log('Found:', appRP.rows.length);
  appRP.rows.forEach(r => console.log('  ID:', r.id, '| nome:', r.nome_completo || r.nome, '| status:', r.status));

  await c.end();
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
