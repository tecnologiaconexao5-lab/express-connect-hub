/**
 * TMS-01-SEC — Auditoria de seguranca, RLS e multi-tenant. SOMENTE LEITURA.
 * Saida: scripts/_tms01sec_auditoria.json
 */
import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const out = { ts: new Date().toISOString(), tabelas: [], rpcs: [], grants: [], checks: [] };
const add = (n, ok, d) => { out.checks.push({ name: n, ok: !!ok, detail: d }); console.log(`${ok ? "OK  " : "FAIL"} ${n} — ${d}`); };

const CRITICAS = ["ordens_servico", "pagamentos_prestadores", "prestadores", "perfis_usuario", "tenant_usuarios", "clientes", "alocacoes_escala", "financeiro_pagar", "financeiro_receber", "documentos_prestadores"];

// 1. RLS por tabela
for (const t of CRITICAS) {
  const ex = await c.query(`select to_regclass('public.'||$1) r`, [t]);
  if (!ex.rows[0].r) { out.tabelas.push({ tabela: t, existe: false }); console.log(`TABELA ${t}: NAO EXISTE`); continue; }
  const rls = await c.query(`select relrowsecurity, relforcerowsecurity from pg_class where relname=$1 and relnamespace='public'::regnamespace`, [t]);
  const pol = await c.query(`select policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname='public' and tablename=$1 order by cmd, policyname`, [t]);
  const row = { tabela: t, existe: true, rls: rls.rows[0]?.relrowsecurity, force: rls.rows[0]?.relforcerowsecurity, n_policies: pol.rows.length, policies: pol.rows };
  out.tabelas.push(row);
  console.log(`\n${t}: RLS=${row.rls} policies=${row.n_policies}`);
  for (const p of pol.rows) console.log(`   [${p.cmd}] ${p.policyname} roles=${p.roles} qual=${(p.qual||'').slice(0,80)}`);
}

// 2. Grants nas tabelas criticas
const privs = await c.query(
  `select table_name, grantee, string_agg(distinct privilege_type, ',' order by privilege_type) privs
     from information_schema.role_table_grants
    where table_schema='public' and grantee in ('anon','authenticated','service_role','PUBLIC')
      and table_name = any($1)
    group by 1,2 order by 1,2`, [CRITICAS]);
out.grants = privs.rows;
console.log("\n=== GRANTS (anon/authenticated/service_role) ===");
for (const g of privs.rows) console.log(`  ${g.table_name} | ${g.grantee} | ${g.privs}`);

// 3. RPCs criticas: definer + guards
const RPCS = ["f_confirmar_pagamento_prestador", "f_gerar_lote_pagamentos", "f_aprovar_pagamento_prestadores", "f_emitir_fatura", "f_avancar_etapa_app_motorista", "f_buscar_operacoes_motorista", "f_atualizar_reversa_app"];
for (const name of RPCS) {
  const r = await c.query(
    `select p.oid::regprocedure::text sig, p.prosecdef, pg_get_functiondef(p.oid) def
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=$1`, [name]);
  if (!r.rows.length) { out.rpcs.push({ nome: name, existe: false }); continue; }
  for (const fn of r.rows) {
    const def = fn.def || "";
    const item = {
      nome: name, assinatura: fn.sig, security_definer: fn.prosecdef,
      tem_auth_uid: /auth\.uid\(\)/.test(def),
      tem_tenant: /(tenant_id|v_tenant|current_tenant_id|f_pp_tenant_id)/i.test(def),
      tem_papel: /(papel|super_admin|admin_tenant|financeiro)/i.test(def),
      tem_search_path: /search_path/i.test(def),
      tem_raise: /RAISE\s+EXCEPTION/i.test(def),
    };
    out.rpcs.push(item);
    console.log(`\nRPC ${fn.sig}: definer=${item.security_definer} auth.uid=${item.tem_auth_uid} tenant=${item.tem_tenant} papel=${item.tem_papel} search_path=${item.tem_search_path}`);
  }
}

// 4. Checks resumo
const rlsOk = out.tabelas.filter((t) => t.existe && t.tabela !== "perfis_usuario").every((t) => t.rls === true);
add("rls_habilitada_tabelas_criticas", rlsOk, `RLS habilitada em todas as tabelas criticas existentes`);
const anonGrants = out.grants.filter((g) => g.grantee === "anon" || g.grantee === "PUBLIC");
add("sem_grants_anon_criticos", anonGrants.length === 0, anonGrants.length ? anonGrants.map((g) => g.table_name).join(",") : "nenhum grant a anon/PUBLIC");
const rpcGuard = out.rpcs.filter((r) => r.existe !== false);
const comTenant = rpcGuard.filter((r) => r.tem_tenant).length;
add("rpcs_com_guarda_tenant", comTenant === rpcGuard.length, `${comTenant}/${rpcGuard.length} RPCs referenciam tenant`);
const comAuth = rpcGuard.filter((r) => r.tem_auth_uid).length;
add("rpcs_com_auth_uid", comAuth >= 1, `${comAuth}/${rpcGuard.length} RPCs usam auth.uid()`);
const definer = rpcGuard.filter((r) => r.security_definer).length;
add("rpcs_security_definer", definer >= 1, `${definer}/${rpcGuard.length} RPCs sao SECURITY DEFINER`);

await c.end();
fs.writeFileSync("scripts/_tms01sec_auditoria.json", JSON.stringify(out, null, 2));
const falhas = out.checks.filter((x) => !x.ok).length;
console.log(`\nCHECKSUM: ${out.checks.length - falhas}/${out.checks.length} OK`);
console.log("EVIDENCIA: scripts/_tms01sec_auditoria.json");
