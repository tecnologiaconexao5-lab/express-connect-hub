/* Verificacao READ-ONLY: schema de recrutamento_candidatos em producao (constraints/prioridade/stage) + lista canonica */
const fs = require("fs");
const { Client } = require("pg");

const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const cols = await c.query(
    `SELECT column_name, data_type, column_default, is_nullable
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name='recrutamento_candidatos'
       AND column_name IN ('stage','prioridade','validade_cnh','status_documental','prestador_id','tags','historico','observacoes_ia','data_entrada','data_atualizacao')
     ORDER BY ordinal_position`
  );
  console.log("== colunas-chave ==");
  for (const r of cols.rows) console.log(`  ${r.column_name}: ${r.data_type} default=${r.column_default} null=${r.is_nullable}`);

  const cons = await c.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint
     WHERE conrelid = 'public.recrutamento_candidatos'::regclass AND contype IN ('c','u','x')
     ORDER BY conname`
  );
  console.log("== constraints (c/u/x) ==");
  if (!cons.rows.length) console.log("  (nenhuma)");
  for (const r of cons.rows) console.log(`  ${r.conname}: ${r.def}`);

  const fk = await c.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint
     WHERE conrelid = 'public.recrutamento_candidatos'::regclass AND contype='f'`
  );
  console.log("== FKs ==");
  for (const r of fk.rows) console.log(`  ${r.conname}: ${r.def}`);

  const estagios = await c.query(
    `SELECT stage, count(*) FROM public.recrutamento_candidatos GROUP BY stage ORDER BY 2 DESC`
  );
  console.log("== stages existentes ==");
  for (const r of estagios.rows) console.log(`  ${r.stage}: ${r.count}`);

  const prio = await c.query(
    `SELECT prioridade, count(*) FROM public.recrutamento_candidatos GROUP BY prioridade`
  );
  console.log("== prioridades existentes ==");
  for (const r of prio.rows) console.log(`  ${r.prioridade}: ${r.count}`);

  const val = await c.query(
    `SELECT DISTINCT validade_cnh FROM public.recrutamento_candidatos LIMIT 10`
  );
  console.log("== validade_cnh distintos ==");
  for (const r of val.rows) console.log(`  [${r.validade_cnh}]`);

  // colunas novas ja existem?
  const novas = await c.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='recrutamento_candidatos'
       AND column_name IN ('preferencias_operacionais','respostas_situacionais')`
  );
  console.log("== colunas 000004/000005 ja presentes? ==", novas.rows.length ? novas.rows.map(r=>r.column_name).join(",") : "NAO");

  // pgcrypto disponivel (crypt)?
  const pg = await c.query(
    `SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto','pgcrypt')`
  );
  console.log("== pgcrypto:", pg.rows.length ? pg.rows[0].extname : "AUSENTE");

  // crypt() resolvivel com search_path public,auth,pg_temp?
  const crypt = await c.query(
    `SELECT crypt('teste', gen_salt('bf', 4)) IS NOT NULL AS ok`
  ).catch((e) => ({ rows: [{ ok: "ERRO: " + e.message }] }));
  console.log("== crypt() com search_path default do role:", crypt.rows[0].ok);

  await c.end();
})().catch((e) => { console.error("ERRO:", e.message); process.exit(2); });
