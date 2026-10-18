import pg from "pg";
import fs from "node:fs";

import { BASE, ANON, SR, DB } from "./_adm_app_02d2_env.mjs";

const SENHA_A = "Adm02d2!PrestA_2026";
const SENHA_B = "Adm02d2!PrestB_2026";
const SENHA_T = "Adm02d2!Tms_2026";
const EMAIL_A = "adm02d2_prest_a@teste.com";
const EMAIL_B = "adm02d2_prest_b@teste.com";
const EMAIL_T = "adm02d2_tms@teste.com";

const hdr = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };

async function rest(method, path, body, headers) {
  const res = await fetch(BASE + path, { method, headers: { ...hdr, ...(headers || {}) },
    body: body === undefined || body === null ? undefined : JSON.stringify(body) });
  const txt = await res.text();
  let json = null; try { json = JSON.parse(txt); } catch { /* noop */ }
  return { status: res.status, json, txt };
}

async function criarUser(email, senha, meta) {
  const del = await rest("DELETE", `/auth/v1/admin/users?email=${encodeURIComponent(email)}`);
  const r = await rest("POST", "/auth/v1/admin/users", { email, password: senha, email_confirm: true, user_metadata: meta });
  if (r.status >= 300) throw new Error(`criarUser ${email}: ${r.status} ${r.txt}`);
  return r.json.id;
}

async function logar(email, senha) {
  const r = await fetch(BASE + "/auth/v1/token?grant_type=password", {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: senha }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(j)}`);
  return { access_token: j.access_token, refresh_token: j.refresh_token, user_id: j.user.id };
}

const modo = process.argv[2] || "up";

if (modo === "up") {
  const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await c.connect();
  // remove fixtures anteriores
  await c.query(`delete from tenant_usuarios where user_id in (
      select id from auth.users where email like 'adm02d2_%@teste.com')`);
  await c.query(`delete from prestadores where nome_completo like '02D2 FIXTURE %'`);
  const tenant = (await c.query(`select tenant_id from tenant_usuarios order by criado_em limit 1`)).rows[0].tenant_id;
  await c.end();

  const idA = await criarUser(EMAIL_A, SENHA_A, { origem: "adm_app_02d2" });
  const idB = await criarUser(EMAIL_B, SENHA_B, { origem: "adm_app_02d2" });
  const idT = await criarUser(EMAIL_T, SENHA_T, { origem: "adm_app_02d2" });

  const c2 = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await c2.connect();
  const pa = await c2.query(`insert into prestadores (nome_completo, auth_user_id, origem, status)
     values ('02D2 FIXTURE PREST A', $1, 'manual', 'ativo') returning id`, [idA]);
  const pb = await c2.query(`insert into prestadores (nome_completo, auth_user_id, origem, status)
     values ('02D2 FIXTURE PREST B', $1, 'manual', 'ativo') returning id`, [idB]);
  const tu = await c2.query(`insert into tenant_usuarios (tenant_id, user_id, papel, status)
     values ($1, $2, 'operacional', 'ativo') returning id`, [tenant, idT]);
  await c2.end();

  const sessA = await logar(EMAIL_A, SENHA_A);
  const sessB = await logar(EMAIL_B, SENHA_B);
  const sessT = await logar(EMAIL_T, SENHA_T);

  const fix = { ts: new Date().toISOString(), tenant,
    A: { email: EMAIL_A, user_id: idA, prestador_id: pa.rows[0].id, jwt: sessA.access_token },
    B: { email: EMAIL_B, user_id: idB, prestador_id: pb.rows[0].id, jwt: sessB.access_token },
    T: { email: EMAIL_T, user_id: idT, tenant_usuarios_id: tu.rows[0].id, jwt: sessT.access_token } };
  fs.writeFileSync("scripts/_adm_app_02d2_fixture.json", JSON.stringify(fix, null, 2));
  console.log(JSON.stringify({ ...fix, jwt: "<omitted>" }, null, 2));
  console.log("FIXTURE OK");
} else if (modo === "down") {
  const fix = JSON.parse(fs.readFileSync("scripts/_adm_app_02d2_fixture.json", "utf8"));
  // 1) objetos de teste no bucket
  const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const objs = await c.query(`select name from storage.objects
     where bucket_id='documentos_prestadores'
       and (name like $1 or name like $2 or name like 'adm02d2_%')`,
     [`doc_${fix.A.prestador_id}_%`, `doc_${fix.B.prestador_id}_%`]);
  const objsT = await c.query(`select name from storage.objects
     where bucket_id='documentos_prestadores' and name like 'doc_${fix.A.prestador_id}%'`).catch(() => ({ rows: [] }));
  console.log("objetos fixture a remover:", objs.rows.map(r => r.name));
  for (const o of objs.rows) {
    const r = await fetch(`${BASE}/storage/v1/object/documentos_prestadores/${o.name}`, {
      method: "DELETE", headers: { apikey: SR, Authorization: `Bearer ${SR}` } });
    console.log("  delete", o.name, r.status);
  }
  // 2) linhas de teste da tabela (nenhuma criada, mas garante)
  await c.query(`delete from documentos_prestadores where prestador_id in ($1,$2) and url like '%TESTE02D2%'`,
    [fix.A.prestador_id, fix.B.prestador_id]);
  // 3) fixture rows
  const r1 = await c.query(`delete from tenant_usuarios where id = $1`, [fix.T.tenant_usuarios_id]);
  const r2 = await c.query(`delete from prestadores where id = ANY($1::uuid[])`, [[fix.A.prestador_id, fix.B.prestador_id]]);
  await c.end();
  // 4) auth users
  for (const u of [fix.A, fix.B, fix.T]) {
    const r = await fetch(`${BASE}/auth/v1/admin/users/${u.user_id}`, { method: "DELETE", headers: hdr });
    console.log("delete auth user", u.email, r.status);
  }
  console.log(JSON.stringify({ tenant_usuarios_removidos: r1.rowCount, prestadores_removidos: r2.rowCount,
    objetos_removidos: objs.rows.length, auth_users_removidos: 3 }));
  console.log("FIXTURE DOWN OK");
}
