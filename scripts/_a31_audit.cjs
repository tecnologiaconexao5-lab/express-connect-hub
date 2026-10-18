const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();

  console.log('=== 1. clientes — campos financeiros ===');
  const r1 = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clientes'
    AND (column_name ILIKE '%venc%' OR column_name ILIKE '%cobr%' OR column_name ILIKE '%finance%'
         OR column_name ILIKE '%contato%' OR column_name ILIKE '%email%' OR column_name ILIKE '%tabela%'
         OR column_name ILIKE '%modelo%' OR column_name ILIKE '%romaneio%' OR column_name ILIKE '%aprov%'
         OR column_name ILIKE '%fechamento%' OR column_name ILIKE '%documento%' OR column_name ILIKE '%fiscal%'
         OR column_name ILIKE '%banco%' OR column_name ILIKE '%metadata%')
    ORDER BY ordinal_position`);
  console.log('  financeiros:', r1.rows.map(c=>c.column_name).join(', ') || 'nenhum');

  console.log('\n=== 2. configuracoes_fiscais (dados empresa) ===');
  const r2 = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='configuracoes_fiscais'
    ORDER BY ordinal_position`);
  console.log('  ', r2.rows.map(c=>c.column_name).join(', '));
  const r2b = await client.query(`SELECT count(*)::int AS n FROM configuracoes_fiscais`);
  console.log('  registros:', r2b.rows[0].n);

  console.log('\n=== 3. configuracoes_sistema (chaves) ===');
  const r3 = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='configuracoes_sistema'
    ORDER BY ordinal_position`);
  console.log('  cols:', r3.rows.map(c=>c.column_name).join(', '));

  console.log('\n=== 4. contas_financeiras existe? ===');
  const r4 = await client.query(`SELECT to_regclass('public.contas_financeiras') AS cls`);
  console.log('  ', r4.rows[0].cls || 'NAO EXISTE');

  console.log('\n=== 5. fiscal_documentos_vinculados (schema + dados) ===');
  const r5 = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='fiscal_documentos_vinculados'
    ORDER BY ordinal_position`);
  console.log('  cols:', r5.rows.map(c=>c.column_name).join(', '));
  const r5b = await client.query(`
    SELECT tipo_documento, count(*)::int AS n, count(DISTINCT ordem_servico_id)::int AS os_distintas
    FROM fiscal_documentos_vinculados GROUP BY tipo_documento`);
  console.log('  dados por tipo:', r5b.rows.map(r=>`${r.tipo_documento}=${r.n} (${r.os_distintas} OS)`).join(', ') || 'vazio');

  console.log('\n=== 6. clientes vencimento_padrao/tipo_cobranca (amostra) ===');
  const r6 = await client.query(`
    SELECT vencimento_padrao, tipo_cobranca, count(*)::int AS n FROM clientes
    GROUP BY 1,2 ORDER BY n DESC LIMIT 10`);
  r6.rows.forEach(r => console.log(`  venc=${r.vencimento_padrao} | cobranca=${r.tipo_cobranca} | n=${r.n}`));

  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });