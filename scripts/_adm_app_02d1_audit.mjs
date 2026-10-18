import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();
const o = {};

// 1) schema da tabela
o.tabela = (await c.query(
  `select column_name, data_type, is_nullable from information_schema.columns
    where table_schema='public' and table_name='documentos_prestadores'
    order by ordinal_position`)).rows;
o.rls_tabela = (await c.query(
  `select relrowsecurity, relforcerowsecurity from pg_class
    where oid='public.documentos_prestadores'::regclass`)).rows;
o.policies_tabela = (await c.query(
  `select policyname, cmd, roles::text[] roles, qual, with_check from pg_policies
    where schemaname='public' and tablename='documentos_prestadores'
    order by policyname`)).rows;

// 2) bucket
o.bucket = (await c.query(
  `select id, name, public, created_at from storage.buckets where name='documentos_prestadores'`)).rows;
o.policies_storage = (await c.query(
  `select policyname, cmd, roles::text[] roles, qual, with_check from pg_policies
    where schemaname='storage' and tablename='objects'
    order by policyname`)).rows;
o.storage_objects = (await c.query(
  `select count(*)::int n from storage.objects where bucket_id =
     (select id from storage.buckets where name='documentos_prestadores')`)).rows[0].n;
o.storage_by_prefix = (await c.query(
  `select split_part(name,'/',1) prefix, count(*)::int n
     from storage.objects where bucket_id =
       (select id from storage.buckets where name='documentos_prestadores')
     group by 1 order by 2 desc limit 20`)).rows;

// 3) classificacao das URLs persistidas (somente leitura)
const rows = (await c.query(
  `select id, prestador_id, tipo, url, created_at from documentos_prestadores order by created_at`)).rows;
const cat = { total: rows.length, public_url_bucket: 0, public_url_outro_bucket: 0,
  sign_url: 0, authenticated_url: 0, path_puro: 0, bucket_path: 0, externa_http: 0,
  nula_vazia: 0, local_file: 0, desconhecido: 0 };
const bucketsVistos = {};
const exemplos = {};
const registros = rows.map(r => {
  const u = (r.url ?? "").toString();
  const v = u.trim();
  let formato = "desconhecido", bucket = null, path = null, objetoExiste = null;
  if (!v) { formato = "nula_vazia"; }
  else {
    const m = v.match(/\/storage\/v1\/object\/(public|sign|authenticated|render)\/([^/]+)\/(.+)$/);
    if (m) {
      bucket = m[2]; path = m[3].split("?")[0];
      formato = m[1] === "public" ? (bucket === "documentos_prestadores" ? "public_url_bucket" : "public_url_outro_bucket")
             : m[1] === "sign" ? "sign_url" : "authenticated_url";
    } else if (/^(https?:)?\/\//i.test(v) || /^https?:\/\//i.test(v)) {
      formato = "externa_http";
      const b = v.match(/\/storage\/v1\/object\/public\/([^/]+)\//); if (b) bucket = b[1];
    } else if (v.startsWith("file://") || v.startsWith("/data/") || /^[a-zA-Z]:[\\/]/.test(v)) {
      formato = "local_file";
    } else if (/^[a-zA-Z0-9_-]+\/.+/.test(v)) {
      const first = v.split("/")[0];
      if (["documentos_prestadores","driver-evidence","comprovantes-entrega","documentos","prestadores","veiculos","contratos","fiscal-documentos","biblioteca-global","certificados-fiscais"].includes(first)) {
        formato = "bucket_path"; bucket = first; path = v.slice(first.length + 1);
      } else { formato = "path_puro"; path = v; bucket = "documentos_prestadores"; }
    } else { formato = "path_puro"; path = v; bucket = "documentos_prestadores"; }
  }
  if (bucket) bucketsVistos[bucket] = (bucketsVistos[bucket] || 0) + 1;
  cat[formato] = (cat[formato] || 0) + 1;
  if (!exemplos[formato]) exemplos[formato] = { id: r.id, tipo: r.tipo, url: u.slice(0, 160) };
  return { id: r.id, prestador_id: r.prestador_id, tipo: r.tipo, formato, bucket, path, url: u };
});

// 4) existencia do objeto no storage para cada path resolvido
const paths = [...new Set(registros.filter(r => r.path).map(r => `${r.bucket}\u0000${r.path}`))];
const existentes = new Set();
for (const p of paths) {
  const [b, pa] = p.split("\u0000");
  const q = await c.query(
    `select name from storage.objects where bucket_id =
       (select id from storage.buckets where name=$1) and name=$2`, [b, pa]);
  if (q.rows.length) existentes.add(p);
}
let objetoOk = 0, objetoFaltando = 0, semPath = 0;
for (const r of registros) {
  if (!r.path) { semPath++; continue; }
  if (existentes.has(`${r.bucket}\u0000${r.path}`)) objetoOk++; else objetoFaltando++;
}
o.classificacao = cat;
o.buckets_nas_refs = bucketsVistos;
o.exemplos = exemplos;
o.objetos = { com_path: registros.length - semPath, existentes: objetoOk, faltando: objetoFaltando, sem_path: semPath };
o.orfaos = (await c.query(
  `select count(*)::int n from documentos_prestadores where prestador_id is null`)).rows[0].n;
o.por_prestador = (await c.query(
  `select prestador_id, count(*)::int n from documentos_prestadores group by 1 order by 2 desc limit 10`)).rows;
o.por_tipo = (await c.query(
  `select tipo, count(*)::int n from documentos_prestadores group by 1 order by 2 desc`)).rows;
o.legacy_urls_que_precisam_normalizacao = registros.filter(
  r => r.formato === "public_url_bucket" || r.formato === "public_url_outro_bucket").length;
o.detalhe = registros;
o.ts = (await c.query(`select now() agora`)).rows[0].agora;

console.log(JSON.stringify(o, null, 2));
await c.end();
