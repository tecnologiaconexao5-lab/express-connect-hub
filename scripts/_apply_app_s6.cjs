/* ============================================================================
 * _apply_app_s6.cjs — Aplica as migrations APP-S6 do App Mobile no Supabase do TMS
 *
 * Arquivos (ordem OBRIGATORIA 3 -> 4 -> 5):
 *   C:\src\conexao_prestador\supabase\migrations\tms\
 *     20261031000003_app_s6_pipeline_cadastro_concluido.sql
 *     20261031000004_app_s6_preferencias_operacionais.sql
 *     20261031000005_app_s6_avaliacao_situacional.sql
 *
 * Uso (raiz do repo TMS, junto ao .env com DATABASE_URL):
 *   node scripts\_apply_app_s6.cjs            # DRY-RUN: aplica + prova + ROLLBACK
 *   node scripts\_apply_app_s6.cjs --apply    # REAL: aplica + prova + COMMIT
 *
 * Provas (dentro da transacao; qualquer falha => ROLLBACK + exit 1):
 *   P1 RPC wrapper 4 params (p_auth_email, p_senha, p_etapa, p_respostas_situacionais) + secdef
 *   P2 base renomeada (_base, 3 params) SEM grants anon/authenticated; wrapper COM anon+authenticated
 *   P3 colunas preferencias_operacionais + respostas_situacionais em recrutamento_candidatos
 *   P4 trigger app_s6_sync_preferencias_operacionais (+ funcao) em recrutamento_candidatos
 *   P5 bridge redefinida (contem etapa_pipeline) + search_path da base inclui extensions (crypt)
 *   P6 crypt()/gen_salt() resolvem com search_path = public, auth, extensions, pg_temp
 *   P7 funcional: INSERT prestador de teste => rp + candidato stage cadastro_concluido
 *                 + preferencias espelhadas no INSERT (trigger 000004) e no UPDATE
 *                 + limpeza comprovada (contagens == baseline)
 * ==========================================================================*/

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");

const APPLY = process.argv.includes("--apply");
const MIG_DIR = "C:\\src\\conexao_prestador\\supabase\\migrations\\tms";
const FILES = [
  "20261031000003_app_s6_pipeline_cadastro_concluido.sql",
  "20261031000004_app_s6_preferencias_operacionais.sql",
  "20261031000005_app_s6_avaliacao_situacional.sql",
];

// pg_get_function_identity_arguments() retorna SEM parenteses
const WRAPPER_ARGS = "p_auth_email text, p_senha text, p_etapa text, p_respostas_situacionais jsonb";
const BASE_ARGS = "p_auth_email text, p_senha text, p_etapa text";

const TESTE_CPF = "TESTE-S6-APPLY-" + Date.now();
const TESTE_EMAIL = "teste-s6-apply-" + Date.now() + "@homolog.local";
const TESTE_ID = crypto.randomUUID();

