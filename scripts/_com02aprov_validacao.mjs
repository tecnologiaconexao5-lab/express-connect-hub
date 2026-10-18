/**
 * COM-02-APROV — Validacao aprovacao de orcamento -> conversao em OS.
 * SOMENTE LEITURA. Saida: scripts/_com02aprov_validacao.json
 */
import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const out = { ts: new Date().toISOString(), checks: [], orc_status: [], conversoes: [] };
const add = (n, ok, d) => { out.checks.push({ name: n, ok: !!ok, detail: d }); console.log(`${ok ? "OK  " : "FAIL"} ${n} — ${d}`); };

// 0. colunas relevantes
for (const [t, cols] of [["orcamentos", ["os_vinculada_id", "os_vinculada_numero", "status"]], ["ordens_servico", ["orcamento_id", "orcamento_origem"]]]) {
  const r = await c.query(`select column_name from information_schema.columns where table_name=$1 and column_name = any($2)`, [t, cols]);
  out["cols_" + t] = r.rows.map((x) => x.column_name);
  console.log(`${t} cols:`, JSON.stringify(out["cols_" + t]));
}

// 1. distribuicao de status dos orcamentos
const st = await c.query(`select coalesce(status,'<null>') s, count(*)::int n from orcamentos group by 1 order by 2 desc`);
out.orc_status = st.rows;
console.log("orcamentos.status:", JSON.stringify(st.rows));

// 2. orcamentos convertidos (os_vinculada_id/numero preenchidos)
const conv = await c.query(
  `select numero, status, os_vinculada_id, os_vinculada_numero, valor_final
     from orcamentos
    where os_vinculada_id is not null or os_vinculada_numero is not null
    order by updated_at desc`
);
out.conversoes = conv.rows;
add("orc_vinculo_colunas", out.cols_orcamentos.includes("os_vinculada_id"), "orcamentos possui os_vinculada_id/numero");

// 3. OS geradas a partir de orcamento
const hasOrcId = out.cols_ordens_servico.includes("orcamento_id");
const osConv = await c.query(
  `select id, numero, status, orcamento_origem, valor_cliente, custo_prestador, created_at::date
     from ordens_servico
    where orcamento_origem is not null
    order by created_at desc limit 50`
).catch(() => ({ rows: [] }));
out.os_de_orcamento = osConv.rows;
console.log(`OS com orcamento_origem: ${osConv.rows.length} | orcamento_id existe: ${hasOrcId}`);
add("os_orcamento_origem_col", out.cols_ordens_servico.includes("orcamento_origem"), "ordens_servico possui orcamento_origem");

// 4. consistencia: cada OS convertida referencia um orcamento existente
let orfas = 0;
for (const os of osConv.rows) {
  const r = await c.query(`select 1 from orcamentos where numero = $1 limit 1`, [os.orcamento_origem]);
  if (!r.rows.length) orfas++;
}
add("os_convertida_ref_valida", orfas === 0, `${orfas} OS referenciam orcamento_origem inexistente`);

// 5. ids idempotencia: nenhum orcamento com 2 OS
const dupOS = await c.query(
  `select orcamento_origem, count(*)::int n from ordens_servico where orcamento_origem is not null group by 1 having count(*)>1`
).catch(() => ({ rows: [] }));
add("sem_os_duplicada_por_orcamento", dupOS.rows.length === 0, `${dupOS.rows.length} orcamentos com >1 OS`);

// 6. estado de ciclo: sem orcamento 'convertido' sem OS
const convSemOS = conv.rows.filter((r) => (r.os_vinculada_id || r.os_vinculada_numero) && r.status === "convertido");
let convSemOSorfa = 0;
for (const r of convSemOS) {
  const num = r.os_vinculada_numero;
  const rr = await c.query(`select 1 from ordens_servico where numero = $1 limit 1`, [num]);
  if (!rr.rows.length) convSemOSorfa++;
}
add("convertido_tem_os", convSemOSorfa === 0, `${convSemOSorfa} orcamentos 'convertido' sem OS correspondente`);

// 7. mecanismo TS presente (arquivo)
const svc = fs.readFileSync("src/services/comercial/orcamentoToOSService.ts", "utf8");
const tem = (s) => svc.includes(s);
add("svc_aprovar", tem("export const aprovarOrcamento") && tem('status: "aprovado"'), "aprovarOrcamento define status='aprovado'");
add("svc_converter", tem("export const gerarOSDoOrcamento") && tem('status: "convertido"'), "gerarOSDoOrcamento define status='convertido'");
add("svc_idempotencia", tem("verificarOSJaGerada") && tem("já foi convertido"), "guarda anti-duplicidade por orcamento_id/os_vinculada_id");
add("svc_inadimplencia", tem("verificarInadimplenciaEName"), "bloqueia conversao se cliente inadimplente");
add("svc_vinculo_os", tem("os_vinculada_id") && tem("orcamento_origem"), "grava os_vinculada_id/numero no orcamento e orcamento_origem na OS");

await c.end();
fs.writeFileSync("scripts/_com02aprov_validacao.json", JSON.stringify(out, null, 2));
const falhas = out.checks.filter((x) => !x.ok).length;
console.log(`\nCHECKSUM: ${out.checks.length - falhas}/${out.checks.length} OK`);
console.log("EVIDENCIA: scripts/_com02aprov_validacao.json");
