import pg from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const CLIENTE_ID = "34ed2cd5-efc2-41e0-9d2b-5a91b20924bd";

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log("=== Criando OS (alocacoes_escala) ===");
  for (let i = 0; i < 5; i++) {
    const r = await client.query(`
      INSERT INTO alocacoes_escala (cliente_id, data_escala, tipo_veiculo, origem, destino)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
      CLIENTE_ID,
      new Date(Date.now() + (i - 2) * 86400000).toISOString().split('T')[0],
      i % 2 === 0 ? 'VUC' : 'TOCO',
      'São Paulo, SP',
      i % 2 === 0 ? 'Rio de Janeiro, RJ' : 'Belo Horizonte, MG',
    ]);
    console.log(`  OS ${i+1}: ${r.rows[0].id} (${i % 2 === 0 ? 'VUC' : 'TOCO'})`);
  }
  console.log("✅ OS criadas");

  console.log("\n=== Criando Financeiro ===");
  const r2 = await client.query(`
    INSERT INTO financeiro_receber (id, cliente_id, descricao, valor, vencimento, status, created_at, updated_at)
    VALUES
      (gen_random_uuid(), $1, 'Serviço de Transporte - Mês', 1500.00, $2, 'Pendente', NOW(), NOW()),
      (gen_random_uuid(), $1, 'Frete - Nota Fiscal 1234', 3200.50, $3, 'Pago', NOW(), NOW()),
      (gen_random_uuid(), $1, 'Taxa de Armazenagem', 890.75, $4, 'Vencido', NOW(), NOW())
    ON CONFLICT DO NOTHING
  `, [
    CLIENTE_ID,
    new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
  ]);
  console.log("✅ Financeiro criado");

  // Verify
  const verifyOS = await client.query(
    `SELECT id, status, cliente_id, data_escala, origem, destino
     FROM alocacoes_escala WHERE cliente_id = $1 ORDER BY data_escala LIMIT 5`,
    [CLIENTE_ID]
  );
  console.log(`\n=== Verificação: ${verifyOS.rows.length} OS para cliente ${CLIENTE_ID} ===`);
  for (const os of verifyOS.rows) {
    console.log(`  ${os.id.substring(0, 8)}... | status=${os.status} | data=${os.data_escala} | ${os.origem} -> ${os.destino}`);
  }

  const verifyFin = await client.query(
    `SELECT id, descricao, valor, status, vencimento
     FROM financeiro_receber WHERE cliente_id = $1 ORDER BY vencimento LIMIT 5`,
    [CLIENTE_ID]
  );
  console.log(`\n=== Verificação: ${verifyFin.rows.length} financeiro para cliente ${CLIENTE_ID} ===`);
  for (const f of verifyFin.rows) {
    console.log(`  ${f.id.substring(0, 8)}... | ${f.descricao} | R$ ${f.valor} | status=${f.status} | ${f.vencimento}`);
  }

  await client.end();
}

main().catch(e => console.error(e));