const resultados = [];
function prova(id, nome, ok, detalhe = "") {
  resultados.push({ id, nome, ok });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${id} ${nome}${detalhe ? " — " + detalhe : ""}`);
  return ok;
}
function sha256(buf) { return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16); }

async function verificarEstado(c, prefixo) {
  console.log(`\n== ${prefixo} ==`);

  // P1: wrapper 4 params
  const w = await c.query(
    `SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef AS secdef
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'app_s6_sincronizar_cadastro_pipeline'`
  );
  const wrap4 = w.rows.find((r) => r.args === WRAPPER_ARGS);
  const okP1 = !!wrap4 && wrap4.secdef;
  prova("P1", "RPC wrapper 4 params + SECURITY DEFINER", okP1, wrap4 ? wrap4.args : "AUSENTE");

  // P2: base renomeada + grants
  const b = await c.query(
    `SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args, p.proconfig
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'app_s6_sincronizar_cadastro_pipeline_base'`
  );
  const base3 = b.rows.find((r) => r.args === BASE_ARGS);
  const grBase = await c.query(
    `SELECT DISTINCT grantee FROM information_schema.routine_privileges
     WHERE routine_schema='public' AND routine_name='app_s6_sincronizar_cadastro_pipeline_base'`
  );
  const baseGrantees = grBase.rows.map((r) => r.grantee);
  const okP2a = !!base3;
  const okP2b = !baseGrantees.includes("anon") && !baseGrantees.includes("authenticated") && !baseGrantees.includes("PUBLIC");
  prova("P2a", "base renomeada _base (3 params)", okP2a, base3 ? "ok" : "AUSENTE");
  prova("P2b", "base SEM grants anon/authenticated/PUBLIC", okP2b, "grantees: " + (baseGrantees.join(",") || "(nenhum)"));

  const grWrap = await c.query(
    `SELECT DISTINCT grantee FROM information_schema.routine_privileges
     WHERE routine_schema='public' AND routine_name='app_s6_sincronizar_cadastro_pipeline'`
  );
  const wrapGrantees = grWrap.rows.map((r) => r.grantee);
  const okP2c = wrapGrantees.includes("anon") && wrapGrantees.includes("authenticated");
  prova("P2c", "wrapper COM grants anon + authenticated", okP2c, "grantees: " + wrapGrantees.join(","));

  // P3: colunas
  const cols = await c.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='recrutamento_candidatos'
       AND column_name IN ('preferencias_operacionais','respostas_situacionais')`
  );
  const okP3 = cols.rows.length === 2;
  prova("P3", "colunas preferencias_operacionais + respostas_situacionais", okP3,
    cols.rows.map((r) => r.column_name).join(",") || "AUSENTES");

  // P4: trigger + funcao
  const trg = await c.query(
    `SELECT tgname FROM pg_trigger
     WHERE NOT tgisinternal AND tgrelid = 'public.recrutamento_candidatos'::regclass
       AND tgname = 'app_s6_sync_preferencias_operacionais'`
  );
  const fTrg = await c.query(
    `SELECT 1 FROM pg_proc WHERE proname = 'app_s6_sync_preferencias_operacionais_candidato'`
  );
  const okP4 = trg.rows.length === 1 && fTrg.rows.length === 1;
  prova("P4", "trigger + funcao de sync de preferencias", okP4,
    `trigger=${trg.rows.length} funcao=${fTrg.rows.length}`);

  // P5: bridge redefinida + search_path da base com extensions
  const bridge = await c.query(`SELECT prosrc FROM pg_proc WHERE proname = 'f_bridge_prestador_para_recrutamento'`);
  const temEtapas = bridge.rows.length === 1 && bridge.rows[0].prosrc.includes("etapa_pipeline");
  prova("P5a", "bridge contem etapa_pipeline (redefinida)", temEtapas,
    bridge.rows.length ? `${bridge.rows[0].prosrc.length} chars` : "AUSENTE");
  const spBase = base3 && base3.proconfig ? (base3.proconfig.join(" | ")) : "";
  const okP5b = spBase.includes("search_path=public, auth, extensions, pg_temp");
  prova("P5b", "search_path da base inclui extensions (crypt)", okP5b, spBase || "(sem proconfig)");

  // P6: crypt visivel com o search_path exato da funcao
  await c.query(`SET search_path = public, auth, extensions, pg_temp`);
  const cry = await c.query(`SELECT crypt('x', gen_salt('bf', 4)) IS NOT NULL AS ok`)
    .catch((e) => ({ rows: [{ ok: false, err: e.message }] }));
  prova("P6", "crypt()/gen_salt() com search_path da funcao", cry.rows[0].ok === true,
    cry.rows[0].err ? cry.rows[0].err : "ok");

  return { base3: !!base3, wrap4: !!wrap4 };
}

async function testeFuncional(c) {
  console.log("\n== P7 teste funcional (na transacao) ==");
  const antes = await c.query(
    `SELECT (SELECT count(*) FROM public.prestadores) AS prest,
            (SELECT count(*) FROM public.recrutamento_prestadores) AS rp,
            (SELECT count(*) FROM public.recrutamento_candidatos) AS cand`
  );
  const base = antes.rows[0];

  // INSERT prestador de teste -> dispara bridge (origem app_prestador)
  await c.query(
    `INSERT INTO public.prestadores
       (id, nome_completo, cpf_cnpj, email, telefone, origem, metadata, created_at, updated_at)
     VALUES ($1, 'TESTE S6 APPLY', $2, $3, '11999990000', 'app_prestador',
       $4::jsonb, NOW(), NOW())`,
    [TESTE_ID, TESTE_CPF, TESTE_EMAIL,
     JSON.stringify({
       etapa_pipeline: "cadastro_concluido",
       tipo_veiculo: "moto",
       endereco: { cidade: "Sao Paulo", uf: "SP" },
       preferencias_operacionais: { modalidade_preferencial: ["moto"] },
     })]
  );

  const cand = await c.query(
    `SELECT c.id, c.stage, c.prioridade, c.validade_cnh, c.cidade, c.uf,
            c.preferencias_operacionais AS pref
       FROM public.recrutamento_candidatos c
       JOIN public.recrutamento_prestadores rp ON rp.id = c.prestador_id
      WHERE rp.cpf_cnpj = $1`,
    [TESTE_CPF]
  );
  const c0 = cand.rows[0];
  const okP7a = cand.rows.length === 1 && c0 && c0.stage === "cadastro_concluido"
    && c0.prioridade === "media" && c0.validade_cnh === "valida" && c0.cidade === "Sao Paulo";
  prova("P7a", "bridge criou candidato cadastro_concluido (media/valida/SP)", !!okP7a,
    c0 ? `stage=${c0.stage} prio=${c0.prioridade} cnh=${c0.validade_cnh} cidade=${c0.cidade}` : `rows=${cand.rows.length}`);

  const prefJson = c0 && c0.pref ? JSON.stringify(c0.pref) : "null";
  const okP7b = !!c0 && prefJson === JSON.stringify({ modalidade_preferencial: ["moto"] });
  prova("P7b", "trigger 000004 espelhou preferencias no INSERT", !!okP7b, prefJson);

  // caminho UPDATE: altera preferencias no prestador e re-grava candidato
  await c.query(
    `UPDATE public.prestadores
        SET metadata = metadata || $2::jsonb
      WHERE id = $1`,
    [TESTE_ID, JSON.stringify({ preferencias_operacionais: { modalidade_preferencial: ["fiorino"] } })]
  );
  await c.query(
    `UPDATE public.recrutamento_candidatos
        SET data_atualizacao = to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      WHERE id = $1`,
    [c0.id]
  );
  const depois = await c.query(
    `SELECT preferencias_operacionais AS pref FROM public.recrutamento_candidatos WHERE id = $1`,
    [c0.id]
  );
  const okP7c = JSON.stringify(depois.rows[0].pref) === JSON.stringify({ modalidade_preferencial: ["fiorino"] });
  prova("P7c", "trigger 000004 espelhou preferencias no UPDATE", okP7c, JSON.stringify(depois.rows[0].pref));

  // limpeza (ordem respeita FKs)
  await c.query(`DELETE FROM public.recrutamento_candidatos WHERE id = $1`, [c0.id]);
  await c.query(`DELETE FROM public.recrutamento_prestadores WHERE cpf_cnpj = $1`, [TESTE_CPF]);
  await c.query(`DELETE FROM public.prestadores WHERE id = $1`, [TESTE_ID]);

  const dep = await c.query(
    `SELECT (SELECT count(*) FROM public.prestadores) AS prest,
            (SELECT count(*) FROM public.recrutamento_prestadores) AS rp,
            (SELECT count(*) FROM public.recrutamento_candidatos) AS cand`
  );
  const d = dep.rows[0];
  const okP7d = d.prest === base.prest && d.rp === base.rp && d.cand === base.cand;
  prova("P7d", "limpeza integral (contagens == baseline)", okP7d,
    `prest ${base.prest}->${d.prest} | rp ${base.rp}->${d.rp} | cand ${base.cand}->${d.cand}`);
}

function todosPassaram() { return resultados.every((r) => r.ok); }

(async () => {
  console.log(`_apply_app_s6.cjs — modo: ${APPLY ? "APPLY (COMMIT)" : "DRY-RUN (ROLLBACK)"}`);

  const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

  // hashes das migracoes (evidencia)
  console.log("\n== arquivos ==");
  const conteudos = FILES.map((f) => {
    const p = path.join(MIG_DIR, f);
    const txt = fs.readFileSync(p, "utf8");
    console.log(`  ${f} sha256:${sha256(txt)} ${txt.length} chars`);
    return txt;
  });

  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // pre-flight: ja aplicado?
  const ja = await c.query(
    `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname='app_s6_sincronizar_cadastro_pipeline'
       AND pg_get_function_identity_arguments(p.oid) = $1`,
    [WRAPPER_ARGS]
  );
  if (ja.rows.length) {
    console.log("\n== JA APLICADO (wrapper 4 params existe) — apenas verificacao ==");
    await verificarEstado(c, "estado atual");
    await c.end();
    const ok = todosPassaram();
    console.log(ok ? "\nJA APLICADO + provas PASS" : "\nJA APLICADO mas provas FALHARAM");
    process.exit(ok ? 0 : 1);
  }

  console.log("\n== transacao ==");
  await c.query("BEGIN");
  try {
    for (let i = 0; i < FILES.length; i++) {
      console.log(`  executando ${FILES[i]}...`);
      await c.query(conteudos[i]);
      console.log("  ok");
    }

    await verificarEstado(c, "provas na transacao");
    await testeFuncional(c);

    if (!todosPassaram()) throw new Error("falha nas provas");

    if (APPLY) {
      await c.query("COMMIT");
      console.log("\n*** COMMIT REALIZADO ***");
    } else {
      await c.query("ROLLBACK");
      console.log("\nDRY-RUN OK — tudo revertido (ROLLBACK). Use --apply para efetivar.");
    }
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    console.error("\nERRO -> ROLLBACK:", e.message);
    for (const r of resultados.filter((x) => !x.ok)) console.error(`  FALHOU: ${r.id} ${r.nome}`);
    await c.end();
    process.exit(1);
  }

  // pos-commit: verificacao final fora da transacao (apenas --apply)
  if (APPLY) {
    resultados.length = 0;
    await verificarEstado(c, "verificacao pos-COMMIT");
    const dep = await c.query(
      `SELECT (SELECT count(*) FROM public.prestadores) AS prest,
              (SELECT count(*) FROM public.recrutamento_prestadores) AS rp,
              (SELECT count(*) FROM public.recrutamento_candidatos) AS cand`
    );
    console.log("\n== contagens finais (sem residuo de teste) ==");
    console.log("  " + JSON.stringify(dep.rows[0]));
    if (!todosPassaram()) {
      await c.end();
      console.error("\nPOS-COMMIT: provas FALHARAM — INVESTIGAR");
      process.exit(1);
    }
  }

  const pass = resultados.filter((r) => r.ok).length;
  console.log(`\nResultado: ${pass}/${resultados.length} provas PASS`);
  await c.end();
})().catch((e) => { console.error("ERRO FATAL:", e.message); process.exit(2); });
