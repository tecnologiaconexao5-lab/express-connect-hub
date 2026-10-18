import pg from "pg";
import fs from "node:fs";
import crypto from "node:crypto";

const sha = (s) => crypto.createHash("sha256").update(String(s ?? ""), "utf8").digest("hex");
const modo = process.argv[2] || "rehearse";
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const fwd = fs.readFileSync("supabase/migrations/20260928000000_adm_app_02d2_bucket_documentos_privado.sql", "utf8");

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
  const hash = sha(pols.map(p => [p.policyname, p.cmd, (p.roles || []).join(","), p.qual, p.with_check].join("|")).join("\n"));
  const hashDp = sha(dp.map(p => [p.policyname, p.cmd, (p.roles || []).join(","), p.qual, p.with_check].join("|")).join("\n"));
  return { tag, public: bucket?.public, n_policies: pols.length, nomes: pols.map(p => `${p.policyname}[${p.cmd}][${(p.roles || []).join(",")}]`), hash, dp: dp.length, hashDp };
}

const antes = await estado("antes");
console.log("ANTES:", JSON.stringify(antes, null, 1));

if (modo === "rehearse") {
  // executa o FORWARD sem COMMIT para validar sintaxe + efeitos, e desfaz
  const sql = fwd.replace(/^\s*BEGIN;\s*/i, "").replace(/\s*COMMIT;\s*$/i, "");
  await c.query("BEGIN");
  await c.query(sql);
  const dentro = await estado("dentro-da-transacao");
  console.log("APLICADO (na transação):", JSON.stringify(dentro, null, 1));
  const okBucket = dentro.public === false;
  const okNovas = dentro.nomes.every(n => n.includes("_privado"));
  const okQtd = dentro.n_policies === 4;
  const okDp = dentro.dp === 8 && dentro.hashDp === antes.hashDp;
  await c.query("ROLLBACK");
  const depois = await estado("apos-rollback");
  console.log("APÓS ROLLBACK:", JSON.stringify(depois, null, 1));
  const okRestaurado = depois.public === true && depois.hash === antes.hash && depois.hashDp === antes.hashDp;
  console.log(JSON.stringify({ okBucket, okQtd, okNovas, okDp, okRestaurado,
    PASS: okBucket && okQtd && okNovas && okDp && okRestaurado }, null, 2));
} else if (modo === "apply") {
  await c.query(fwd);
  const depois = await estado("pos-apply");
  console.log("APLICADO EM PRODUÇÃO:", JSON.stringify(depois, null, 1));
  const ok = depois.public === false && depois.n_policies === 4
    && depois.nomes.every(n => n.includes("_privado"))
    && depois.dp === 8 && depois.hashDp === antes.hashDp;
  console.log(JSON.stringify({ PASS: ok, hash_depois: depois.hash, hashDp_depois: depois.hashDp }, null, 2));
} else if (modo === "verify") {
  const depois = await estado("verify");
  console.log(JSON.stringify(depois, null, 2));
}
await c.end();
