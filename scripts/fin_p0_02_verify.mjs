import pg from 'pg';
const client = new pg.Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });

async function main() {
  await client.connect();
  
  // Verify constraints
  const c = await client.query(`
    SELECT conrelid::regclass AS tabela, conname AS nome, convalidated AS validado,
           pg_get_constraintdef(oid) AS definicao
    FROM pg_constraint
    WHERE conrelid::regclass::text IN ('financeiro_pagar','financeiro_receber')
      AND contype='c' AND conname IN ('ck_fp_status','ck_fr_status')
    ORDER BY tabela
  `);
  console.log('=== CONSTRAINTS ===');
  c.rows.forEach(r => console.log(`${r.tabela}.${r.nome} valid=${r.validado}`));
  
  // Row counts
  const cnt = await client.query('SELECT (SELECT COUNT(*) FROM financeiro_pagar) AS pagar, (SELECT COUNT(*) FROM financeiro_receber) AS receber');
  console.log('\n=== ROW COUNTS ===');
  console.log('Pagar:', cnt.rows[0].pagar, '| Receber:', cnt.rows[0].receber);
  
  // NULL status
  const nulls = await client.query("SELECT id, is_teste, valor, descricao FROM financeiro_receber WHERE status IS NULL");
  console.log('\n=== NULL STATUS (test only?) ===');
  nulls.rows.forEach(r => console.log(`id=${r.id} teste=${r.is_teste} valor=${r.valor}`));
  
  // Rejection test
  console.log('\n=== REJECTION TEST ===');
  try {
    await client.query("INSERT INTO financeiro_pagar (id, status, valor, is_teste, data_vencimento) VALUES (gen_random_uuid(), 'INVALIDO', 100, true, '2026-09-11')");
    console.log('FAIL: Invalid insert accepted');
  } catch (e) {
    console.log('OK Rejected:', e.message.split('\n')[0]);
  }
  
  // Acceptance test
  console.log('\n=== ACCEPTANCE TEST ===');
  try {
    const rid = (await client.query('SELECT gen_random_uuid() as id')).rows[0].id;
    await client.query(`INSERT INTO financeiro_pagar (id, status, valor, is_teste, data_vencimento) VALUES ('${rid}', 'pendente', 0.01, true, '2026-09-11')`);
    console.log('OK Valid insert accepted');
    await client.query(`DELETE FROM financeiro_pagar WHERE id = '${rid}'`);
    console.log('Test row cleaned up');
  } catch (e) {
    console.log('FAIL Valid insert:', e.message);
  }
  
  // FIN-P0-01 regression: FRETEBRAS still atrasado?
  console.log('\n=== FIN-P0-01 REGRESSION: FRETEBRAS ===');
  const fret = await client.query("SELECT id, fornecedor, status, data_vencimento::text, valor FROM financeiro_pagar WHERE fornecedor = 'FRETEBRAS' LIMIT 1");
  if (fret.rows.length > 0) {
    const r = fret.rows[0];
    const hoje = new Date().toLocaleDateString('sv-SE', {timeZone: 'America/Sao_Paulo'});
    const venc = r.data_vencimento; // now YYYY-MM-DD text
    const efetivo = (venc && venc < hoje) ? 'atrasado' : r.status;
    console.log(`FRETEBRAS: status_db=${r.status} venc=${venc} hoje=${hoje} efetivo=${efetivo}`);
    console.log(efetivo === 'atrasado' ? 'OK FRETEBRAS = ATRASADO (regression pass)' : 'FAIL FRETEBRAS not atrasado');
  }
  
  await client.end();
}
main();
