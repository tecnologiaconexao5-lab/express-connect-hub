/* ============================================================================
 * _apply_portal_cliente_rls.cjs — Onda 1 (Portal do Cliente: RLS + anti-IDOR)
 *
 * Uso (raiz do repo, DATABASE_URL no .env):
 *   node scripts\_apply_portal_cliente_rls.cjs            # DRY-RUN (ROLLBACK)
 *   node scripts\_apply_portal_cliente_rls.cjs --apply    # COMMIT real
 *
 * Faz na mesma transacao:
 *   1. Preflight de tabelas/colunas/funcoes/roles
 *   2. Aplica 20261125000001_portal_cliente_rls_security.sql
 *   3. Provas estruturais (helpers, policies, view, RPC)
 *   4. Smoke test funcional (cliente A vs cliente B vs staff + RPC IDOR)
 *      dentro de SAVEPOINT (dados de teste sao revertidos)
 *   5. COMMIT apenas se tudo passar (ou ROLLBACK no dry-run/falha)
 * ==========================================================================*/
const fs = require("fs");
const crypto = require("crypto");
const { Client } = require("pg");

const APPLY = process.argv.includes("--apply");
const MIG = "supabase/migrations/20261125000001_portal_cliente_rls_security.sql";

const resultados = [];
function prova(id, nome, ok, detalhe = "") {
  resultados.push({ id, nome, ok });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${id} ${nome}${detalhe ? " :: " + detalhe : ""}`);
}
const todosPassaram = () => resultados.every((r) => r.ok);

function lerDatabaseUrl() {
  const m = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL ausente no .env");
  return m[1].trim();
}

async function existeTabela(c, nome) {
  const r = await c.query(`SELECT to_regclass('public.${nome}') IS NOT NULL AS ok`);
  return r.rows[0].ok;
}

async function colunas(c, tabela) {
  const r = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1`,
    [tabela],
  );
  return new Set(r.rows.map((x) => x.column_name));
}

async function preflight(c) {
  console.log("\n== PREFLIGHT ==");
  const requeridas = [
    "entregas_protocolo",
    "rotas",
    "rota_paradas",
    "usuarios_cliente",
    "tenant_usuarios",
    "ordens_servico",
    "financeiro_receber",
    "portal_pedidos",
  ];
  for (const t of requeridas) {
    prova("PRE-T", `tabela ${t}`, await existeTabela(c, t));
  }

  const reqCols = {
    entregas_protocolo: ["ordem_servico_id", "alocacao_id", "prestador_id"],
    rotas: ["cliente_id", "prestador_id"],
    rota_paradas: ["rota_id"],
    usuarios_cliente: ["auth_user_id", "cliente_id", "ativo"],
    tenant_usuarios: ["user_id"],
    ordens_servico: ["id", "numero", "status", "cliente", "cliente_id"],
    financeiro_receber: ["cliente_id"],
    portal_pedidos: ["id", "cliente_id"],
    os_historico: ["ordem_servico_id"],
    portal_tracking_realtime: ["cliente_id", "prestador_id"],
    patio_checkins: ["cliente_id", "prestador_id"],
    patio_fila: ["checkin_id"],
    patio_eventos: ["checkin_id"],
    patio_alertas: ["checkin_id"],
  };
  for (const [t, cols] of Object.entries(reqCols)) {
    if (!(await existeTabela(c, t))) continue;
    const set = await colunas(c, t);
    const faltam = cols.filter((x) => !set.has(x));
    prova("PRE-C", `colunas ${t}`, faltam.length === 0, faltam.length ? `faltam: ${faltam.join(",")}` : "ok");
  }

  const fn = await c.query(
    `SELECT to_regprocedure('public.converter_pedido_para_os(uuid,uuid)') IS NOT NULL AS ok`,
  );
  prova("PRE-F", "RPC converter_pedido_para_os(uuid,uuid)", fn.rows[0].ok);

  const authFn = await c.query(`SELECT to_regprocedure('auth.uid()') IS NOT NULL AS ok`);
  prova("PRE-F", "auth.uid()", authFn.rows[0].ok);

  const roles = await c.query(
    `SELECT rolname FROM pg_roles WHERE rolname IN ('authenticated','anon','service_role')`,
  );
  const setRoles = new Set(roles.rows.map((r) => r.rolname));
  prova("PRE-R", "roles authenticated/anon/service_role", ["authenticated", "anon", "service_role"].every((r) => setRoles.has(r)));
}

