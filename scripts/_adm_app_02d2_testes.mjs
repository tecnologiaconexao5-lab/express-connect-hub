import fs from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { BASE, ANON, SR, DB } from "./_adm_app_02d2_env.mjs";

const BUCKET = "documentos_prestadores";
const fix = JSON.parse(fs.readFileSync("scripts/_adm_app_02d2_fixture.json", "utf8"));
const ts = Date.now();

const anon = createClient(BASE, ANON);
async function cliente(email, senha) {
  const c = createClient(BASE, ANON);
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}
const A = await cliente(fix.A.email, "Adm02d2!PrestA_2026");
const B = await cliente(fix.B.email, "Adm02d2!PrestB_2026");
const T = await cliente(fix.T.email, "Adm02d2!Tms_2026");

const pgC = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await pgC.connect();

const pathA = `doc_${fix.A.prestador_id}_TESTE02D2_${ts}.txt`;
const pathB = `doc_${fix.B.prestador_id}_TESTE02D2_${ts}.txt`;
const pathTMS = `adm02d2_tms_teste_${ts}.txt`;
const CONTEUDO_A = `conteudo-A ${ts}`;
const CONTEUDO_B = `conteudo-B ${ts}`;

const realAlheio = (await pgC.query(
  `select name from storage.objects where bucket_id=$1 and name like 'doc_b7f86dbb%' limit 1`, [BUCKET])).rows[0]?.name;
const tmsLegacy = realAlheio;

