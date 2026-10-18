import { BASE, ANON, SR } from "./_adm_app_02d2_env.mjs";

const OUT = "scripts/_adm_app_02d2r1_login_check.out.json";
const res = {};

async function sr(path, init = {}) {
  const r = await fetch(BASE + path, {
    ...init,
    headers: {
      apikey: SR,
      Authorization: `Bearer ${SR}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  return { status: r.status, body: await r.json() };
}

// 1. status do prestador fixture A
{
  const { status, body } = await sr("/rest/v1/prestadores?id=eq.ee4511bb-956e-4ff0-af82-9e61b0bf1870&select=id,status,ativo,auth_user_id,email,nome_completo");
  res.prestadorA = { status, body };
}

// 2. login fixture A via anon (signInWithPassword)
{
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "adm02d2_prest_a@teste.com", password: "Adm02d2!PrestA_2026" }),
  });
  const b = await r.json();
  res.loginA = { status: r.status, access_token_presente: !!b.access_token, error: b.error_description || b.msg || b.error || null };
}

// 3. count da tabela documentos_prestadores (não lê conteúdo)
{
  const r = await fetch(`${BASE}/rest/v1/documentos_prestadores?select=id&limit=1000`, {
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, Range: "0-999", Prefer: "count=exact" },
  });
  res.docs_range = { status: r.status, content_range: r.headers.get("content-range") };
}

// 4. bucket status
{
  const { status, body } = await sr("/storage/v1/bucket/documentos_prestadores");
  res.bucket = { status, public: body?.public };
}

import fs from "node:fs";
fs.writeFileSync(OUT, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
