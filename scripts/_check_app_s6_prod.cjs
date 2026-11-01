/* Prova final READ-ONLY pos-aplicacao das migrations App-S6 000003/4/5 em producao (8/8) */
const fs = require("fs");
const { Client } = require("pg");

const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

const WRAPPER_ARGS = "p_auth_email text, p_senha text, p_etapa text, p_respostas_situacionais jsonb";
const BASE_ARGS = "p_auth_email text, p_senha text, p_etapa text";

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  let ok = 0, fail = 0;
  const check = (cond, okMsg, failMsg) => {
    if (cond) { console.log(`  [OK] ${okMsg}`); ok++; }
    else { console.log(`  [FAIL] ${failMsg}`); fail++; }
  };

  // 1. wrapper 4 params + secdef
  const w = await c.query(
    `SELECT pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef AS secdef
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname='app_s6_sincronizar_cadastro_pipeline'`
  );
  const wrap = w.rows.find((r) => r.args === WRAPPER_ARGS);
  check(!!wrap && wrap.secdef, `wrapper 4 params SECURITY DEFINER (${WRAPPER_ARGS})`, "wrapper 4 params AUSENTE ou sem secdef");

  // 2. base renomeada + search_path com extensions
  const b = await c.query(
    `SELECT pg_get_function_identity_arguments(p.oid) AS args, p.proconfig
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname='app_s6_sincronizar_cadastro_pipeline_base'`
  );
  const base = b.rows.find((r) => r.args === BASE_ARGS);
  check(!!base, `base renomeada _base (${BASE_ARGS})`, "base _base AUSENTE");
  const sp = base && base.proconfig ? base.proconfig.join(" | ") : "";
  check(sp.includes("search_path=public, auth, extensions, pg_temp"),
    `search_path da base com extensions (crypt) [${sp}]`, `search_path da base INCORRETO [${sp}]`);

  // 3. grants: wrapper COM anon+authenticated; base SEM anon/authenticated/PUBLIC
  const g = await c.query(
    `SELECT routine_name, grantee FROM information_schema.routine_privileges
     WHERE routine_schema='public'
       AND routine_name IN ('app_s6_sincronizar_cadastro_pipeline','app_s6_sincronizar_cadastro_pipeline_base')`
  );
  const gw = new Set(g.rows.filter((r) => r.routine_name === 'app_s6_sincronizar_cadastro_pipeline').map((r) => r.grantee));
  const gb = new Set(g.rows.filter((r) => r.routine_name === 'app_s6_sincronizar_cadastro_pipeline_base').map((r) => r.grantee));
  check(gw.has("anon") && gw.has("authenticated"),
    `wrapper grants anon+authenticated (grantees: ${[...gw].join(",")})`, `wrapper grants INCOMPLETOS (${[...gw].join(",") || "nenhum"})`);
  check(!gb.has("anon") && !gb.has("authenticated") && !gb.has("PUBLIC"),
    `base SEM grants anon/authenticated/PUBLIC (grantees: ${[...gb].join(",") || "nenhum"})`,
    `base COM grants indevidos (${[...gb].join(",")})`);

  // 4. bridge redefinida (contem etapa_pipeline)
  const br = await c.query(`SELECT prosrc FROM pg_proc WHERE proname='f_bridge_prestador_para_recrutamento'`);
  check(br.rows.length === 1 && br.rows[0].prosrc.includes("etapa_pipeline"),
    "bridge f_bridge_prestador_para_recrutamento redefinida (etapa_pipeline)", "bridge AUSENTE ou desatualizada");

  // 5+6. trigger + funcao de sync de preferencias
  const trg = await c.query(
    `SELECT tgname FROM pg_trigger
     WHERE NOT tgisinternal AND tgrelid='public.recrutamento_candidatos'::regclass
       AND tgname='app_s6_sync_preferencias_operacionais'`
  );
  check(trg.rows.length === 1, "trigger app_s6_sync_preferencias_operacionais em recrutamento_candidatos", "trigger de preferencias AUSENTE");
  const ft = await c.query(
    `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='app_s6_sync_preferencias_operacionais_candidato'`
  );
  check(ft.rows.length === 1, "funcao app_s6_sync_preferencias_operacionais_candidato", "funcao do trigger AUSENTE");

  // 7. colunas
  const cols = await c.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='recrutamento_candidatos'
       AND column_name IN ('preferencias_operacionais','respostas_situacionais')`
  );
  check(cols.rows.length === 2,
    `colunas recrutamento_candidatos (${cols.rows.map((r) => r.column_name).join(",") || "AUSENTES"})`,
    "colunas preferencias/respostas AUSENTES");

  // 8. crypt sob o search_path da funcao
  await c.query(`SET search_path = public, auth, extensions, pg_temp`);
  const cry = await c.query(`SELECT crypt('x', gen_salt('bf',4)) IS NOT NULL AS ok`).catch(() => ({ rows: [{ ok: false }] }));
  check(cry.rows[0].ok === true, "crypt()/gen_salt() resolvem com search_path da funcao", "crypt() FALHA com search_path da funcao");

  console.log(`\nRESULTADO: ${ok}/${ok + fail} provas OK` + (fail ? ` (${fail} FAIL)` : ""));
  await c.end();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(2); });
