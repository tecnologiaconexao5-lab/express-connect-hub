/**
 * TMS-02-PERF — Integridade de triggers, indices e performance. SOMENTE LEITURA.
 * Saida: scripts/_tms02perf_auditoria.json
 */
import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const out = { ts: new Date().toISOString(), triggers: [], indexes: [], fks: [], rpcs: [], stats: [], checks: [] };
const add = (n, ok, d) => { out.checks.push({ name: n, ok: !!ok, detail: d }); console.log(`${ok ? "OK  " : "FAIL"} ${n} — ${d}`); };
const asArr = (v) => Array.isArray(v) ? v : (v ? String(v).replace(/[{}]/g, "").split(",").filter(Boolean) : []);

const T = ["ordens_servico", "pagamentos_prestadores", "financeiro_pagar", "financeiro_receber", "alocacoes_escala", "prestadores", "clientes", "documentos_prestadores"];

// ── 1. TRIGGERS (com UPDATE OF) ──────────────────────────────────────────────
const trg = await c.query(
  `select c.relname tabela, t.tgname, p.proname funcao, p.oid foid, p.prosecdef definer,
          (t.tgtype & 2)=2 as before, (t.tgtype & 4)=4 as ins, (t.tgtype & 8)=8 as del, (t.tgtype & 16)=16 as upd,
          t.tgenabled,
          (select array_agg(a.attname) from unnest(t.tgattr) k join pg_attribute a on a.attrelid=t.tgrelid and a.attnum=k) upd_cols
     from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid
    where not t.tgisinternal and c.relname = any($1) order by c.relname, t.tgname`, [T]);
for (const r of trg.rows) {
  const def = (await c.query(`select pg_get_functiondef($1::oid) def`, [r.foid])).rows[0]?.def || "";
  const selfWrite = new RegExp(`(insert\\s+into|update|delete\\s+from)\\s+(public\\.)?${r.tabela}\\b`, "i").test(def);
  const updCols = asArr(r.upd_cols);
  // recursao so existe se: escreve na propria tabela E o trigger dispara em UPDATE de TODAS as colunas (sem OF)
  const recursion = selfWrite && r.upd && updCols.length === 0;
  out.triggers.push({ tabela: r.tabela, trigger: r.tgname, funcao: r.funcao, timing: r.before ? "BEFORE" : "AFTER",
    eventos: [r.ins && "INSERT", r.upd && "UPDATE", r.del && "DELETE"].filter(Boolean).join("/"),
    habilitado: r.tgenabled, definer: r.definer, update_of: updCols.join(","), self_write: selfWrite, recursao: recursion });
}
console.log("=== TRIGGERS (" + out.triggers.length + ") ===");
for (const t of out.triggers) console.log(`  ${t.tabela}.${t.trigger} ${t.timing} ${t.eventos} updOf=[${t.update_of}] selfWrite=${t.self_write} recursao=${t.recursao}`);
const rec = out.triggers.filter((t) => t.recursao);
add("triggers_sem_recursividade", rec.length === 0, rec.length ? rec.map((t) => `${t.tabela}.${t.trigger}`).join(", ") : "nenhuma recursao direta (self-writes ocorrem fora do UPDATE OF)");
const selfW = out.triggers.filter((t) => t.self_write);
add("self_write_controlado", selfW.every((t) => t.update_of), `${selfW.length} trigger(s) escrevem na propria tabela, todos com UPDATE OF restrito: ${selfW.map(t=>t.tabela+"."+t.trigger).join(", ")}`);
add("triggers_habilitados", out.triggers.every((t) => t.habilitado === "O"), "todos os triggers habilitados (O)");

// ── 2. INDICES ───────────────────────────────────────────────────────────────
const idx = await c.query(
  `select t.relname tabela, i.relname indice, ix.indisunique, ix.indisprimary, pg_get_indexdef(ix.indexrelid) def
     from pg_index ix join pg_class i on i.oid=ix.indexrelid join pg_class t on t.oid=ix.indrelid
    where t.relname = any($1) order by t.relname, i.relname`, [T]);
out.indexes = idx.rows;
const cov = (tabela, col) => idx.rows.some((r) => r.tabela === tabela && new RegExp(`\\(${col}\\b`).test(r.def.replace(/\s+/g, " ")) || (r.tabela === tabela && new RegExp(`[\\s(,]${col}[\\s,)]`).test(r.def)));
console.log("\n=== INDICES por tabela ===");
const byTab = {}; for (const r of idx.rows) (byTab[r.tabela] ||= []).push(r.indice);
for (const t of T) console.log(`  ${t}: ${(byTab[t] || []).length} indices`);

