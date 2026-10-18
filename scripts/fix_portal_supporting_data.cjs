// Add alocacoes_escala, portal_ocorrencias, and fix financeiro for portal demo
require("dotenv").config({path:".env"});
const {Client} = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not found"); process.exit(1); }

const CLIENTE_ID = "cd463c93-5190-408e-b5e6-ee639b688402";
const TENANT_ID = "00000000-0000-0000-0000-000000000001";

async function main() {
  const c = new Client({connectionString: DATABASE_URL});
  await c.connect();
  console.log("Connected");

  // 1. Get client OS
  const osList = (await c.query("SELECT id, numero, status FROM ordens_servico WHERE cliente_id = $1 ORDER BY created_at DESC", [CLIENTE_ID])).rows;
  console.log(`Got ${osList.length} OS for client`);

  // 2. Create/update alocacoes_escala for each OS
  let placaIdx = 0;
  for (const os of osList.slice(0, 10)) {
    const exists = await c.query("SELECT id FROM alocacoes_escala WHERE ordem_servico_id = $1", [os.id]);
    if (exists.rows.length === 0) {
      const alocStatus = os.status === "concluida" || os.status === "entregue" || os.status === "finalizada" ? "concluida" 
        : os.status === "em_andamento" || os.status === "programacao" ? "aceita"
        : os.status === "atrasada" ? "em_rota"
        : "planejada";
      placaIdx++;
      await c.query(
        `INSERT INTO alocacoes_escala (ordem_servico_id, cliente_id, data_escala, tipo_veiculo, status, aceite_prestador, finalizada, placa, quantidade_entregas)
         VALUES ($1, $2, CURRENT_DATE, 'Carreta', $3, $4, $5, $6, $7)`,
        [os.id, CLIENTE_ID, alocStatus, alocStatus !== "planejada", alocStatus === "concluida", `PLA-${String(placaIdx).padStart(4,"0")}`, Math.floor(Math.random() * 5) + 1]
      );
      console.log(`  Created alocacao for ${os.numero} (status=${alocStatus})`);
    } else {
      console.log(`  alocacao exists for ${os.numero}`);
    }
  }

  // 3. Create portal_ocorrencias table if not exists
  await c.query(`
    CREATE TABLE IF NOT EXISTS portal_ocorrencias (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL DEFAULT 'outro',
      descricao TEXT,
      prioridade TEXT DEFAULT 'media',
      status TEXT DEFAULT 'aberta',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("portal_ocorrencias table ready");
  
  await c.query("DELETE FROM portal_ocorrencias WHERE cliente_id = $1", [CLIENTE_ID]);
  
  const ocorrencias = [
    { tipo: "atraso", descricao: "Entrega com atraso devido a congestionamento na via Dutra", prioridade: "alta", status: "aberta" },
    { tipo: "avaria", descricao: "Avaria identificada em uma caixa de equipamentos eletrônicos durante manuseio", prioridade: "media", status: "em_andamento" },
    { tipo: "reclamacao", descricao: "Cliente final reportou divergência na quantidade de volumes recebidos", prioridade: "alta", status: "resolvida" },
    { tipo: "informacao", descricao: "Solicitação de informação sobre status de entrega - protocolo AT-2026-0042", prioridade: "baixa", status: "fechada" },
    { tipo: "troca", descricao: "Solicitação de troca de endereço de entrega para a OS em andamento", prioridade: "media", status: "em_andamento" },
  ];
  
  for (const o of ocorrencias) {
    await c.query(
      `INSERT INTO portal_ocorrencias (cliente_id, tipo, descricao, prioridade, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [CLIENTE_ID, o.tipo, o.descricao, o.prioridade, o.status]
    );
  }
  console.log(`Created ${ocorrencias.length} portal_ocorrencias`);

  // 4. Update financeiro_receber - set some as paid
  const finResult = await c.query(
    "SELECT id, valor FROM financeiro_receber WHERE cliente_id = $1 ORDER BY data_vencimento DESC LIMIT 5",
    [CLIENTE_ID]
  );
  
  if (finResult.rows.length > 0) {
    // Set first 3 as paid
    for (let i = 0; i < Math.min(3, finResult.rows.length); i++) {
      const colCheck = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'financeiro_receber' AND column_name = 'data_pagamento'");
      const setClause = colCheck.rows.length > 0 ? "status = 'pago', data_pagamento = NOW()" : "status = 'pago'";
      await c.query(
        `UPDATE financeiro_receber SET ${setClause} WHERE id = $1`,
        [finResult.rows[i].id]
      );
      console.log(`  Updated financeiro ${finResult.rows[i].id} -> pago`);
    }
    // Leave rest as pendente/a_vencer
    for (let i = 3; i < finResult.rows.length; i++) {
      await c.query(
        "UPDATE financeiro_receber SET status = 'a_vencer' WHERE id = $1",
        [finResult.rows[i].id]
      );
    }
  }

  // 5. Set some OS to "entregue" status for graph/concluidasMes metrics
  const concluidas = (await c.query(
    "SELECT id, numero FROM ordens_servico WHERE cliente_id = $1 AND (status = 'concluida' OR status = 'finalizada') LIMIT 3",
    [CLIENTE_ID]
  )).rows;
  
  for (const os of concluidas) {
    await c.query("UPDATE ordens_servico SET status = 'entregue' WHERE id = $1", [os.id]);
    console.log(`  Updated ${os.numero} -> entregue`);
  }

  // 6. Update created_at for "entregue" OS to recent dates
  await c.query(
    `UPDATE ordens_servico SET created_at = NOW() - INTERVAL '1 day' * (random() * 3)::int
     WHERE cliente_id = $1 AND status = 'entregue'`,
    [CLIENTE_ID]
  );
  const entUpd = await c.query("SELECT COUNT(*) FROM ordens_servico WHERE cliente_id = $1 AND status = 'entregue'", [CLIENTE_ID]);
  console.log(`Updated ${entUpd.rows[0].count} entregue OS dates to recent`);

  // 7. Also ensure some financeiro a_vencer records exist for more realistic data
  const finCount = await c.query("SELECT COUNT(*) FROM financeiro_receber WHERE cliente_id = $1", [CLIENTE_ID]);
  if (parseInt(finCount.rows[0].count) < 5) {
    for (let i = 0; i < 5; i++) {
      await c.query(
        `INSERT INTO financeiro_receber (cliente_id, descricao, valor, vencimento, status)
         VALUES ($1, $2, $3, CURRENT_DATE + $4, 'a_vencer')`,
        [CLIENTE_ID, `Fatura referente ao serviço #${i+1}`, (Math.random() * 10000 + 1000).toFixed(2), (i * 15) + 5]
      );
    }
    console.log("Created 5 additional financeiro a_vencer records");
  }

  console.log("\nDone! All supporting data added.");
  await c.end();
}
main().catch(e => console.error(e.message));
