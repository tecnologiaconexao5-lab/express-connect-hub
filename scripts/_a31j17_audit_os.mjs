import pg from "pg";
import "dotenv/config";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();
  // 1) schema da coluna numero em ordens_servico (default, is_nullable, unique?)
  const col = await c.query(
    `SELECT column_name, is_nullable, column_default, data_type
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='ordens_servico' AND column_name IN ('numero','status','cliente_id','romaneio','numero_pedido')`
  );
  console.log("== colunas ordens_servico ==");
  for (const x of col.rows) console.log(JSON.stringify(x));

  // 2) constraints em numero
  const cons = await c.query(
    `SELECT conname, contype, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid='public.ordens_servico'::regclass AND contype IN ('u','c','p')`
  );
  console.log("== constraints ordens_servico ==");
  for (const x of cons.rows) console.log(x.conname + " :: " + x.def);

  // 3) triggers em ordens_servico
  const trg = await c.query(
    `SELECT tgname, pg_get_triggerdef(oid) AS def FROM pg_trigger
      WHERE tgrelid='public.ordens_servico'::regclass AND NOT tgisinternal`
  );
  console.log("== triggers ordens_servico ==");
  for (const x of trg.rows) console.log(x.tgname + " :: " + x.def);

  // 4) funcoes/rpcs possivelmente de numeracao
  const fns = await c.query(
    `SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace
       AND (proname ILIKE '%numero%' OR proname ILIKE '%sequencia%' OR proname ILIKE '%gerar%os%' OR proname ILIKE '%proxima%') ORDER BY 1`
  );
  console.log("== funcoes de numeracao ==");
  for (const x of fns.rows) console.log(x.proname);

  // 5) sequencias publicas
  const seq = await c.query(
    `SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY 1`
  );
  console.log("== sequencias publicas ==");
  for (const x of seq.rows) console.log(x.sequencename);

  // 6) tabelas de contador/sequencia
  const tab = await c.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public'
       AND (table_name ILIKE '%sequenc%' OR table_name ILIKE '%contador%' OR table_name ILIKE '%numeracao%' OR table_name ILIKE '%controle%numero%') ORDER BY 1`
  );
  console.log("== tabelas de numeracao ==");
  for (const x of tab.rows) console.log(x.table_name);

  // 7) exemplo de numeros atuais + amostra de id/numero
  const am = await c.query(`SELECT id, numero, status FROM public.ordens_servico ORDER BY created_at DESC LIMIT 5`);
  console.log("== amostra OS recentes ==");
  for (const x of am.rows) console.log(JSON.stringify(x));

  const cnt = await c.query(`SELECT COUNT(*)::int AS n FROM public.ordens_servico`);
  console.log("ordens_servico COUNT:", cnt.rows[0].n);

  await c.end();
}
main().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });