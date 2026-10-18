import pg from "pg";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

// Verify vehicles
const r = await c.query(`
  SELECT v.placa, v.tipo_veiculo, v.status, p.nome_completo
  FROM veiculos v
  LEFT JOIN prestadores p ON v.prestador_vinculado::text = p.id::text
  WHERE v.placa LIKE 'ABC-%' OR v.placa LIKE 'DEF-%' OR v.placa LIKE 'GHI-%'
`);

console.log("Vehicles seeded:");
for (const row of r.rows) {
  console.log(`  ${row.placa} ${row.tipo_veiculo || "N/I"} [${row.status}] → ${row.nome_completo || "N/I"}`);
}

// Verify RPC
const rpc = await c.query(`SELECT * FROM f_buscar_prestadores_compativeis('00000000-0000-0000-0000-000000000000')`);
console.log(`\nRPC test: ${rpc.rows.length} rows (expected 0 for invalid UUID)`);

await c.end();
console.log("\n✅ Verification complete");
