/**
 * ADM-APP-02D.2-R2 — Prova PC (Supabase/Storage) do doc TESTE do Prestador A.
 * Somente LEITURA: SELECT, listagem de storage, geracao de signed URL.
 *  - prestador_id vem do fixture JSON (fixture 02D.2 recriada nesta R2).
 *  - prova isolamento (docs de outros prestadores intactos) e byte-a-byte
 *    do conteudo lido via signed URL vs arquivo enviado pelo TMS.
 * Saida: scripts\_adm_app_02d2r2_db_proof.json
 *        test-results\02d2\d2r2_db_signed_lido.png
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { Client } from "pg";
import { BASE, ANON, SR, DB } from "./_adm_app_02d2_env.mjs";

const fix = JSON.parse(fs.readFileSync("scripts/_adm_app_02d2_fixture.json", "utf8"));
const PRESTADOR_A = fix.A.prestador_id;
const PRESTADOR_B = fix.B.prestador_id;
const BUCKET = "documentos_prestadores";
const ARQUIVO_ORIGEM = "scripts/_adm_app_02d2r1_doc_teste.png";
const out = { ts: new Date().toISOString(), prestador_A: PRESTADOR_A, prestador_B: PRESTADOR_B, checks: [] };

function add(name, ok, detail) {
  out.checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"} ${name} — ${detail}`);
}

const pg = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await pg.connect();

// 1) registro pertence ao Prestador A
const r1 = await pg.query(
  "select id, prestador_id, tipo, url, created_at from documentos_prestadores where prestador_id = $1 order by created_at desc",
  [PRESTADOR_A]
);
add("1_row_prestador_A", r1.rows.length === 1, JSON.stringify(r1.rows));
if (!r1.rows.length) {
  fs.writeFileSync("scripts/_adm_app_02d2r2_db_proof.json", JSON.stringify(out, null, 2));
  await pg.end();
  process.exit(1);
}
const row = r1.rows[0];
out.row = row;
const url = row.url || "";

// 2) path estavel persistido (nao signed URL) + tipo/nome
add("2_path_estavel", new RegExp(`^doc_${PRESTADOR_A}_Outros_\\d+\\.png$`).test(url), `url persistida = ${url}`);
add(
  "2b_url_persistida_nao_e_signed",
  !/\/object\/sign\//.test(url) && !/token=/.test(url) && !/^https?:\/\//.test(url),
  "coluna url guarda apenas o path (sem /object/sign, token ou http)"
);
add("2c_tipo_Outros", row.tipo === "Outros", `tipo = ${row.tipo}`);

// 3) objeto existe no bucket
const r3 = await pg.query(
  "select bucket_id, name, created_at from storage.objects where bucket_id = $1 and name = $2",
  [BUCKET, url]
);
add("3_objeto_no_bucket", r3.rows.length === 1, JSON.stringify(r3.rows));
const r3b = await pg.query("select count(*)::int as n from storage.objects where bucket_id = $1", [BUCKET]);
out.total_objetos_bucket = r3b.rows[0].n;

// 4) bucket permanece privado
const r4 = await fetch(`${BASE}/storage/v1/bucket`, {
  headers: { apikey: ANON, Authorization: `Bearer ${SR}` },
});
const buckets = await r4.json();
const b = (buckets || []).find((x) => x.name === BUCKET);
add("4_bucket_public_false", b && b.public === false, `bucket public = ${b ? b.public : "NAO_ENCONTRADO"}`);
out.bucket = b ? { name: b.name, public: b.public } : null;

// 5) anon (sem credencial) negado em /object/, /object/sign/ e /object/public/
const anonAuth = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${url}`);
add("5_anon_object_negado", anonAuth.status !== 200, `anon /object/ -> ${anonAuth.status}`);
const anonSign = await fetch(`${BASE}/storage/v1/object/sign/${BUCKET}/${url}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ expiresIn: 600 }),
});
add("5b_anon_sign_negado", anonSign.status !== 200, `anon sign sem authorization -> ${anonSign.status}`);
const anonPublic = await fetch(`${BASE}/storage/v1/object/public/${BUCKET}/${url}`);
add("5c_anon_public_negado", anonPublic.status !== 200, `anon /object/public/ -> ${anonPublic.status}`);

// 6) signed URL temporaria (caminho real do App/TMS)
const r6 = await fetch(`${BASE}/storage/v1/object/sign/${BUCKET}/${url}`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" },
  body: JSON.stringify({ expiresIn: 600 }),
});
const signed = await r6.json();
const signedPath = signed?.signedURL || signed?.signedUrl || "";
add("6_signed_url_com_token", r6.status === 200 && /token=/.test(signedPath), `signedURL = ${String(signedPath).slice(0, 60)}... (token omitido)`);
out.signed_url_exemplo = signedPath ? signedPath.replace(/token=[^&]+/, "token=OMITIDO") : null;

let shaOrigem = null;
if (signedPath) {
  const abs = signedPath.startsWith("http") ? signedPath : `${BASE}/storage/v1${signedPath}`;
  const g = await fetch(abs);
  const buf = Buffer.from(await g.arrayBuffer());
  add(
    "6b_signed_legivel_sem_credencial",
    g.status === 200 && buf.length > 0 && (g.headers.get("content-type") || "").startsWith("image/"),
    `status=${g.status} bytes=${buf.length} content-type=${g.headers.get("content-type")}`
  );
  fs.writeFileSync("test-results/02d2/d2r2_db_signed_lido.png", buf);
  out.signed_bytes = buf.length;
  shaOrigem = crypto.createHash("sha256").update(fs.readFileSync(ARQUIVO_ORIGEM)).digest("hex");
  const shaLido = crypto.createHash("sha256").update(buf).digest("hex");
  add("6c_conteudo_identico_ao_enviado", shaLido === shaOrigem, `sha256 lido=${shaLido.slice(0, 16)} origem=${shaOrigem.slice(0, 16)}`);
}

// 7) isolamento — nenhum outro documento real tocado
const r7a = await pg.query("select count(*)::int as n from documentos_prestadores");
const r7b = await pg.query("select count(*)::int as n from documentos_prestadores where prestador_id is distinct from $1", [PRESTADOR_A]);
const r7c = await pg.query("select count(*)::int as n from documentos_prestadores where prestador_id = $1", [PRESTADOR_B]);
out.isolamento = { total: r7a.rows[0].n, outros_prestadores: r7b.rows[0].n, prestador_B: r7c.rows[0].n };
add(
  "7_isolamento_outros_intactos",
  r7c.rows[0].n === 0 && r7a.rows[0].n === r7b.rows[0].n + 1,
  `total=${r7a.rows[0].n} outros=${r7b.rows[0].n} prestador_B=${r7c.rows[0].n}`
);

await pg.end();
fs.writeFileSync("scripts/_adm_app_02d2r2_db_proof.json", JSON.stringify(out, null, 2));
const falhas = out.checks.filter((c) => !c.ok).length;
console.log(`\nTOTAL: ${out.checks.length - falhas}/${out.checks.length} OK`);
console.log("EVIDENCIA: scripts/_adm_app_02d2r2_db_proof.json");
process.exit(falhas ? 1 : 0);
