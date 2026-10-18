const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });
(async () => {
  await c.connect();
  const p1 = await c.query("SELECT id, nome_completo, cpf_cnpj FROM prestadores WHERE id = '49042fec-2376-41d4-8ece-f1efe3d48dfc'");
  console.log('FP1 prestador:', p1.rows.length ? JSON.stringify(p1.rows[0]) : 'NAO ENCONTRADO');
  const os1 = await c.query("SELECT id, status, romaneio, created_at FROM ordens_servico WHERE id = 'a2ac3c46-b36f-4352-a1e7-dfecc1200387'");
  console.log('FP1 OS:', JSON.stringify(os1.rows[0]));
  const os2 = await c.query("SELECT id, status, romaneio, created_at FROM ordens_servico WHERE id = 'ea967070-5553-497f-8528-c19048ed5932'");
  console.log('FP2 OS:', JSON.stringify(os2.rows[0]));
  const os3 = await c.query("SELECT id, status, romaneio, created_at FROM ordens_servico WHERE id = 'ca9f55b2-47eb-437f-8ea1-55263597e862'");
  console.log('FP3 OS:', JSON.stringify(os3.rows[0]));
  const os7 = await c.query("SELECT id, status, romaneio, created_at FROM ordens_servico WHERE id = '3db46421-e706-4ca4-8195-1c7a07f3135c'");
  console.log('FP7 OS:', JSON.stringify(os7.rows[0]));
  const fp1 = await c.query("SELECT * FROM financeiro_pagar WHERE id = '9b2e56ba-0457-42a7-b731-2daba9d6ea26'");
  const r = fp1.rows[0];
  console.log('FP1 full: prestador=' + r.prestador + ', valor=' + r.valor + ', status=' + r.status + ', categoria=' + r.categoria);
  await c.end();
})();
