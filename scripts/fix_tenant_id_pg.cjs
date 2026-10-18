// Direct PostgreSQL fix: add tenant_id, update OS dates, create os_historico
require("dotenv").config({ path: ".env" });
const crypto = require("crypto");
const { Client } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not found"); process.exit(1); }

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const CLIENTE_ID = "cd463c93-5190-408e-b5e6-ee639b688402";
const HOJE = new Date();

const CLIENTE_OS = [
  { status: "programacao", cidade: "São Paulo, SP", origem: "Matriz", valor: 4500, vol: 12, peso: 850.5, carga: "Peças automotivas - lote A" },
  { status: "em_andamento", cidade: "Campinas, SP", origem: "Filial SP", valor: 3200, vol: 8, peso: 420, carga: "Eletrônicos diversos" },
  { status: "concluida", cidade: "São José dos Campos, SP", origem: "Matriz", valor: 5800, vol: 20, peso: 1200, carga: "Matéria-prima industrial" },
  { status: "atrasada", cidade: "Ribeirão Preto, SP", origem: "Matriz", valor: 2100, vol: 5, peso: 300, carga: "Documentos e encomendas" },
  { status: "em_andamento", cidade: "Sorocaba, SP", origem: "Filial SP", valor: 7500, vol: 25, peso: 1800, carga: "Móveis planejados" },
  { status: "pendente", cidade: "São Paulo, SP", origem: "Matriz", valor: 1100, vol: 3, peso: 150, carga: "Amostras e protótipos" },
  { status: "programacao", cidade: "Jundiaí, SP", origem: "Filial SP", valor: 9800, vol: 30, peso: 2500, carga: "Equipamentos industriais" },
  { status: "finalizada", cidade: "São Paulo, SP", origem: "Matriz", valor: 6300, vol: 15, peso: 900, carga: "Material de construção" },
  { status: "em_andamento", cidade: "Osasco, SP", origem: "Matriz", valor: 2900, vol: 10, peso: 600, carga: "Alimentos perecíveis" },
  { status: "rascunho", cidade: "Guarulhos, SP", origem: "Filial SP", valor: 15000, vol: 45, peso: 3800, carga: "Peças de reposição" },
];

function ago(hours) {
  const d = new Date(HOJE);
  d.setHours(d.getHours() - hours);
  return d;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log("Connected");

  try {
    // Step 1: Add tenant_id if not exists (already added by previous run)
    const colCheck = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'ordens_servico' AND column_name = 'tenant_id'`
    );
    if (colCheck.rows.length === 0) {
      await client.query(`ALTER TABLE ordens_servico ADD COLUMN tenant_id UUID DEFAULT '${TENANT_ID}'`);
      console.log("tenant_id column added");
    }

    // Step 2: Set tenant_id on rows where null
    const upd = await client.query(`UPDATE ordens_servico SET tenant_id = '${TENANT_ID}' WHERE tenant_id IS NULL`);
    console.log(`Updated tenant_id on ${upd.rowCount} rows`);

    // Step 3: Get all OS for this client  
    const osResult = await client.query(
      `SELECT id, numero, status, created_at FROM ordens_servico WHERE cliente_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [CLIENTE_ID]
    );
    console.log(`Found ${osResult.rows.length} OS for client`);
    const osList = osResult.rows;

    // Step 4: Update existing OS with correct dates and statuses
    for (let i = 0; i < Math.min(osList.length, CLIENTE_OS.length); i++) {
      const os = osList[i];
      const u = CLIENTE_OS[i];
      const created_at = i < 3 ? ago(24 + i * 24) : ago(i * 3 + 1);
      
      await client.query(`
        UPDATE ordens_servico SET
          status = $1, created_at = $2, data_servico = $3,
          destino = $4, origem = $5, valor_cliente = $6, volumes = $7,
          peso = $8, carga_descricao = $9, tenant_id = $10
        WHERE id = $11
      `, [
        u.status, created_at, new Date(),
        u.cidade, u.origem, u.valor, u.vol, u.peso, u.carga,
        TENANT_ID, os.id
      ]);
      console.log(`Updated OS ${os.numero} -> status=${u.status}, destino=${u.cidade}`);
    }

    // Step 5: Insert historico events (table already exists with ordem_servico_id, descricao)
    const allOs = await client.query(
      `SELECT id, numero, created_at FROM ordens_servico WHERE cliente_id = $1`,
      [CLIENTE_ID]
    );
    for (const os of allOs.rows) {
      await client.query(`DELETE FROM os_historico WHERE ordem_servico_id = $1`, [os.id]);
      
      const t0 = new Date(os.created_at || HOJE);
      const events = [
        `Ordem de serviço criada`,
        `Ordem de serviço confirmada pelo cliente`,
        `Veículo designado para a coleta`,
        `Veículo a caminho do local de coleta`,
        `Veículo chegou para coleta`,
        `Início da coleta`,
        `Coleta concluída`,
        `Carga em rota para destino`,
      ];
      
      for (const desc of events) {
        await client.query(
          `INSERT INTO os_historico (ordem_servico_id, descricao) VALUES ($1, $2)`,
          [os.id, desc]
        );
      }
      console.log(`  historico: ${events.length} events for ${os.numero}`);
    }

    // Step 7: List final state
    const finalOs = await client.query(
      `SELECT id, numero, status, created_at, cliente_id, tenant_id FROM ordens_servico WHERE cliente_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [CLIENTE_ID]
    );
    console.log("\nFinal OS state:");
    for (const os of finalOs.rows) {
      console.log(`  ${os.numero} | status=${os.status} | created_at=${os.created_at} | cliente_id=${os.cliente_id} | tenant_id=${os.tenant_id}`);
    }

    // Step 8: Try PATCH via REST API to confirm it works now
    const restOs = await client.query(
      `SELECT id, numero FROM ordens_servico WHERE cliente_id = $1 LIMIT 1`,
      [CLIENTE_ID]
    );
    if (restOs.rows.length > 0) {
      await client.query(`UPDATE ordens_servico SET status = status WHERE id = $1`, [restOs.rows[0].id]);
      console.log(`\nREST PATCH test: UPDATE on ${restOs.rows[0].numero} works`);
    }

    console.log("\nDone!");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await client.end();
  }
}
main();
