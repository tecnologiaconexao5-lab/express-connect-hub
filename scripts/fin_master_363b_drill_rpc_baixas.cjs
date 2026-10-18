// FIN-MASTER-363B — DRILL-DOWN: baixas sem conta + RPC + CHECK constraints
// 100% READ-ONLY.
const { Client } = require('pg');
const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function main() {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();

  console.log('─── A. TODAS AS BAIXAS (detalhe completo) ───');
  const baixas = await c.query(`
    SELECT id::text, titulo_tabela, titulo_id::text, valor_baixado, valor_original,
           data_baixa, forma_pagamento, conta_financeira_id::text, estornada,
           observacao, created_at
    FROM financeiro_baixas ORDER BY created_at
  `);
  baixas.rows.forEach(b => console.log(
    `${b.id.slice(0,8)} | ${b.titulo_tabela} | titulo=${b.titulo_id ? b.titulo_id.slice(0,8) : 'NULL'} | R$ ${Number(b.valor_baixado).toFixed(2)} (orig=${b.valor_original===null?'NULL':Number(b.valor_original).toFixed(2)}) | ${String(b.data_baixa).slice(0,10)} | forma=${b.forma_pagamento} | conta=${b.conta_financeira_id ? b.conta_financeira_id.slice(0,8) : 'NULL'} | est=${b.estornada} | obs="${String(b.observacao||'').slice(0,60)}" | criada=${String(b.created_at).slice(0,19)}`
  ));

  console.log('\n─── B. RPC f_registrar_baixa_financeira — aceita conta NULL? ───');
  const rpc = await c.query(`
    SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_registrar_baixa_financeira'
  `);
  if (rpc.rows.length) {
    const def = rpc.rows[0].def;
    // Procurar tratamento de p_conta_financeira_id
    const linhas = def.split('\n').filter(l => /conta_financeira|NULL/i.test(l));
    console.log('Linhas relevantes da RPC sobre conta_financeira:');
    linhas.forEach(l => console.log('   ' + l.trim()));
    console.log('\nAssinatura:');
    console.log('   ' + def.split('\n').find(l => l.includes('FUNCTION')) || '(não extraída)');
  } else {
    console.log('RPC NÃO ENCONTRADA');
  }

  console.log('\n─── C. CHECK constraints de status ───');
  for (const t of ['financeiro_receber','financeiro_pagar','pagamentos_prestadores']) {
    const chk = await c.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'c'
    `, [t]);
    console.log(`${t}: ${chk.rows.length} CHECK constraints`);
    chk.rows.filter(r => /status/i.test(r.def)).forEach(r => console.log(`   ${r.conname}: ${r.def}`));
  }

  console.log('\n─── D. RPC f_confirmar_pagamento_prestador — conta obrigatória? ───');
  const rpc2 = await c.query(`
    SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_confirmar_pagamento_prestador'
  `);
  if (rpc2.rows.length) {
    const def = rpc2.rows[0].def;
    const linhas = def.split('\n').filter(l => /conta_financeira|v_conta|RAISE/i.test(l));
    linhas.slice(0, 15).forEach(l => console.log('   ' + l.trim()));
  }

  console.log('\n─── E. f_estornar_baixa_financeira — reverte status do título? ───');
  const rpc3 = await c.query(`
    SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_estornar_baixa_financeira'
  `);
  if (rpc3.rows.length) {
    const def = rpc3.rows[0].def;
    const linhas = def.split('\n').filter(l => /UPDATE|status|aberto|parcial/i.test(l));
    linhas.slice(0, 12).forEach(l => console.log('   ' + l.trim()));
  }

  await c.end();
}
main().catch(e => { console.error('ERRO FATAL:', e.message); process.exit(1); });