// ── 3. FKs e cobertura por indice ────────────────────────────────────────────
const fks = await c.query(
  `select conrelid::regclass::text tabela, conname, pg_get_constraintdef(oid) def,
          (select array_agg(a.attname) from unnest(conkey) k join pg_attribute a on a.attrelid=conrelid and a.attnum=k) cols
     from pg_constraint where contype='f' and conrelid::regclass::text = any($1) order by 1,2`, [T]);
out.fks = fks.rows.map((f) => ({ tabela: f.tabela, fk: f.conname, def: f.def, cols: asArr(f.cols) }));
let fkSemIdx = [];
for (const fk of out.fks) {
  const first = fk.cols[0]; if (!first) continue;
  if (!cov(fk.tabela, first)) fkSemIdx.push(`${fk.tabela}.${fk.fk}(${fk.cols.join(",")})`);
}
add("fks_indexadas", fkSemIdx.length === 0, fkSemIdx.length ? `FKs sem indice: ${fkSemIdx.join(" | ")}` : `${out.fks.length} FKs; todas com indice na 1a coluna`);

// ── 4. tenant_id / status (multi-tenant) ─────────────────────────────────────
const colEx = await c.query(`select table_name, column_name from information_schema.columns where table_schema='public' and table_name=any($1)`, [T]);
const hasCol = new Set(colEx.rows.map((r) => r.table_name + "." + r.column_name));
const semTenantIdx = T.filter((t) => hasCol.has(t + ".tenant_id") && !cov(t, "tenant_id"));
add("tenant_id_indexado", semTenantIdx.length === 0, semTenantIdx.length ? `sem indice tenant_id: ${semTenantIdx.join(", ")}` : "tenant_id indexado onde existe");
const buscaCols = ["prestador_id", "cliente_id", "os_id", "ordem_servico_id", "pagamento_id", "fechamento_id"];
const semBusca = [];
for (const t of T) for (const col of buscaCols) if (hasCol.has(t + "." + col) && !cov(t, col)) semBusca.push(`${t}.${col}`);
add("colunas_busca_indexadas", semBusca.length === 0, semBusca.length ? `sem indice: ${semBusca.join(", ")}` : "FKs de busca (prestador/cliente/os/aloc/pagamento/fechamento) indexadas");

// ── 5. RPCs — volatilidade ───────────────────────────────────────────────────
const rpcs = await c.query(
  `select p.proname, p.provolatile, p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'f_%' or p.proname like 'calcular%') order by p.proname`);
out.rpcs = rpcs.rows;
const vol = { v: "VOLATILE", s: "STABLE", i: "IMMUTABLE" };
const readOnly = rpcs.rows.filter((r) => /^(f_buscar|f_obter|f_listar|f_pp_tenant|current_tenant)/.test(r.proname));
const readOnlyVol = readOnly.filter((r) => r.provolatile === "v");
console.log("\n=== RPCs leitura ===");
for (const r of readOnly) console.log(`  ${r.proname} = ${vol[r.provolatile]}`);
add("rpcs_leitura_stable", readOnlyVol.length === 0, readOnlyVol.length ? `VOLATILE: ${readOnlyVol.map(r=>r.proname).join(",")}` : `${readOnly.length} RPCs de leitura em STABLE/definer`);

// ── 6. Estatisticas ──────────────────────────────────────────────────────────
const st = await c.query(`select relname tabela, n_live_tup, n_dead_tup, seq_scan, idx_scan from pg_stat_user_tables where relname = any($1) order by n_live_tup desc`, [T]);
out.stats = st.rows;
console.log("\n=== ESTATISTICAS ===");
for (const r of st.rows) console.log(`  ${r.tabela}: live=${r.n_live_tup} dead=${r.n_dead_tup} seq=${r.seq_scan} idx=${r.idx_scan}`);
const altoSeq = st.rows.filter((r) => Number(r.seq_scan) > 2000 && Number(r.idx_scan) === 0);
add("sem_seq_scan_excessivo", altoSeq.length === 0, altoSeq.length ? altoSeq.map(r=>r.tabela).join(",") : "nenhuma tabela com seq_scan alto e zero idx_scan");
const dead = st.rows.filter((r) => Number(r.n_dead_tup) > 1000);
add("dead_tuples_ok", dead.length === 0, dead.length ? `dead_tuples altos: ${dead.map(r=>r.tabela+"="+r.n_dead_tup).join(",")}` : "sem acumulo relevante de dead tuples");

await c.end();
fs.writeFileSync("scripts/_tms02perf_auditoria.json", JSON.stringify(out, null, 2));
const falhas = out.checks.filter((x) => !x.ok).length;
console.log(`\nCHECKSUM: ${out.checks.length - falhas}/${out.checks.length} OK`);
console.log("EVIDENCIA: scripts/_tms02perf_auditoria.json");
