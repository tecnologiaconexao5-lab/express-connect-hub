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

  console.log("=== Criando OS em ordens_servico ===");

  // Check existing OS for this client
  const existingOS = await client.query(
    `SELECT COUNT(*) FROM ordens_servico WHERE cliente_id = $1`,
    [CLIENTE_ID]
  );
  console.log(`OS existentes para cliente: ${existingOS.rows[0].count}`);

  if (parseInt(existingOS.rows[0].count) === 0) {
    const osData = [
      { numero: "OS-001/2026", origem: "São Paulo, SP", destino: "Rio de Janeiro, RJ", data: "2026-07-01", valor: 1500.00, carga: "Eletrônicos", status: "em_andamento" },
      { numero: "OS-002/2026", origem: "São Paulo, SP", destino: "Belo Horizonte, MG", data: "2026-07-02", valor: 3200.50, carga: "Móveis", status: "agendada" },
      { numero: "OS-003/2026", origem: "Campinas, SP", destino: "São Paulo, SP", data: "2026-06-28", valor: 890.75, carga: "Alimentos", status: "concluida" },
      { numero: "OS-004/2026", origem: "São Paulo, SP", destino: "Santos, SP", data: "2026-07-03", valor: 2500.00, carga: "Produtos Químicos", status: "agendada" },
      { numero: "OS-005/2026", origem: "São Paulo, SP", destino: "Curitiba, PR", data: "2026-06-30", valor: 4100.00, carga: "Peças Automotivas", status: "em_andamento" },
    ];

    for (const os of osData) {
      await client.query(`
        INSERT INTO ordens_servico (id, numero, cliente_id, origem, destino, data_servico, valor_cliente, carga_descricao, status, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      `, [os.numero, CLIENTE_ID, os.origem, os.destino, os.data, os.valor, os.carga, os.status]);
      console.log(`  ✅ ${os.numero} criada`);
    }
  } else {
    console.log("  OS já existem, pulando criação.");
  }

  // Update financeiro_receber to add data_vencimento
  console.log("\n=== Atualizando financeiro_receber ===");
  const update1 = await client.query(
    `UPDATE financeiro_receber SET data_vencimento = vencimento WHERE cliente_id = $1 AND data_vencimento IS NULL`,
    [CLIENTE_ID]
  );
  console.log(`  ${update1.rowCount} registros atualizados com data_vencimento`);

  // Add more financeiro records if needed
  const existingFin = await client.query(
    `SELECT COUNT(*) FROM financeiro_receber WHERE cliente_id = $1`,
    [CLIENTE_ID]
  );
  console.log(`  Total financeiro para cliente: ${existingFin.rows[0].count}`);

  if (parseInt(existingFin.rows[0].count) < 3) {
    await client.query(`
      INSERT INTO financeiro_receber (id, cliente_id, descricao, fatura, valor, data_vencimento, status, created_at, updated_at)
      VALUES
        (gen_random_uuid(), $1, 'Serviço de Transporte - Julho', 'FAT-001/2026', 5800.00, '2026-08-15', 'a_vencer', NOW(), NOW()),
        (gen_random_uuid(), $1, 'Frete - NF 5678', 'FAT-002/2026', 3200.50, '2026-07-10', 'pago', NOW(), NOW()),
        (gen_random_uuid(), $1, 'Taxa de Armazenagem', 'FAT-003/2026', 890.75, '2026-06-28', 'vencida', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `, [CLIENTE_ID]);
    console.log("  ✅ Financeiro adicional criado");
  }

  // Verify
  console.log("\n=== Verificação final ===");
  const os = await client.query(
    `SELECT id, numero, status, origem, destino, valor_cliente, carga_descricao
     FROM ordens_servico WHERE cliente_id = $1 ORDER BY data_servico LIMIT 5`,
    [CLIENTE_ID]
  );
  console.log(`OS na tabela ordens_servico: ${os.rows.length}`);
  for (const r of os.rows) {
    console.log(`  ${r.numero} | ${r.status} | ${r.origem} -> ${r.destino} | R$ ${r.valor_cliente} | ${r.carga_descricao}`);
  }

  const fin = await client.query(
    `SELECT id, fatura, descricao, valor, data_vencimento, status
     FROM financeiro_receber WHERE cliente_id = $1 ORDER BY data_vencimento LIMIT 5`,
    [CLIENTE_ID]
  );
  console.log(`\nFinanceiro na tabela financeiro_receber: ${fin.rows.length}`);
  for (const r of fin.rows) {
    console.log(`  ${r.fatura} | ${r.descricao} | R$ ${r.valor} | ${r.data_vencimento} | ${r.status}`);
  }

  await client.end();
}

main().catch(e => console.error(e));
