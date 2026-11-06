const { Client } = require("pg");

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const pol = await client.query(
      `SELECT policyname, cmd, roles, qual, with_check
       FROM pg_policies
       WHERE schemaname='storage' AND tablename='objects'
         AND (policyname LIKE 'documentos_operacionais%' OR policyname LIKE 'docprestadores%')
       ORDER BY policyname`
    );
    console.log("=== policies ===");
    pol.rows.forEach(r => {
      console.log(`--- ${r.policyname} [${r.cmd}] roles=${r.roles}`);
      console.log("  qual:", r.qual);
      console.log("  check:", r.with_check);
    });

    const cols = await client.query(
      `SELECT column_name, is_nullable, column_default, data_type
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name='documentos_metadata'
       ORDER BY ordinal_position`
    );
    console.log("=== documentos_metadata ===");
    cols.rows.forEach(r =>
      console.log(`- ${r.column_name} (${r.data_type}) null=${r.is_nullable} default=${r.column_default}`)
    );

    const sample = await client.query(
      `SELECT id, url, nome, tipo, modulo_origem, status_ia, tenant_id
       FROM public.documentos_metadata LIMIT 3`
    );
    console.log("=== sample documentos_metadata ===");
    sample.rows.forEach(r => console.log(JSON.stringify(r)));
  } finally {
    await client.end();
  }
})().catch(e => { console.error("ERRO:", e.message); process.exit(1); });