const resultados = [];
async function caso(id, desc, fn) {
  try {
    const info = await fn();
    resultados.push({ id, desc, passou: true, ...(info || {}) });
    console.log(`PASS  ${id} ${desc}`);
  } catch (e) {
    resultados.push({ id, desc, passou: false, erro: String(e.message || e) });
    console.log(`FALHA ${id} ${desc} :: ${e.message}`);
  }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const negado = (r) => {
  if (r.error) return { motivo: r.error.message };
  if (r.data === null || r.data === undefined) return { motivo: "data null" };
  if (Array.isArray(r.data) && r.data.length === 0) return { motivo: "0 linhas" };
  if (r.data && r.data.signedUrl === undefined && r.data.signedURL === undefined && typeof r.data === "object" && Object.keys(r.data).length === 0) return { motivo: "objeto vazio" };
  return null;
};

// ============================== SETUP (objetos TESTE) ==============================
console.log("--- setup: objetos TESTE de A e B ---");
const upB = await B.storage.from(BUCKET).upload(pathB, CONTEUDO_B, { contentType: "text/plain" });
ok(!upB.error, `setup B upload falhou: ${upB.error?.message}`);
const upA = await A.storage.from(BUCKET).upload(pathA, CONTEUDO_A, { contentType: "text/plain" });
ok(!upA.error, `setup A upload falhou: ${upA.error?.message}`);
console.log("objetos TESTE:", pathA, "|", pathB);

// ============================== N01..N05 — ANON ==============================
await caso("N01", "anon NÃO lista objetos do bucket", async () => {
  const r = await anon.storage.from(BUCKET).list("", { limit: 10 });
  ok(negado(r), `anon listou: ${JSON.stringify(r.data)?.slice(0, 120)}`);
  return { detalhe: r.error?.message || "0 linhas" };
});
await caso("N02", "anon NÃO lê objeto (download + public URL)", async () => {
  const r = await anon.storage.from(BUCKET).download(pathB);
  ok(negado(r), "anon baixou objeto");
  const pub = await fetch(`${BASE}/storage/v1/object/public/${BUCKET}/${pathB}`);
  ok(pub.status === 404 || pub.status === 400 || pub.status === 401 || pub.status === 403,
    `public URL status=${pub.status}`);
  return { download: r.error?.message || "negado", public_url_status: pub.status };
});
await caso("N03", "anon NÃO faz upload", async () => {
  const r = await anon.storage.from(BUCKET).upload(`doc_anon_TESTE02D2_${ts}.txt`, "x", { contentType: "text/plain" });
  ok(negado(r), "anon conseguiu upload");
  return { detalhe: r.error?.message || "negado" };
});
await caso("N04", "anon NÃO atualiza objeto", async () => {
  const r = await anon.storage.from(BUCKET).update(pathB, "hack", { contentType: "text/plain" });
  ok(negado(r), "anon atualizou objeto");
  return { detalhe: r.error?.message || "negado" };
});
await caso("N05", "anon NÃO exclui objeto", async () => {
  const r = await anon.storage.from(BUCKET).remove([pathB]);
  ok(negado(r), "anon excluiu objeto");
  const still = await pgC.query(`select 1 from storage.objects where bucket_id=$1 and name=$2`, [BUCKET, pathB]);
  ok(still.rows.length === 1, "objeto sumiu após delete anon");
  return { detalhe: r.error?.message || "negado", objeto_preservado: true };
});

// ============================== N06..N10 — PRESTADOR A × B ==============================
await caso("N06", "prestador A NÃO lê documento do prestador B", async () => {
  const r1 = await A.storage.from(BUCKET).download(pathB);
  ok(negado(r1), "A baixou objeto de B");
  const r2 = await A.storage.from(BUCKET).download(realAlheio);
  ok(negado(r2), "A baixou documento real de terceiro");
  return { objeto_b: r1.error?.message || "negado", objeto_real_terceiro: r2.error?.message || "negado" };
});
await caso("N07", "prestador A NÃO assina path de B", async () => {
  const r1 = await A.storage.from(BUCKET).createSignedUrl(pathB, 600);
  ok(negado(r1), "A assinou path de B");
  const r2 = await A.storage.from(BUCKET).createSignedUrl(realAlheio, 600);
  ok(negado(r2), "A assinou documento real de terceiro");
  return { path_b: r1.error?.message || "negado", real: r2.error?.message || "negado" };
});
await caso("N08", "prestador A NÃO faz upload usando ID de B", async () => {
  const p = `doc_${fix.B.prestador_id}_INVADIR02D2_${ts}.txt`;
  const r = await A.storage.from(BUCKET).upload(p, "invasao", { contentType: "text/plain" });
  ok(negado(r), "A gravou arquivo com ID de B");
  const gone = await pgC.query(`select 1 from storage.objects where bucket_id=$1 and name=$2`, [BUCKET, p]);
  ok(gone.rows.length === 0, "objeto invasor existe no storage");
  return { detalhe: r.error?.message || "negado", sem_objeto_criado: true };
});
await caso("N09", "prestador A NÃO altera objeto de B", async () => {
  const r = await A.storage.from(BUCKET).update(pathB, "hackeado", { contentType: "text/plain" });
  ok(negado(r), "A alterou objeto de B");
  const chk = await B.storage.from(BUCKET).download(pathB);
  ok(!chk.error, "objeto de B ficou ilegível");
  const txt = await chk.data.text();
  ok(txt === CONTEUDO_B, `conteúdo de B foi alterado: ${txt}`);
  return { detalhe: r.error?.message || "negado", conteudo_b_preservado: true };
});
await caso("N10", "prestador A NÃO exclui objeto de B", async () => {
  const r = await A.storage.from(BUCKET).remove([pathB]);
  ok(negado(r), "A removeu objeto de B");
  const still = await pgC.query(`select 1 from storage.objects where bucket_id=$1 and name=$2`, [BUCKET, pathB]);
  ok(still.rows.length === 1, "objeto de B foi excluído");
  return { detalhe: r.error?.message || "negado", objeto_preservado: true };
});

// ============================== N11..N12 — MALFORMADO / EXTERNO ==============================
await caso("N11", "path malformado / fora da convenção é negado", async () => {
  const alheios = [
    `doc_00000000-0000-0000-0000-000000000000_TESTE02D2_${ts}.txt`,
    `foto_${fix.B.prestador_id}_INVADIR_${ts}.txt`,
    `../documentos_prestadores_escapada.txt`,
    `temp/escapada_${ts}.txt`,
  ];
  const negados = [];
  for (const p of alheios) {
    const r = await A.storage.from(BUCKET).upload(p, "x", { contentType: "text/plain" });
    if (!negado(r)) throw new Error(`path permitido: ${p}`);
    negados.push({ path: p, motivo: r.error?.message || "negado" });
  }
  const sign = await A.storage.from(BUCKET).createSignedUrl(`temp/${ts}.txt`, 600);
  ok(negado(sign), "A assinou path fora da convenção");
  return { negados: negados.length, detalhe: negados.map(n => n.path) };
});
await caso("N12", "bucket/path externo não concede acesso", async () => {
  const r1 = await A.storage.from("driver-evidence").upload(`nao_e_meu/${ts}.txt`, "x", { contentType: "text/plain" });
  ok(negado(r1), "A gravou em pasta de terceiro em bucket externo");
  const r2 = await A.storage.from("driver-evidence").download(`doc_${fix.A.prestador_id}_TESTE02D2_${ts}.txt`);
  ok(negado(r2), "A alcançou objeto do bucket alvo via bucket externo");
  const r3 = await anon.storage.from(BUCKET).createSignedUrl(pathA, 600);
  ok(negado(r3), "anon assinou path válido");
  return { bucket_externo: r1.error?.message || "negado", alvo_via_externo: r2.error?.message || "negado", anon_sign: r3.error?.message || "negado" };
});

// ============================== P01..P07 — POSITIVOS ==============================
await caso("P01", "próprio prestador faz upload", async () => {
  const r = await A.storage.from(BUCKET).upload(pathA, CONTEUDO_A, { contentType: "text/plain", upsert: true });
  ok(!r.error, `upload próprio falhou: ${r.error?.message}`);
  return { path: pathA, data: r.data?.path };
});
await caso("P02", "próprio prestador cria signed URL com TTL 600", async () => {
  const r = await A.storage.from(BUCKET).createSignedUrl(pathA, 600);
  ok(!r.error && r.data?.signedUrl, `sign falhou: ${r.error?.message}`);
  const token = new URL(r.data.signedUrl).searchParams.get("token");
  const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
  const ttl = claims.exp - claims.iat;
  ok(ttl === 600, `TTL do token = ${ttl}s (esperado 600)`);
  ok(claims.url?.startsWith(`${BUCKET}/`) || claims.url?.includes(pathA), `claims.url=${claims.url}`);
  return { ttl_segundos: ttl, scope: claims.scope };
});
let signedA = null;
await caso("P03", "signed URL retorna o conteúdo", async () => {
  const r = await A.storage.from(BUCKET).createSignedUrl(pathA, 600);
  signedA = r.data.signedUrl;
  const res = await fetch(signedA);
  const txt = await res.text();
  ok(res.status === 200, `status=${res.status}`);
  ok(txt === CONTEUDO_A || txt.includes(String(ts)), `conteudo inesperado: ${txt}`);
  return { status: res.status, bytes: txt.length, sem_token: true };
});
await caso("P04", "próprio atualiza e exclui SOMENTE o objeto TESTE próprio", async () => {
  const novo = `${CONTEUDO_A}-v2`;
  const up = await A.storage.from(BUCKET).update(pathA, novo, { contentType: "text/plain" });
  ok(!up.error, `update falhou: ${up.error?.message}`);
  const dl = await A.storage.from(BUCKET).download(pathA);
  ok(!dl.error, `download pos-update falhou: ${dl.error?.message}`);
  const direto = await dl.data.text();
  ok(direto === novo, `download direto pos-update: ${direto}`);
  const sign = await A.storage.from(BUCKET).createSignedUrl(pathA, 600);
  let txt = await (await fetch(sign.data.signedUrl, { cache: "no-store" })).text();
  if (txt !== novo) {
    await new Promise(r => setTimeout(r, 1500));
    const sign2 = await A.storage.from(BUCKET).createSignedUrl(pathA, 600);
    txt = await (await fetch(sign2.data.signedUrl, { cache: "no-store" })).text();
  }
  ok(txt === novo, `conteudo via signed pos-update: ${txt}`);
  const del = await A.storage.from(BUCKET).remove([pathA]);
  ok(!del.error, `delete falhou: ${del.error?.message}`);
  const gone = await pgC.query(`select 1 from storage.objects where bucket_id=$1 and name=$2`, [BUCKET, pathA]);
  ok(gone.rows.length === 0, "objeto TESTE de A não foi excluído");
  return { atualizado: true, conteudo_final: txt, excluido: true };
});
await caso("P05", "TMS (tenant_usuarios) lista e lê", async () => {
  const lst = await T.storage.from(BUCKET).list("", { limit: 100 });
  ok(!lst.error, `list falhou: ${lst.error?.message}`);
  ok(Array.isArray(lst.data) && lst.data.length > 0, "TMS listou 0 objetos");
  const dl = await T.storage.from(BUCKET).download(tmsLegacy);
  ok(!dl.error, `download legado falhou: ${dl.error?.message}`);
  const bytes = (await dl.data.arrayBuffer()).byteLength;
  ok(bytes > 0, "objeto legado vazio");
  return { objetos_listados: lst.data.length, legado: tmsLegacy, bytes };
});
await caso("P06", "TMS cria signed URL", async () => {
  const r = await T.storage.from(BUCKET).createSignedUrl(tmsLegacy, 600);
  ok(!r.error && r.data.signedUrl, `sign TMS falhou: ${r.error?.message}`);
  const res = await fetch(r.data.signedUrl);
  ok(res.status === 200, `signed TMS status=${res.status}`);
  return { status: res.status, expiresIn: r.data.expiresIn };
});
await caso("P07", "TMS faz upload e delete de objeto TESTE", async () => {
  const up = await T.storage.from(BUCKET).upload(pathTMS, "tms-teste", { contentType: "text/plain" });
  ok(!up.error, `upload TMS falhou: ${up.error?.message}`);
  const del = await T.storage.from(BUCKET).remove([pathTMS]);
  ok(!del.error, `delete TMS falhou: ${del.error?.message}`);
  const gone = await pgC.query(`select 1 from storage.objects where bucket_id=$1 and name=$2`, [BUCKET, pathTMS]);
  ok(gone.rows.length === 0, "objeto TESTE TMS persistiu");
  return { upload: true, delete: true };
});

// ============================== P08..P09 — TABELA ==============================
await caso("P08", "tabela documentos_prestadores continua funcional", async () => {
  const total = (await pgC.query(`select count(*)::int n from documentos_prestadores`)).rows[0].n;
  ok(total === 32, `linhas=${total} (esperado 32)`);
  const rls = (await pgC.query(`select relrowsecurity from pg_class where oid='public.documentos_prestadores'::regclass`)).rows[0].relrowsecurity;
  ok(rls === true, "RLS da tabela desligada");
  // sessão autenticada do próprio prestador consulta a tabela (RLS dp_select_prestador)
  const q = await A.from("documentos_prestadores").select("*");
  ok(!q.error, `consulta autenticada falhou: ${q.error?.message}`);
  return { linhas: total, rls, linhas_visiveis_prestador_A: q.data.length };
});
await caso("P09", "as 8 policies dp_* permanecem intactas", async () => {
  const dp = (await pgC.query(`select policyname, cmd, roles::text[] roles, qual, with_check
     from pg_policies where schemaname='public' and tablename='documentos_prestadores' order by policyname`)).rows;
  ok(dp.length === 8, `policies dp_* = ${dp.length}`);
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256")
    .update(dp.map(p => [p.policyname, p.cmd, (p.roles || []).join(","), p.qual, p.with_check].join("|")).join("\n")).digest("hex");
  ok(hash === "477d12130df5c169947f2f09f921c1f828b368b1631a388e10f12ee89613db96", `hash divergiu: ${hash}`);
  return { count: 8, hash };
});

// ============================== LIMPEZA IMEDIATA ==============================
const admin = createClient(BASE, SR, { auth: { persistSession: false } });
const rem = await admin.storage.from(BUCKET).remove([pathA, pathB, pathTMS]);
console.log("limpeza storage (service_role):", rem.error ? rem.error.message : `${rem.data?.length ?? 0} objeto(s)`);
await pgC.query(`delete from documentos_prestadores where prestador_id = ANY($1::uuid[])`,
  [[fix.A.prestador_id, fix.B.prestador_id]]);

const passou = resultados.filter(r => r.passou).length;
const resumo = { ts: new Date().toISOString(), total: resultados.length, passou,
  falhou: resultados.length - passou, resultados };
fs.writeFileSync("scripts/_adm_app_02d2_testes.out.json", JSON.stringify(resumo, null, 2));
console.log(`\nRESULTADO: ${passou}/${resultados.length} PASS`);
console.log(resultados.filter(r => !r.passou).map(r => `  FALHA ${r.id}: ${r.desc} — ${r.erro}`).join("\n") || "  sem falhas");
await pgC.end();
process.exit(resultados.length === passou ? 0 : 1);
