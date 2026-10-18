import pg from 'pg';
const client = new pg.Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });

async function main() {
  await client.connect();
  
  const r = await client.query(`
    SELECT 
      fb.titulo_tabela,
      fb.titulo_id,
      fb.valor_baixado,
      fb.data_baixa::text,
      COALESCE(fp.is_teste, fr.is_teste) as parent_is_teste,
      COALESCE(fp.fornecedor, fr.cliente) as parent_nome
    FROM financeiro_baixas fb
    LEFT JOIN financeiro_pagar fp ON fb.titulo_tabela = 'financeiro_pagar' AND fb.titulo_id::uuid = fp.id
    LEFT JOIN financeiro_receber fr ON fb.titulo_tabela = 'financeiro_receber' AND fb.titulo_id::uuid = fr.id
    WHERE fb.estornada = false
      AND fb.data_baixa >= date_trunc('month', CURRENT_DATE)
      AND fb.data_baixa < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
    ORDER BY fb.titulo_tabela, fb.data_baixa
  `);
  
  console.log('Baixas this month:');
  r.rows.forEach(row => {
    console.log(`  ${row.titulo_tabela} | ${row.parent_nome || 'NULL'} | R$${row.valor_baixado} | teste=${row.parent_is_teste} | ${row.data_baixa}`);
  });
  
  const testOnly = r.rows.filter(row => row.parent_is_teste === true);
  const realOnly = r.rows.filter(row => row.parent_is_teste === false);
  const testTotal = testOnly.reduce((a, b) => a + Number(b.valor_baixado), 0);
  const realTotal = realOnly.reduce((a, b) => a + Number(b.valor_baixado), 0);
  
  console.log(`\nTest baixas: ${testOnly.length} (R$${testTotal})`);
  console.log(`Real baixas: ${realOnly.length} (R$${realTotal})`);
  console.log(`Contamination: ${testTotal > 0 ? (testTotal / (testTotal + realTotal) * 100).toFixed(1) + '%' : '0%'}`);
  
  await client.end();
}
main();
