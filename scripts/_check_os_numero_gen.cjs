/* READ-ONLY: funcoes/triggers que geram numero de OS + indices/constraints do numero */
const fs = require("fs");
const { Client } = require("pg");
const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const fns = await c.query(
    `SELECT p.proname, n.nspname
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname IN ('public','auth') AND p.prosrc ILIKE '%OS-%'`
  );
  console.log("== funcoes com literal OS- ==");
  for (const r of fns.rows) console.log(`  ${r.nspname}.${r.proname}`);

  const seqs = await c.query(
    `SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename`
  );
  console.log("== sequences public ==", seqs.rows.map((r) => r.sequencename).join(", ") || "(nenhuma)");

  const uq = await c.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid='public.ordens_servico'::regclass AND contype IN ('u','p')`
  );
  console.log("== unique/pk de ordens_servico ==");
  for (const r of uq.rows) console.log(`  ${r.conname}: ${r.def}`);

  const trg = await c.query(
    `SELECT tgname, pg_get_triggerdef(oid) AS def FROM pg_trigger
      WHERE tgrelid='public.ordens_servico'::regclass AND NOT tgisinternal`
  );
  console.log("== triggers de ordens_servico ==");
  for (const r of trg.rows) console.log(`  ${r.tgname}: ${r.def.slice(0, 120)}`);

  const nums = await c.query(
    `SELECT numero FROM public.ordens_servico ORDER BY created_at DESC LIMIT 5`
  );
  console.log("== ultimos numeros ==", nums.rows.map((r) => r.numero).join(", "));

  await c.end();
})().catch((e) => { console.error("ERRO:", e.message); process.exit(2); });
