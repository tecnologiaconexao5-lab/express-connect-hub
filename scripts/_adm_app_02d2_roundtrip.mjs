import pg from "pg";
import fs from "node:fs";
import crypto from "node:crypto";

// ADM-APP-02D.2 — ROUND-TRIP EM TRANSAÇÃO (rollback + forward + rollback final)
// Valida que o ROLLBACK restaura o estado 02D.1 e que o FORWARD reaplica o estado
// 02D.2, SEM alterar nada em produção (transação sempre desfeita).

const sha = (s) => crypto.createHash("sha256").update(String(s ?? ""), "utf8").digest("hex");
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL\s*=\s*(.+)$/m)[1].trim();
const limpa = (sql) => sql.replace(/^\s*BEGIN;\s*/i, "").replace(/\s*COMMIT;\s*$/i, "");
const fwd = limpa(fs.readFileSync("supabase/migrations/20260928000000_adm_app_02d2_bucket_documentos_privado.sql", "utf8"));
const bwd = limpa(fs.readFileSync("supabase/migrations/20260928000001_adm_app_02d2_rollback.sql", "utf8"));

const HASH_02D1 = "97f18480895b2aca345798a70e83d336585649fedcc98171d3ea25ef629bebb1";
const HASH_02D2 = "b308c19d88f1ea0c5540568d1cd80711bcddb93b16f6ffa76d3da29e9074dc44";
const HASH_DP = "477d12130df5c169947f2f09f921c1f828b368b1631a388e10f12ee89613db96";

const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();

async function estado(tag) {
  const bucket = (await c.query(`select public from storage.buckets where id='documentos_prestadores'`)).rows[0];
  const pols = (await c.query(`select policyname, cmd, roles::text[] roles, qual, with_check
      from pg_policies where schemaname='storage' and tablename='objects'
       and (coalesce(qual,'') || ' ' || coalesce(with_check,'')) like '%documentos_prestadores%'
      order by policyname`)).rows;
  const dp = (await c.query(`select policyname, cmd, roles::text[] roles, qual, with_check
      from pg_policies where schemaname='public' and tablename='documentos_prestadores' order by policyname`)).rows;
  const objetos = (await c.query(`select count(*)::int n from storage.objects where bucket_id='documentos_prestadores'`)).rows[0].n;
  const linhas = (await c.query(`select count(*)::int n from documentos_prestadores`)).rows[0].n;
  const hash = sha(pols.map(p => [p.policyname, p.cmd, (p.roles || []).join(","), p.qual, p.with_check].join("|")).join("\n"));
  const hashDp = sha(dp.map(p => [p.policyname, p.cmd, (p.roles || []).join(","), p.qual, p.with_check].join("|")).join("\n"));
  return { tag, public: bucket?.public, n_policies: pols.length,
    nomes: pols.map(p => `${p.policyname}[${p.cmd}]`), hash, dp: dp.length, hashDp, objetos, linhas };
}

const resultados = [];
const check = (id, cond, detalhe) => {
  resultados.push({ id, passou: !!cond, detalhe });
  console.log(`${cond ? "PASS" : "FALHA"}  ${id} ${detalhe || ""}`);
};

const antes = await estado("antes");
console.log("ESTADO ATUAL (produção):", JSON.stringify(antes, null, 1));
check("RT-00 estado inicial = 02D.2 aplicado",
  antes.public === false && antes.n_policies === 4 && antes.hash === HASH_02D2 && antes.dp === 8 && antes.hashDp === HASH_DP,
  `public=${antes.public} policies=${antes.n_policies} hash=${antes.hash.slice(0, 12)}…`);

try {
  await c.query("BEGIN");

  // 1) ROLLBACK dentro da transação
  await c.query(bwd);
  const aposBwd = await estado("pos-rollback");
  check("RT-01 rollback devolve bucket público (public=true)", aposBwd.public === true, `public=${aposBwd.public}`);
  check("RT-02 rollback restaura as 6 policies originais",
    aposBwd.n_policies === 6 && aposBwd.hash === HASH_02D1,
    `policies=${aposBwd.n_policies} hash=${aposBwd.hash.slice(0, 12)}…`);
  check("RT-03 rollback não toca na tabela (8 dp_*, hash intacto)",
    aposBwd.dp === 8 && aposBwd.hashDp === HASH_DP, `dp=${aposBwd.dp}`);
  check("RT-04 rollback preserva objetos e linhas (78 / 32)",
    aposBwd.objetos === antes.objetos && aposBwd.linhas === antes.linhas,
    `objetos=${aposBwd.objetos} linhas=${aposBwd.linhas}`);

  // 2) FORWARD dentro da mesma transação
  await c.query(fwd);
  const aposFwd = await estado("pos-forward");
  check("RT-05 forward privatiza o bucket (public=false)", aposFwd.public === false, `public=${aposFwd.public}`);
  check("RT-06 forward cria exatamente 4 policies _privado",
    aposFwd.n_policies === 4 && aposFwd.nomes.every(n => n.includes("_privado")),
    `policies=${aposFwd.n_policies} ${aposFwd.nomes.join(", ")}`);
  check("RT-07 hash de policies 02D.2 reproduzido", aposFwd.hash === HASH_02D2, `hash=${aposFwd.hash.slice(0, 12)}…`);
  check("RT-08 forward não toca na tabela nem nos dados",
    aposFwd.dp === 8 && aposFwd.hashDp === HASH_DP && aposFwd.objetos === antes.objetos && aposFwd.linhas === antes.linhas,
    `dp=${aposFwd.dp} objetos=${aposFwd.objetos} linhas=${aposFwd.linhas}`);
} finally {
  // 3) NUNCA commita: desfaz tudo e prova que produção não mudou
  await c.query("ROLLBACK").catch(() => {});
}

const final = await estado("final");
check("RT-09 produção inalterada após round-trip (02D.2 intacto)",
  final.public === false && final.n_policies === 4 && final.hash === HASH_02D2
  && final.dp === 8 && final.hashDp === HASH_DP && final.objetos === antes.objetos && final.linhas === antes.linhas,
  `public=${final.public} policies=${final.n_policies} objetos=${final.objetos} linhas=${final.linhas}`);
console.log("ESTADO FINAL (produção):", JSON.stringify(final, null, 1));

const passou = resultados.filter(r => r.passou).length;
console.log(`\nROUND-TRIP: ${passou}/${resultados.length} PASS`);
console.log(resultados.filter(r => !r.passou).map(r => `  FALHA ${r.id}: ${r.detalhe}`).join("\n") || "  sem falhas");
fs.writeFileSync("scripts/_adm_app_02d2_roundtrip.out.json",
  JSON.stringify({ ts: new Date().toISOString(), antes, final, total: resultados.length, passou, resultados }, null, 2));
await c.end();
process.exit(resultados.length === passou ? 0 : 1);
