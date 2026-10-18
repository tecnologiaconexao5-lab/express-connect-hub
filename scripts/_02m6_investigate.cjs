const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });

(async () => {
  await c.connect();
  console.log('=== 02M.6 — FP SEM PP: INVESTIGAÇÃO ===\n');

  // STEP 1: Find all FP that have no PP for the same os_id
  // FP.os_id is TEXT, PP.os_id is UUID — must cast
  const fps = await c.query(`
    SELECT fp.id, fp.os_id, fp.prestador, fp.valor, fp.status, fp.created_at, fp.updated_at
    FROM financeiro_pagar fp
    WHERE fp.os_id IS NOT NULL
      AND fp.os_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND NOT EXISTS (
        SELECT 1 FROM pagamentos_prestadores pp
        WHERE pp.os_id = fp.os_id::uuid
      )
    ORDER BY fp.created_at
  `);

  console.log(`TOTAL FP SEM PP (os_id sem match): ${fps.rows.length}\n`);
  const list = fps.rows;

  for (let i = 0; i < list.length; i++) {
    const fp = list[i];
    console.log(`\n${'='.repeat(70)}`);
    console.log(`FP ${i+1}/${list.length}: ${fp.id}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`  os_id:      ${fp.os_id}`);
    console.log(`  prestador:  ${fp.prestador}`);
    console.log(`  valor:      ${fp.valor}`);
    console.log(`  status:     ${fp.status}`);
    console.log(`  created_at: ${fp.created_at}`);
    console.log(`  updated_at: ${fp.updated_at}`);

    // Check if os_id is a real OS
    const os = await c.query(`SELECT id, cliente, prestador, status, romaneio, created_at FROM ordens_servico WHERE id = $1`, [fp.os_id]);
    if (os.rows.length > 0) {
      console.log(`  OS REAL: SIM — status=${os.rows[0].status}, prestador=${os.rows[0].prestador}, cliente=${os.rows[0].cliente}`);
    } else {
      console.log(`  OS REAL: NÃO (os_id não existe em ordens_servico)`);
    }

    // Check if os_id is a real allocation
    const aloc = await c.query(`SELECT id, prestador_id, cliente_id, valor_total, valor_repasse, status, created_at FROM alocacoes_escala WHERE id = $1`, [fp.os_id]);
    if (aloc.rows.length > 0) {
      console.log(`  ALOCAÇÃO: SIM — status=${aloc.rows[0].status}, valor_total=${aloc.rows[0].valor_total}, prestador_id=${aloc.rows[0].prestador_id}`);
    } else {
      console.log(`  ALOCAÇÃO: NÃO (os_id não existe em alocacoes_escala)`);
    }

    // Check PP for this os_id (any prestador)
    const ppAny = await c.query(`SELECT id, prestador_id, valor_liquido, status_pagamento, status FROM pagamentos_prestadores WHERE os_id = $1`, [fp.os_id]);
    if (ppAny.rows.length > 0) {
      console.log(`  PP QUALQUER: ${ppAny.rows.length} registro(s)`);
      ppAny.rows.forEach(r => {
        console.log(`    PP ${r.id}: prestador=${r.prestador_id}, valor=${r.valor_liquido}, status=${r.status}`);
      });
    } else {
      console.log(`  PP: ZERO registros para este os_id`);
    }

    // Check baixas
    const bxs = await c.query(`SELECT id, valor_original, valor_baixado, saldo_restante, estornada, data_baixa FROM financeiro_baixas WHERE titulo_id = $1`, [fp.id]);
    if (bxs.rows.length > 0) {
      console.log(`  BAIXAS: ${bxs.rows.length} registro(s)`);
      bxs.rows.forEach(r => {
        console.log(`    BX ${r.id}: original=${r.valor_original}, baixado=${r.valor_baixado}, saldo=${r.saldo_restante}, estornada=${r.estornada}, data=${r.data_baixa}`);
      });
    } else {
      console.log(`  BAIXAS: ZERO`);
    }

    // Check composicao_financeira_os
    const comp = await c.query(`SELECT id, os_id, valor_cliente, valor_prestador FROM composicao_financeira_os WHERE os_id = $1`, [fp.os_id]);
    if (comp.rows.length > 0) {
      console.log(`  COMPOSIÇÃO: valor_cliente=${comp.rows[0].valor_cliente}, valor_prestador=${comp.rows[0].valor_prestador}`);
    } else {
      console.log(`  COMPOSIÇÃO: não encontrada`);
    }

    // Check if prestador name matches any real prestador
    if (fp.prestador && fp.prestador.trim()) {
      const prest = await c.query(`SELECT id, nome_completo FROM prestadores WHERE nome_completo ILIKE $1 LIMIT 1`, [`%${fp.prestador.trim()}%`]);
      if (prest.rows.length > 0) {
        console.log(`  PRESTADOR REAL: SIM — id=${prest.rows[0].id}, nome=${prest.rows[0].nome_completo}`);
      } else {
        console.log(`  PRESTADOR REAL: NÃO (nenhum prestador com esse nome)`);
      }
    }
  }

  await c.end();
})();
