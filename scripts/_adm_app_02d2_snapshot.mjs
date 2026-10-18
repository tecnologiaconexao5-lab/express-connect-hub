import pg from "pg";
import fs from "node:fs";
import crypto from "node:crypto";

const fase = process.argv[2] || "antes";
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();
const o = { fase, ts: null };

const sha = (s) => crypto.createHash("sha256").update(String(s ?? ""), "utf8").digest("hex");

// 1) bucket
o.bucket = (await c.query(
  `select id, name, public, allowed_mime_types, file_size_limit, created_at
     from storage.buckets where id = 'documentos_prestadores'`)).rows;
o.outros_buckets_publicos = (await c.query(
  `select id, public from storage.buckets order by id`)).rows;
o.objetos_bucket = (await c.query(
  `select count(*)::int n from storage.objects where bucket_id='documentos_prestadores'`)).rows[0].n;

// 2) TODAS as policies de storage.objects (aplicaveis ao bucket)
const pols = (await c.query(
  `select policyname, cmd, roles::text[] roles, qual, with_check
     from pg_policies where schemaname='storage' and tablename='objects'
     order by policyname`)).rows;
o.policies_storage = pols.map(p => {
  const q = `${p.qual || ""} ${p.with_check || ""}`;
  return { ...p, aplicavel_ao_bucket: q.includes("'documentos_prestadores'") };
});
o.policies_storage_alvo_bucket = o.policies_storage.filter(p => p.aplicavel_ao_bucket);
o.policies_storage_globais_sem_qual = o.policies_storage.filter(p => !p.qual && !p.with_check);
o.storage_hash_antes = sha(o.policies_storage_alvo_bucket.map(p => [p.policyname, p.cmd, (p.roles||[]).join(","), p.qual, p.with_check].join("|")).join("\n"));
o.storage_hash_antes_todas = sha(o.policies_storage.map(p => [p.policyname, p.cmd, (p.roles||[]).join(","), p.qual, p.with_check].join("|")).join("\n"));

// 3) tabela documentos_prestadores
o.tabela_linhas = (await c.query(`select count(*)::int n from documentos_prestadores`)).rows[0].n;
o.tabela_classificacao = (await c.query(
  `select count(*) filter (where url is null or btrim(url)='')::int vazia,
          count(*) filter (where prestador_id is null)::int prestador_null,
          count(*) filter (where url like 'http%public%')::int public_url,
          count(*) filter (where url like 'doc\_%' or url like 'foto\_%')::int path_convencao
     from documentos_prestadores`)).rows[0];
const dp = (await c.query(
  `select policyname, cmd, roles::text[] roles, qual, with_check
     from pg_policies where schemaname='public' and tablename='documentos_prestadores'
     order by policyname`)).rows;
o.policies_tabela = dp;
o.dp_count = dp.length;
o.tabela_hash_antes = sha(dp.map(p => [p.policyname, p.cmd, (p.roles||[]).join(","), p.qual, p.with_check].join("|")).join("\n"));
o.rls_tabela = (await c.query(
  `select relrowsecurity, relforcerowsecurity from pg_class where oid='public.documentos_prestadores'::regclass`)).rows;

// 4) atores para os testes
o.prestadores_com_auth = (await c.query(
  `select id, nome_completo, auth_user_id from prestadores
     where auth_user_id is not null order by nome_completo limit 20`)).rows;
o.prestadores_total = (await c.query(`select count(*)::int n from prestadores`)).rows[0].n;
o.tenant_usuarios = (await c.query(
  `select user_id, papel from tenant_usuarios order by papel limit 20`)).rows;
o.tenant_usuarios_n = o.tenant_usuarios.length;
o.objetos_por_prestador = (await c.query(
  `select split_part(split_part(name,'_',2),'/',1) pref, count(*)::int n
     from storage.objects where bucket_id='documentos_prestadores' and (name like 'doc\_%' or name like 'foto\_%')
     group by 1 order by 2 desc limit 15`)).rows;

o.ts = (await c.query(`select now() agora`)).rows[0].agora;
fs.writeFileSync(`scripts/_adm_app_02d2_snapshot_${fase}.json`, JSON.stringify(o, null, 2));
console.log(JSON.stringify({
  fase, ts: o.ts,
  bucket_public: o.bucket[0]?.public,
  objetos: o.objetos_bucket,
  linhas_tabela: o.tabela_linhas,
  classificacao: o.tabela_classificacao,
  policies_storage_total: o.policies_storage.length,
  policies_storage_alvo: o.policies_storage_alvo_bucket.map(p => `${p.policyname}[${p.cmd}][${(p.roles||[]).join(",")}]`),
  policies_globais_sem_qual: o.policies_storage_globais_sem_qual.map(p => p.policyname),
  storage_hash: o.storage_hash_antes,
  dp_count: o.dp_count, tabela_hash: o.tabela_hash_antes,
  prestadores_com_auth: o.prestadores_com_auth.length,
  tenant_usuarios: o.tenant_usuarios_n,
  objetos_por_prestador: o.objetos_por_prestador,
}, null, 2));
await c.end();
