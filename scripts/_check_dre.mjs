import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const r = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='financeiro_pagar' AND column_name = 'is_teste'`);
  console.log("is_teste exists:", r.rows.length > 0 ? "YES" : "NO");
  // Also check what the current month looks like for DRE
  const mes = new Date().toISOString().slice(0,7);
  const inicio = `${mes}-01`;
  const fim = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).toISOString().split("T")[0];
  const dre = await c.query(`
    SELECT count(*) as total, sum(valor) as total_valor
    FROM financeiro_pagar
    WHERE is_teste = false
      AND os_id IS NULL
      AND status NOT IN ('cancelado','cancelada')
      AND data_vencimento >= $1 AND data_vencimento <= $2
  `, [inicio, fim]);
  console.log(`\nDRE period ${inicio} to ${fim}:`);
  console.log(`  titles: ${dre.rows[0].total}`);
  console.log(`  total valor: ${dre.rows[0].total_valor}`);
  // Show categories
  const cats = await c.query(`
    SELECT categoria, plano_contas, count(*) as qtd, sum(valor) as total
    FROM financeiro_pagar
    WHERE is_teste = false AND os_id IS NULL
      AND status NOT IN ('cancelado','cancelada')
      AND data_vencimento >= $1 AND data_vencimento <= $2
    GROUP BY categoria, plano_contas
    ORDER BY total DESC
  `, [inicio, fim]);
  console.log("\nCategories in DRE period:");
  cats.rows.forEach(r => console.log(`  ${r.categoria || 'null'} | ${r.plano_contas || 'null'} | ${r.qtd} titles | R$ ${Number(r.total).toFixed(2)}`));
  await c.end();
})();
