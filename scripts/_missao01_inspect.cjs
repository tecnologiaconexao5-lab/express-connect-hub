const { Client } = require("pg");
require("dotenv").config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async (s, p) => (await c.query(s, p)).rows;
  const fks = await q(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.reembolsos_prestador'::regclass AND contype='f'`);
  console.log("FKs:", JSON.stringify(fks, null, 2));
  const buckets = await q(`SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id IN ('documentos_operacionais','contratos','documentos','prestadores') ORDER BY id`);
  console.log("BUCKETS:", JSON.stringify(buckets, null, 2));
  const cols = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes_contratos' AND column_name IN ('anexo_url','anexo_nome')`);
  console.log("CONTRATO COLS:", JSON.stringify(cols, null, 2));
  const dm = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='documentos_metadata' ORDER BY ordinal_position`);
  console.log("META COLS:", dm.map(r=>r.column_name).join(","));
  await c.end();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
