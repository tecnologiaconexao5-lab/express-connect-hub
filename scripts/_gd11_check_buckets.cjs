const { Client } = require("pg");

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const b = await client.query(
      "SELECT name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY name"
    );
    console.log("=== BUCKETS (" + b.rowCount + ") ===");
    b.rows.forEach(r =>
      console.log(`- ${r.name} | public=${r.public} | limit=${r.file_size_limit ?? "-"}`)
    );

    const t = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name IN
       ('documentos_prestadores','documentos_metadata','prestadores_documentos','propostas','propostas_documentos','orcamentos')
       ORDER BY table_name`
    );
    console.log("=== TABELAS ===");
    t.rows.forEach(r => console.log("- " + r.table_name));

    const cols = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name='documentos_prestadores' ORDER BY ordinal_position`
    );
    console.log("=== documentos_prestadores cols ===");
    cols.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));

    const pol = await client.query(
      `SELECT policyname, cmd FROM pg_policies
       WHERE schemaname='storage' AND tablename='objects' ORDER BY policyname`
    );
    console.log("=== storage.objects policies ===");
    pol.rows.forEach(r => console.log(`- ${r.policyname} [${r.cmd}]`));
  } finally {
    await client.end();
  }
})().catch(e => { console.error("ERRO:", e.message); process.exit(1); });
