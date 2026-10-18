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

  // Delete old test OS records
  console.log("=== Limpando OS antigas ===");
  const del = await client.query(
    `DELETE FROM ordens_servico WHERE cliente_id = $1 AND (numero IS NULL OR numero LIKE 'TESTE_%' OR numero LIKE 'FIX_%')`,
    [CLIENTE_ID]
  );
  console.log(`  ${del.rowCount} registros removidos`);

  // Create proper OS records
  console.log("\n=== Criando OS reais ===");
  const osData = [
    { num: "OS-001/2026", origem: "São Paulo, SP", destino: "Rio de Janeiro, RJ", data: "2026-07-01", valor: 1500.00, carga: "Eletrônicos", status: "em_andamento" },
    { num: "OS-002/2026", origem: "São Paulo, SP", destino: "Belo Horizonte, MG", data: "2026-07-02", valor: 3200.50, carga: "Móveis", status: "agendada" },
    { num: "OS-003/2026", origem: "Campinas, SP", destino: "São Paulo, SP", data: "2026-06-28", valor: 890.75, carga: "Alimentos", status: "concluida" },
    { num: "OS-004/2026", origem: "São Paulo, SP", destino: "Santos, SP", data: "2026-07-03", valor: 2500.00, carga: "Produtos Químicos", status: "agendada" },
    { num: "OS-005/2026", origem: "São Paulo, SP", destino: "Curitiba, PR", data: "2026-06-30", valor: 4100.00, carga: "Peças Automotivas", status: "em_andamento" },
  ];

  for (const os of osData) {
    await client.query(`
      INSERT INTO ordens_servico (id, numero, cliente_id, origem, destino, data_servico, valor_cliente, carga_descricao, status, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    `, [os.num, CLIENTE_ID, os.origem, os.destino, os.data, os.valor, os.carga, os.status]);
    console.log(`  ✅ ${os.num} criada`);
  }

  // Update financeiro records with proper status and fatura
  console.log("\n=== Atualizando financeiro ===");
  await client.query(`
    UPDATE financeiro_receber SET
      status = 'pago',
      fatura = 'FAT-001/2026'
    WHERE cliente_id = $1 AND status = 'Pago'
  `, [CLIENTE_ID]);

  await client.query(`
    UPDATE financeiro_receber SET
      status = 'vencida',
      fatura = 'FAT-002/2026'
    WHERE cliente_id = $1 AND status = 'Vencido'
  `, [CLIENTE_ID]);

  await client.query(`
    UPDATE financeiro_receber SET
      status = 'a_vencer',
      fatura = 'FAT-003/2026'
    WHERE cliente_id = $1 AND status = 'Pendente'
  `, [CLIENTE_ID]);

  console.log("  ✅ Status e faturas atualizados");

  // Verify
  console.log("\n=== Verificação ===");
  const os = await client.query(
    `SELECT numero, status, origem, destino, valor_cliente, carga_descricao
     FROM ordens_servico WHERE cliente_id = $1 AND numero IS NOT NULL AND numero NOT LIKE 'TESTE_%' ORDER BY data_servico`,
    [CLIENTE_ID]
  );
  console.log(`OS: ${os.rows.length}`);
  for (const r of os.rows) {
    console.log(`  ${r.numero} | ${r.status} | ${r.origem} -> ${r.destino} | R$ ${r.valor_cliente} | ${r.carga_descricao}`);
  }

  const fin = await client.query(
    `SELECT fatura, descricao, valor, data_vencimento, status
     FROM financeiro_receber WHERE cliente_id = $1 ORDER BY data_vencimento`,
    [CLIENTE_ID]
  );
  console.log(`\nFinanceiro: ${fin.rows.length}`);
  for (const r of fin.rows) {
    console.log(`  ${r.fatura} | ${r.descricao} | R$ ${r.valor} | ${r.data_vencimento} | ${r.status}`);
  }

  await client.end();
}

main().catch(e => console.error(e));