async function estrutura(c) {
  console.log("\n== ESTRUTURA ==");

  for (const fn of ["f_portal_is_staff", "f_portal_cliente_id"]) {
    const r = await c.query(
      `SELECT p.prosecdef AS secdef, p.proconfig AS proconfig
         FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname=$1
        ORDER BY p.oid DESC LIMIT 1`,
      [fn],
    );
    const row = r.rows[0];
    const sp = row && row.proconfig ? row.proconfig.join(" | ") : "";
    prova("E-HELP", `${fn} SECURITY DEFINER + search_path`, !!row && row.secdef && sp.includes("search_path=public"), sp || "ausente");
  }

  const esperadas = {
    entregas_protocolo: ["ep_select_own_portal", "ep_insert_authorized", "ep_update_authorized"],
    rotas: ["rotas_select_own_portal", "rotas_insert_staff", "rotas_update_staff", "rotas_delete_staff"],
    rota_paradas: ["rp_select_own_portal", "rp_insert_staff", "rp_update_staff", "rp_delete_staff"],
    os_historico: ["os_historico_select_own_portal", "os_historico_write_staff"],
    portal_tracking_realtime: ["ptr_select_cliente_portal", "ptr_insert_authorized"],
    usuarios_cliente: ["usuarios_cliente_select_own", "usuarios_cliente_write_staff"],
    patio_checkins: [
      "patio_checkins_select_own_portal",
      "patio_checkins_write_staff",
      "patio_checkins_insert_prestador",
      "patio_checkins_update_prestador",
    ],
    patio_fila: ["patio_fila_select_own_portal", "patio_fila_write_staff"],
    patio_eventos: ["patio_eventos_select_own_portal", "patio_eventos_write_staff"],
    patio_alertas: ["patio_alertas_select_own_portal", "patio_alertas_write_staff"],
    patio_unidades: ["patio_unidades_staff_only"],
    patio_docas: ["patio_docas_staff_only"],
    patio_regras_fila: ["patio_regras_staff_only"],
    patio_rodizio: ["patio_rodizio_staff_only"],
  };

  const pol = await c.query(
    `SELECT tablename, policyname, qual, with_check FROM pg_policies WHERE schemaname='public'`,
  );
  const porTabela = new Map();
  for (const r of pol.rows) {
    if (!porTabela.has(r.tablename)) porTabela.set(r.tablename, []);
    porTabela.get(r.tablename).push(r);
  }

  for (const [t, names] of Object.entries(esperadas)) {
    if (!(await existeTabela(c, t))) continue;
    const atuais = new Set((porTabela.get(t) || []).map((r) => r.policyname));
    const faltam = names.filter((n) => !atuais.has(n));
    prova("E-POL", `policies ${t}`, faltam.length === 0, faltam.length ? `faltam: ${faltam.join(",")}` : "ok");

    const permissivas = (porTabela.get(t) || []).filter((r) => {
      const q = String(r.qual || "").trim();
      const w = String(r.with_check || "").trim();
      return q === "true" || q === "(true)" || w === "true" || w === "(true)";
    });
    prova("E-POL", `sem policy permissiva ${t}`, permissivas.length === 0, permissivas.map((r) => r.policyname).join(","));
  }

  const v = await c.query(
    `SELECT c.reloptions AS opts, pg_get_viewdef(c.oid, true) AS def
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='vw_portal_financeiro_cliente' AND c.relkind='v'`,
  );
  const row = v.rows[0];
  const opts = row && row.opts ? row.opts.join(",") : "";
  prova("E-VIEW", "view security_invoker=true", opts.includes("security_invoker=true"), opts || "ausente");
  prova("E-VIEW", "view filtra por f_portal_cliente_id", !!row && String(row.def).includes("f_portal_cliente_id"), row ? "ok" : "ausente");

  const base = await c.query(
    `SELECT to_regprocedure('public._converter_pedido_para_os_base(uuid,uuid)') IS NOT NULL AS ok`,
  );
  prova("E-RPC", "base _converter_pedido_para_os_base existe", base.rows[0].ok);

  const priv = await c.query(
    `SELECT
       has_function_privilege('anon','public._converter_pedido_para_os_base(uuid,uuid)','EXECUTE') AS anon_base,
       has_function_privilege('authenticated','public._converter_pedido_para_os_base(uuid,uuid)','EXECUTE') AS auth_base,
       has_function_privilege('anon','public.converter_pedido_para_os(uuid,uuid)','EXECUTE') AS anon_wrap,
       has_function_privilege('authenticated','public.converter_pedido_para_os(uuid,uuid)','EXECUTE') AS auth_wrap`,
  );
  const p = priv.rows[0];
  prova("E-RPC", "base sem EXECUTE p/ anon/authenticated", !p.anon_base && !p.auth_base, JSON.stringify(p));
  prova("E-RPC", "wrapper EXECUTE authenticated, sem anon", p.auth_wrap && !p.anon_wrap, JSON.stringify(p));

  const wrap = await c.query(
    `SELECT p.prosecdef AS secdef, pg_get_function_identity_arguments(p.oid) AS args
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='converter_pedido_para_os'`,
  );
  const wr = wrap.rows[0];
  prova("E-RPC", "wrapper SECURITY DEFINER (uuid,uuid)", !!wr && wr.secdef && wr.args === "p_pedido_id uuid, p_operador_id uuid", wr ? `${wr.args} secdef=${wr.secdef}` : "ausente");
}

