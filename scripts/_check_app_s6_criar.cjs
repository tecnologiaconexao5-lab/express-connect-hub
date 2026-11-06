/* READ-ONLY: assinatura/corpo de app_s6_criar_prestador em producao (params vs Dart) */
const fs = require("fs");
const { Client } = require("pg");

const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

const DART_PARAMS = [
  "p_nome_completo", "p_cpf_cnpj", "p_data_nascimento", "p_telefone", "p_email",
  "p_auth_email", "p_senha", "p_status", "p_origem", "p_liberado_app", "p_metadata",
];

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const f = await c.query(
    `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
            p.prosecdef AS secdef, p.provolatile, n.nspname
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname IN ('app_s6_criar_prestador', 'app_s6_salvar_perfil_talento',
                         'app_s6_sincronizar_cadastro_pipeline',
                         'app_s6_sync_preferencias_operacionais_candidato')
     ORDER BY p.proname, 1`
  );
  console.log("== funcoes app_s6 ==");
  if (!f.rows.length) console.log("  (nenhuma)");
  for (const r of f.rows) console.log(`  ${r.nspname}.${r.proname}(${r.args}) secdef=${r.secdef} vol=${r.provolatile}`);

  // diff params do Dart vs assinatura do criar_prestador
  const criar = f.rows.filter((r) => r.proname === "app_s6_criar_prestador");
  if (criar.length) {
    const args = criar[0].args.replace(/[()]/g, "").split(",").map((s) => s.trim().split(/\s+/)[0]);
    const faltando = DART_PARAMS.filter((p) => !args.includes(p));
    const sobrando = args.filter((p) => !DART_PARAMS.includes(p));
    console.log("  params Dart ausentes na funcao:", faltando.length ? faltando.join(",") : "(nenhum)");
    console.log("  params extras na funcao:", sobrando.length ? sobrando.join(",") : "(nenhum)");
  } else {
    console.log("  !! app_s6_criar_prestador AUSENTE em producao");
  }

  // body: copia etapa_pipeline / preferencias para metadata?
  const src = await c.query(
    `SELECT prosrc FROM pg_proc WHERE proname = 'app_s6_criar_prestador'`
  );
  if (src.rows.length) {
    const b = src.rows[0].prosrc;
    console.log("== corpo app_s6_criar_prestador (marcadores) ==");
    console.log("  etapa_pipeline:", b.includes("etapa_pipeline"));
    console.log("  preferencias_operacionais:", b.includes("preferencias_operacionais"));
    console.log("  respostas_situacionais:", b.includes("respostas_situacionais"));
    console.log("  crypt(:", b.includes("crypt("));
    console.log("  search_path declarado:", (b.match(/SET search_path[^;]*/) || ["(nenhum)"])[0]);
    console.log("  tamanho:", b.length, "chars");
  }

  // grants da criar_prestador
  const g = await c.query(
    `SELECT grantee, privilege_type FROM information_schema.routine_privileges
     WHERE routine_name = 'app_s6_criar_prestador' AND routine_schema = 'public'
     ORDER BY grantee, privilege_type`
  );
  console.log("== grants app_s6_criar_prestador ==");
  for (const r of g.rows) console.log(`  ${r.grantee}: ${r.privilege_type}`);

  // triggers da recrutamento_candidatos e prestadores
  const trg = await c.query(
    `SELECT tgname, pg_get_triggerdef(oid) IS NOT NULL AS has_def
     FROM pg_trigger WHERE NOT tgisinternal
       AND tgrelid IN ('public.prestadores'::regclass, 'public.recrutamento_candidatos'::regclass)
     ORDER BY tgrelid::regclass::text, tgname`
  );
  console.log("== triggers prestadores/candidatos ==");
  for (const r of trg.rows) console.log(`  ${r.tgname}`);

  await c.end();
})().catch((e) => { console.error("ERRO:", e.message); process.exit(2); });
