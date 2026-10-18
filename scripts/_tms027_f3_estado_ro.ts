const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });
  await c.connect();

  const sections = {
    'ULTIMAS OS': `SELECT numero, status, cliente::text AS cliente, prestador::text AS prestador, origem, destino, data, tipo_operacao, LEFT(observacoes,60) AS obs, created_at FROM ordens_servico ORDER BY created_at DESC LIMIT 8`,
    'ALOCACOES PRESTADOR HML': `SELECT ae.id, ae.ordem_servico_id::text AS os, ae.status, ae.data_escala, ae.origem, ae.destino, ae.tipo_veiculo, ae.placa, ae.prestador_id::text AS prestador, ae.aceite_prestador, ae.created_at FROM alocacoes_escala ae WHERE ae.prestador_id = 'e6646799-fbac-453e-a3ef-afdfc01a7085' ORDER BY ae.created_at DESC LIMIT 10`,
    'CLIENTES': `SELECT id, razao_social, nome_fantasia, cnpj, status FROM clientes ORDER BY created_at DESC LIMIT 10`,
    'VEICULOS': `SELECT id, placa, veiculo_tipo, tipo_veiculo, status, motorista_id::text AS motorista, prestador_vinculado::text AS prestador FROM veiculos LIMIT 15`,
    'PRESTADOR HML': `SELECT id, nome_completo, status, auth_user_id::text AS auth, email, cpf_cnpj FROM prestadores WHERE id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'`,
  };

  for (const [name, sql] of Object.entries(sections)) {
    const r = await c.query(sql);
    console.log(`\n=== ${name} (${r.rows.length}) ===`);
    console.log(JSON.stringify(r.rows, null, 2));
  }
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