async function setClaims(c, authId) {
  await c.query("RESET ROLE");
  await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [authId]);
  await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: authId, role: "authenticated" })]);
  await c.query("SET LOCAL ROLE authenticated");
}

async function smoke(c) {
  console.log("\n== SMOKE (SAVEPOINT) ==");

  // Duas identidades de portal com clientes DISTINTOS.
  let pares = (
    await c.query(
      `SELECT DISTINCT ON (uc.cliente_id) uc.auth_user_id::text AS auth_id, uc.cliente_id::text AS cliente_id
         FROM public.usuarios_cliente uc
        WHERE COALESCE(uc.ativo, true) = true
          AND NOT EXISTS (SELECT 1 FROM public.tenant_usuarios tu WHERE tu.user_id = uc.auth_user_id)
        ORDER BY uc.cliente_id, uc.created_at
        LIMIT 2`,
    )
  ).rows;

  for (let i = 0; pares.length < 2 && i < 2; i++) {
    const auths = (
      await c.query(
        `SELECT u.id::text AS id FROM auth.users u
          WHERE NOT EXISTS (SELECT 1 FROM public.usuarios_cliente uc WHERE uc.auth_user_id = u.id)
            AND NOT EXISTS (SELECT 1 FROM public.tenant_usuarios tu WHERE tu.user_id = u.id)
          LIMIT 2`,
      )
    ).rows;
    const cls = (await c.query(`SELECT id::text AS id FROM public.clientes LIMIT 2`)).rows;
    if (auths.length < 2 || cls.length < 2) break;
    for (let j = 0; j < 2; j++) {
      await c.query(
        `INSERT INTO public.usuarios_cliente (auth_user_id, cliente_id, ativo)
         VALUES ($1::uuid, $2::uuid, true)
         ON CONFLICT (auth_user_id, cliente_id) DO NOTHING`,
        [auths[j].id, cls[j].id],
      );
    }
    pares = (
      await c.query(
        `SELECT DISTINCT ON (uc.cliente_id) uc.auth_user_id::text AS auth_id, uc.cliente_id::text AS cliente_id
           FROM public.usuarios_cliente uc
          WHERE COALESCE(uc.ativo, true) = true
          ORDER BY uc.cliente_id, uc.created_at
          LIMIT 2`,
      )
    ).rows;
  }
  prova("S-DATA", "2 clientes de portal distintos", pares.length >= 2, pares.map((p) => p.cliente_id).join(","));

  const staff = (await c.query(`SELECT user_id::text AS id FROM public.tenant_usuarios LIMIT 1`)).rows[0];
  prova("S-DATA", "1 usuario staff (tenant_usuarios)", !!staff, staff ? staff.id : "ausente");

  const prestador = (await c.query(`SELECT id::text AS id FROM public.prestadores LIMIT 1`)).rows[0];
  prova("S-DATA", "1 prestador para POD de teste", !!prestador, prestador ? prestador.id : "ausente");

  if (pares.length < 2 || !staff || !prestador) {
    throw new Error("sem dados minimos para o smoke (2 clientes de portal + staff + prestador)");
  }

  const [A, B] = pares;
  const osA = crypto.randomUUID();
  const osB = crypto.randomUUID();
  const podA = crypto.randomUUID();
  const podB = crypto.randomUUID();
  const alocA = crypto.randomUUID();
  const alocB = crypto.randomUUID();
  const pedA = crypto.randomUUID();
  const pedB = crypto.randomUUID();

  await c.query("ALTER TABLE public.portal_pedidos DISABLE TRIGGER USER");
  await c.query("ALTER TABLE public.ordens_servico DISABLE TRIGGER USER");
  await c.query("ALTER TABLE public.alocacoes_escala DISABLE TRIGGER USER");
  await c.query("ALTER TABLE public.entregas_protocolo DISABLE TRIGGER USER");

  await c.query(
    `INSERT INTO public.ordens_servico (id, numero, cliente, cliente_id, status, created_at, updated_at)
     VALUES ($1,$2,$3::uuid,$4,'pendente',now(),now()), ($5,$6,$7::uuid,$8,'pendente',now(),now())`,
    [osA, `RLS-A-${osA.slice(0, 8)}`, A.cliente_id, A.cliente_id, osB, `RLS-B-${osB.slice(0, 8)}`, B.cliente_id, B.cliente_id],
  );
  await c.query(
    `INSERT INTO public.alocacoes_escala (id, cliente_id, prestador_id, ordem_servico_id, data_escala, tipo_veiculo, status)
     VALUES ($1,$2::uuid,$3::uuid,$4::uuid,CURRENT_DATE,'Moto','concluida'), ($5,$6::uuid,$3::uuid,$7::uuid,CURRENT_DATE,'Moto','concluida')`,
    [alocA, A.cliente_id, prestador.id, osA, alocB, B.cliente_id, osB],
  );
  await c.query(
    `INSERT INTO public.entregas_protocolo (id, alocacao_id, ordem_servico_id, prestador_id, nome_recebedor, status, data_hora_entrega, created_at)
     VALUES ($1,$2,$3,$4,'TESTE RLS A','entregue',now(),now()), ($5,$6,$7,$8,'TESTE RLS B','entregue',now(),now())`,
    [podA, alocA, osA, prestador.id, podB, alocB, osB, prestador.id],
  );
  await c.query(
    `INSERT INTO public.portal_pedidos (id, cliente_id, numero_pedido, status, created_at, updated_at)
     VALUES ($1,$2::uuid,$3,'enviado',now(),now()), ($4,$5::uuid,$6,'enviado',now(),now())`,
    [pedA, A.cliente_id, `RLS-A-${pedA.slice(0, 8)}`, pedB, B.cliente_id, `RLS-B-${pedB.slice(0, 8)}`],
  );
  await c.query("ALTER TABLE public.portal_pedidos ENABLE TRIGGER USER");
  await c.query("ALTER TABLE public.ordens_servico ENABLE TRIGGER USER");
  await c.query("ALTER TABLE public.alocacoes_escala ENABLE TRIGGER USER");
  await c.query("ALTER TABLE public.entregas_protocolo ENABLE TRIGGER USER");

  async function cenario(quem, authId, clienteEsperado, podsVisiveis, podTerceiro, terceiroEsperado = false) {
    await setClaims(c, authId);
    const me = (
      await c.query(`SELECT public.f_portal_cliente_id()::text AS cid, public.f_portal_is_staff() AS staff`)
    ).rows[0];
    const okCliente = quem === "staff" ? me.staff === true : me.cid === clienteEsperado && me.staff === false;
    prova("S-CTX", `${quem}: identidade`, okCliente, JSON.stringify(me));

    for (const [rotulo, podId, esperado] of [
      ["proprio", podsVisiveis, true],
      ["terceiro", podTerceiro, terceiroEsperado],
    ]) {
      const n = (
        await c.query(`SELECT count(*)::int AS n FROM public.entregas_protocolo WHERE id=$1`, [podId])
      ).rows[0].n;
      prova("S-POD", `${quem}: POD ${rotulo}`, esperado ? n === 1 : n === 0, `count=${n}`);
    }
    await c.query("RESET ROLE");
  }

  await cenario("cliente A", A.auth_id, A.cliente_id, podA, podB);
  await cenario("cliente B", B.auth_id, B.cliente_id, podB, podA);
  await cenario("staff", staff.id, null, podA, podB, true);

  // RPC IDOR: A tentando converter pedido de B => ACESSO_NEGADO.
  await setClaims(c, A.auth_id);
  const negado = (await c.query(`SELECT public.converter_pedido_para_os($1::uuid, NULL) AS r`, [pedB])).rows[0].r;
  prova("S-RPC", "A nao converte pedido de B", negado && negado.success === false && negado.error_code === "ACESSO_NEGADO", JSON.stringify(negado));
  await c.query("RESET ROLE");

  // A convertendo o proprio pedido e staff convertendo: nao pode ser ACESSO_NEGADO.
  async function rpcPermitido(quem, authId, pedido) {
    await setClaims(c, authId);
    await c.query("SAVEPOINT rpc");
    let ok = false;
    let detalhe = "";
    try {
      const r = (await c.query(`SELECT public.converter_pedido_para_os($1::uuid, NULL) AS r`, [pedido])).rows[0].r;
      ok = !(r && r.success === false && r.error_code === "ACESSO_NEGADO");
      detalhe = JSON.stringify(r);
    } catch (e) {
      ok = true;
      detalhe = `excecao da base (nao e ACESSO_NEGADO): ${e.message}`;
    } finally {
      await c.query("ROLLBACK TO SAVEPOINT rpc").catch(() => {});
      await c.query("RELEASE SAVEPOINT rpc").catch(() => {});
      await c.query("RESET ROLE").catch(() => {});
    }
    prova("S-RPC", `${quem}: acesso ao proprio pedido autorizado`, ok, detalhe);
  }

  await rpcPermitido("cliente A", A.auth_id, pedA);
  await rpcPermitido("staff", staff.id, pedB);
}

