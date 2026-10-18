const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });
(async () => {
  await c.connect();

  const fp = await c.query("SELECT id, os_id, prestador, valor, status, created_at, updated_at FROM financeiro_pagar WHERE id='9f2be89f-5ece-4cc5-be29-50010b64e64e'");
  console.log('FP:', JSON.stringify(fp.rows[0]));

  const baixa = await c.query("SELECT id, titulo_id, valor_original, valor_baixado, saldo_restante, estornada, data_baixa, conta_financeira_id FROM financeiro_baixas WHERE id='286c2c2d-90e4-403a-9692-8e68ccfd2a6c'");
  console.log('BAIXA:', JSON.stringify(baixa.rows[0]));

  const pp = await c.query("SELECT id, os_id, prestador_id, valor_liquido, valor_servicos, status_pagamento, status FROM pagamentos_prestadores WHERE id='7461daf6-438b-43b3-abde-4d30e1609574'");
  console.log('PP:', JSON.stringify(pp.rows[0]));

  const dupBaixa = await c.query("SELECT id, valor_baixado, saldo_restante FROM financeiro_baixas WHERE titulo_id='9f2be89f-5ece-4cc5-be29-50010b64e64e' AND estornada=false ORDER BY created_at");
  console.log('TODAS BAIXAS FP:', JSON.stringify(dupBaixa.rows));

  const outroFP = await c.query("SELECT id, valor, status FROM financeiro_pagar WHERE os_id='58e5751e-bd54-43c5-9bcf-55fe4e575e6b' AND id != '9f2be89f-5ece-4cc5-be29-50010b64e64e'");
  console.log('OUTROS FP MESMO OS_ID:', JSON.stringify(outroFP.rows));

  await c.end();
})();
