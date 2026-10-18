const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres'
});

async function main() {
  await c.connect();

  // 1. Check RPC source for f_registrar_baixa_financeira
  const rpc = await c.query(`SELECT prosrc FROM pg_proc WHERE proname = 'f_registrar_baixa_financeira'`);
  console.log("=== RPC SOURCE (first 3000 chars) ===");
  console.log(rpc.rows[0]?.prosrc?.substring(0, 3000));

  // 2. Check financeiro_pagar columns
  const cols = await c.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'financeiro_pagar' ORDER BY ordinal_position`);
  console.log("\n=== financeiro_pagar COLUMNS ===");
  cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}) nullable=${r.is_nullable}`));

  // 3. Check trigger M66 source (how financeiro_pagar is created)
  const trg = await c.query(`SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_escala'`);
  console.log("\n=== TRIGGER M66 SOURCE (first 2000 chars) ===");
  console.log(trg.rows[0]?.prosrc?.substring(0, 2000));

  // 4. Check the specific NULL record context
  const nullRec = await c.query(`SELECT * FROM financeiro_pagar WHERE id = '26e05ffe-9180-4d2b-b199-e697db3116b1'`);
  console.log("\n=== NULL valor RECORD ===");
  console.log(JSON.stringify(nullRec.rows[0], null, 2));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
