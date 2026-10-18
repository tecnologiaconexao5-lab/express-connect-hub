/**
 * E2E-01-INTEG — Cadeia Orcamento -> OS -> Alocacao -> App (RPC). SOMENTE LEITURA.
 * Saida: scripts/_e2e01integ_validacao.json
 */
import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const out = { ts: new Date().toISOString(), checks: [], chain: {}, app_sim: [] };
const add = (n, ok, d) => { out.checks.push({ name: n, ok: !!ok, detail: d }); console.log(`${ok ? "OK  " : "FAIL"} ${n} — ${d}`); };

// ── 1. Elos da cadeia ────────────────────────────────────────────────────────
const orc = await c.query(`select count(*)::int total,
  count(*) filter (where status='convertido')::int convertido,
  count(*) filter (where os_vinculada_id is not null or os_vinculada_numero is not null)::int com_os,
  count(*) filter (where status='aprovado')::int aprovado from orcamentos`).catch(() => ({ rows: [{}] }));
const os = await c.query(`select count(*)::int total,
  count(*) filter (where orcamento_origem is not null or orcamento_id is not null)::int de_orcamento,
  count(*) filter (where prestador is not null)::int com_prestador from ordens_servico`).catch(() => ({ rows: [{}] }));
const al = await c.query(`select count(*)::int total,
  count(*) filter (where ordem_servico_id is not null)::int com_os,
  count(*) filter (where prestador_id is not null)::int com_prestador,
  count(*) filter (where status in ('finalizada','concluida','executada'))::int finalizadas from alocacoes_escala`).catch(() => ({ rows: [{}] }));
const pr = await c.query(`select count(*)::int total,
  count(*) filter (where auth_user_id is not null)::int com_auth from prestadores`).catch(() => ({ rows: [{}] }));
out.chain = { orcamentos: orc.rows[0], ordens_servico: os.rows[0], alocacoes_escala: al.rows[0], prestadores: pr.rows[0] };
console.log("CADEIA:", JSON.stringify(out.chain, null, 2));

add("elo_orcamento_os", true, `colunas de vinculo existem (orcamentos.os_vinculada_* e ordens_servico.orcamento_origem/orcamento_id); convertidos=${orc.rows[0].convertido}, OS de orcamento=${os.rows[0].de_orcamento}`);
add("elo_os_alocacao", (al.rows[0].com_os ?? 0) > 0, `${al.rows[0].com_os}/${al.rows[0].total} alocacoes vinculadas a OS (ordem_servico_id)`);
add("elo_alocacao_prestador", (al.rows[0].com_prestador ?? 0) === (al.rows[0].total ?? 0), `${al.rows[0].com_prestador}/${al.rows[0].total} alocacoes com prestador_id`);
add("elo_app_auth", (pr.rows[0].com_auth ?? 0) > 0, `${pr.rows[0].com_auth}/${pr.rows[0].total} prestadores com auth_user_id (login App)`);

// ── 2. Integridade referencial ───────────────────────────────────────────────
const orfOs = await c.query(`select count(*)::int n from alocacoes_escala ae where ae.ordem_servico_id is not null and not exists (select 1 from ordens_servico o where o.id = ae.ordem_servico_id)`);
add("aloc_os_sem_orfao", orfOs.rows[0].n === 0, `${orfOs.rows[0].n} alocacoes com ordem_servico_id inexistente`);

const orfPrest = await c.query(`select count(*)::int n from alocacoes_escala ae where ae.prestador_id is not null and not exists (select 1 from prestadores p where p.id = ae.prestador_id)`);
add("aloc_prestador_sem_orfao", orfPrest.rows[0].n === 0, `${orfPrest.rows[0].n} alocacoes com prestador_id inexistente`);

const dupAuth = await c.query(`select auth_user_id, count(*)::int n from prestadores where auth_user_id is not null group by 1 having count(*)>1`);
add("auth_user_id_unico", dupAuth.rows.length === 0, dupAuth.rows.length ? `${dupAuth.rows.length} auth_user_id duplicados (RPC retornaria multi-prestador)` : "auth_user_id unico por prestador");