(async () => {
  const cliente = new Client({ connectionString: lerDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  await cliente.connect();
  let aplicado = false;
  try {
    await preflight(cliente);

    const bruto = fs.readFileSync(MIG, "utf8");
    const sql = bruto.replace(/^\s*BEGIN;\s*/i, "").replace(/\s*COMMIT;\s*$/i, "");
    console.log(`\n== MIGRATION ==\n  ${MIG} (${bruto.length} bytes)`);

    await cliente.query("BEGIN");
    await cliente.query(sql);
    aplicado = true;

    await estrutura(cliente);

    await cliente.query("SAVEPOINT smoke");
    await smoke(cliente);
    await cliente.query("RESET ROLE").catch(() => {});
    await cliente.query("ROLLBACK TO SAVEPOINT smoke");
    await cliente.query("RELEASE SAVEPOINT smoke");

    if (!todosPassaram()) throw new Error("ha provas FAIL");

    if (APPLY) {
      await cliente.query("COMMIT");
      console.log("\n== COMMIT == migration aplicada em producao");
      aplicado = false;

      const pos = await cliente.query(
        `SELECT
           (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname IN
             ('ep_select_own_portal','rotas_select_own_portal','rp_select_own_portal','ptr_select_cliente_portal','usuarios_cliente_select_own')) AS policies,
           (SELECT array_to_string(reloptions,',') FROM pg_class WHERE relname='vw_portal_financeiro_cliente') AS view_opts,
           to_regprocedure('public._converter_pedido_para_os_base(uuid,uuid)') IS NOT NULL AS base_ok`,
      );
      console.log(`  pos-commit: ${JSON.stringify(pos.rows[0])}`);
    } else {
      await cliente.query("ROLLBACK");
      console.log("\n== ROLLBACK == dry-run concluido (nada persistido)");
      aplicado = false;
    }
  } catch (e) {
    console.error("\nERRO:", e.message);
    try {
      await cliente.query("RESET ROLE");
    } catch {}
    try {
      if (aplicado) await cliente.query("ROLLBACK");
    } catch {}
    process.exitCode = 1;
  } finally {
    await cliente.end();
  }
})();
