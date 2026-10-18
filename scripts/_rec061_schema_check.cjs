const { Client } = require('pg');
const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  // 1. Prestadores columns
  const cols = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'prestadores' AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  console.log('=== prestadores columns ===');
  cols.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ') nullable=' + r.is_nullable));

  // 2. Sample prestador with app origin — check actual field values
  const app = await c.query(`
    SELECT id, nome_completo, telefone, email, cidade, uf, endereco, veiculos, origem, origem_cadastro
    FROM public.prestadores
    WHERE origem = 'app_prestador' OR origem_cadastro = 'app_motorista'
    LIMIT 3
  `);
  console.log('\n=== App prestadores sample ===');
  app.rows.forEach(r => {
    console.log('  id:', r.id);
    console.log('  nome_completo:', r.nome_completo);
    console.log('  telefone:', r.telefone);
    console.log('  email:', r.email);
    console.log('  cidade:', r.cidade);
    console.log('  uf:', r.uf);
    console.log('  endereco:', JSON.stringify(r.endereco));
    console.log('  veiculos:', JSON.stringify(r.veiculos));
    console.log('  origem:', r.origem);
    console.log('  origem_cadastro:', r.origem_cadastro);
    console.log('  ---');
  });

  // 3. recrutamento_candidatos columns
  const rcCols = await c.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'recrutamento_candidatos' AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  console.log('\n=== recrutamento_candidatos columns ===');
  rcCols.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ') nullable=' + r.is_nullable + ' default=' + (r.column_default || 'none')));

  await c.end();
}
run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
