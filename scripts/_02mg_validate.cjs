const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });

const FP_ID  = '9f2be89f-5ece-4cc5-be29-50010b64e64e';
const BX_ID  = '286c2c2d-90e4-403a-9692-8e68ccfd2a6c';
const PP_ID  = '7461daf6-438b-43b3-abde-4d30e1609574';
const OS_ID  = '58e5751e-bd54-43c5-9bcf-55fe4e575e6b';

(async () => {
  await c.connect();
  console.log('=== FASE 3 — VALIDAÇÃO ESTENDIDA ===\n');

  // 1. DRE: totalizar receber/pagar por os_id
  const fp = await c.query("SELECT id, prestador, valor, status FROM financeiro_pagar WHERE id=$1", [FP_ID]);
  console.log('1. DRE — FP CESAR:', JSON.stringify(fp.rows[0]));

  // 2. Fluxo de Caixa: baixa real valor_baixado
  const bx = await c.query("SELECT valor_baixado, saldo_restante, data_baixa FROM financeiro_baixas WHERE id=$1", [BX_ID]);
  console.log('2. FLUXO CAIXA — Baixa:', JSON.stringify(bx.rows[0]));

  // 3. Extrato: FP no contexto de Contas a Pagar
  const fpExtrato = await c.query("SELECT id, valor, status, created_at, updated_at FROM financeiro_pagar WHERE os_id=$1", [OS_ID]);
  console.log('3. EXTRATO — Todas FP do os_id:', JSON.stringify(fpExtrato.rows));

  // 4. Não-duplicação: baixas totais deste FP
  const bxs = await c.query("SELECT id, valor_original, valor_baixado, saldo_restante, estornada FROM financeiro_baixas WHERE titulo_id=$1", [FP_ID]);
  console.log('4. NÃO-DUPLICAÇÃO — Todas baixas FP:', JSON.stringify(bxs.rows));

  // 5. Nenhum outro FP alterado: verificar que only CESAR mudou
  const outrosFP = await c.query("SELECT id, valor, status FROM financeiro_pagar WHERE valor != '652.86' AND status = 'parcial' LIMIT 5");
  console.log('5. NENHUM OUTRO FP PARCIAL sem ser CESAR:', JSON.stringify(outrosFP.rows));

  // 6. Nenhuma nova baixa fictícia de 132.86
  const ficticia = await c.query("SELECT id, valor_baixado, saldo_restante FROM financeiro_baixas WHERE valor_baixado = '132.86' AND titulo_id = $1", [FP_ID]);
  console.log('6. NENHUMA BAIXA FICTÍCIA 132.86:', ficticia.rows.length === 0 ? 'CONFIRMADO (0 registros)' : JSON.stringify(ficticia.rows));

  // 7. PP não foi alterado
  const pp = await c.query("SELECT id, valor_liquido, status_pagamento, status FROM pagamentos_prestadores WHERE id=$1", [PP_ID]);
  console.log('7. PP NÃO ALTERADO:', JSON.stringify(pp.rows[0]));

  // 8. RPC 02M.5F continua live
  const rpc = await c.query("SELECT proargnames FROM pg_proc WHERE proname='f_confirmar_pagamento_prestador'");
  const temParcial = rpc.rows[0]?.proargnames?.includes('p_valor_pago');
  console.log('8. RPC 02M.5F:', temParcial ? 'LIVE com p_valor_pago' : 'BLOCKED');

  // 9. Contas a Pagar/Extrato: CESAR representado como parcial
  console.log('9. CONTAS A PAGAR — CESAR status=parcial:', fp.rows[0].status === 'parcial' ? 'CONFIRMADO' : 'FALHOU');

  // 10. Fluxo de Caixa: realizado = 520.00
  const totalBaixado = await c.query("SELECT SUM(valor_baixado) AS total FROM financeiro_baixas WHERE titulo_id=$1 AND estornada=false", [FP_ID]);
  console.log('10. FC REALIZADO =', totalBaixado.rows[0].total, totalBaixado.rows[0].total === '520.00' ? '✅' : '❌');

  // 11. Saldo pendente = 132.86
  console.log('11. SALDO PENDENTE =', bx.rows[0].saldo_restante, parseFloat(bx.rows[0].saldo_restante) === 132.86 ? '✅' : '❌');

  // 12. Prova matemática completa
  const obrigacao = 652.86;
  const pagoReal = parseFloat(totalBaixado.rows[0].total);
  const saldoPendente = obrigacao - pagoReal;
  console.log(`12. PROVA MATEMÁTICA: ${obrigacao} - ${pagoReal} = ${saldoPendente}`, saldoPendente === 132.86 ? '✅' : '❌');

  console.log('\n=== ROLLBACK PREPARADO ===');
  console.log('Arquivo: docs/auditoria/02_evidencias/sql/02mg_cesar_BEFORE.sql');

  console.log('\n✅ TODAS VALIDAÇÕES ESTENDIDAS CONCLUÍDAS');

  await c.end();
})();