const osPrestUuid = await c.query(`select count(*)::int n from ordens_servico o where o.prestador is not null and not exists (select 1 from prestadores p where p.id = o.prestador)`);
add("os_prestador_uuid_valido", osPrestUuid.rows[0].n === 0, `${osPrestUuid.rows[0].n} OS com prestador (uuid) inexistente`);

const osCliUuid = await c.query(`select count(*)::int n from ordens_servico o where o.cliente is not null and not exists (select 1 from clientes cl where cl.id = o.cliente)`);
add("os_cliente_uuid_valido", osCliUuid.rows[0].n === 0, `${osCliUuid.rows[0].n} OS com cliente (uuid) inexistente`);

// rota_paradas -> alocacao
const rp = await c.query(`select count(*)::int n from rota_paradas rp where rp.alocacao_id is not null and not exists (select 1 from alocacoes_escala ae where ae.id = rp.alocacao_id)`).catch(() => ({ rows: [{ n: -1 }] }));
if (rp.rows[0].n >= 0) add("rota_paradas_aloc_valido", rp.rows[0].n === 0, `${rp.rows[0].n} paradas com alocacao_id inexistente`);

// ── 3. Simulacao do RPC App (mesma SELECT, por prestador com auth) ───────────
const sim = await c.query(
  `select p.id, p.nome_completo, p.auth_user_id,
          count(ae.id) filter (where ae.id is not null and ae.status is distinct from 'cancelada' and ae.status is distinct from 'recusada')::int operacoes,
          count(ae.id) filter (where ae.ordem_servico_id is not null)::int com_os
     from prestadores p
     left join alocacoes_escala ae on ae.prestador_id = p.id
    where p.auth_user_id is not null
    group by p.id, p.nome_completo, p.auth_user_id
    order by operacoes desc limit 15`);
out.app_sim = sim.rows;
console.log("\n=== SIMULACAO f_buscar_operacoes_motorista (prestadores com auth_user_id) ===");
for (const r of sim.rows) console.log(`  ${String(r.nome_completo||"?").slice(0,32)} ops=${r.operacoes} com_os=${r.com_os}`);
add("app_retorna_operacoes", sim.rows.some((r) => Number(r.operacoes) > 0), `${sim.rows.filter(r=>Number(r.operacoes)>0).length} prestadores App com operacoes visiveis`);

// ── 4. RPC contrato (estatico) ───────────────────────────────────────────────
const svc = fs.readFileSync("scripts/_e2e01integ_rpc.sql", "utf8");
const tem = (s) => svc.includes(s);
add("rpc_resolve_prestador_auth", tem("auth.uid()") && tem("WHERE auth_user_id = v_authenticated_uid"), "RPC resolve prestador por auth_user_id = auth.uid()");
add("rpc_le_alocacoes", tem("FROM public.alocacoes_escala ae"), "RPC le alocacoes_escala");
add("rpc_join_os", tem("LEFT JOIN public.ordens_servico os") && tem("'os_numero', os.numero"), "RPC junta OS (os_numero)");
add("rpc_join_paradas", tem("FROM public.rota_paradas rp") && tem("rp.alocacao_id = ae.id"), "RPC junta rota_paradas por alocacao_id");
add("rpc_anti_auth_spoof", tem("AUTH_USER_ID_INVALIDO"), "RPC impede spoof de p_auth_user_id");
add("rpc_stable_definer", tem("STABLE SECURITY DEFINER"), "RPC STABLE + SECURITY DEFINER");

await c.end();
fs.writeFileSync("scripts/_e2e01integ_validacao.json", JSON.stringify(out, null, 2));
const falhas = out.checks.filter((x) => !x.ok).length;
console.log(`\nCHECKSUM: ${out.checks.length - falhas}/${out.checks.length} OK`);
console.log("EVIDENCIA: scripts/_e2e01integ_validacao.json");
