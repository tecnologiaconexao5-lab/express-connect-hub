require('dotenv').config();
const crypto = require('crypto');
const { Client } = require('pg');
const EMAIL = 'prestador_12345678900@conexaoexpress.com.br';
const AUTH_ID = '399796b7-4e3b-432f-8744-4eb91f0ee31d';

(async () => {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) { console.log('RESULT=BLOCKED_NO_SUPABASE_ENV'); process.exit(1); }

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const pw = 'HmlE2E06-' + crypto.randomBytes(9).toString('hex');

  // Define a senha da identidade HML temporaria.
  await c.query("update auth.users set encrypted_password = extensions.crypt($1, extensions.gen_salt('bf')), updated_at = now() where id=$2", [pw, AUTH_ID]);

  // Testa login real via GoTrue (Supabase Auth).
  const res = await fetch(url.replace(/\/$/, '') + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: 'Bearer ' + anon },
    body: JSON.stringify({ email: EMAIL, password: pw }),
  });
  const body = await res.json().catch(() => ({}));
  const ok = res.status === 200 && !!body.access_token;
  console.log('AUTH_HTTP=' + res.status);
  console.log('AUTH_OK=' + ok);
  console.log('AUTH_USER_ID=' + (body.user && body.user.id ? body.user.id : '-'));
  console.log('AUTH_USER_ID_MATCH=' + (body.user && body.user.id === AUTH_ID));
  console.log('SUPABASE_AUTH_PASS=' + (ok ? 'YES' : 'NO'));

  // Senha errada -> rejeitado (indistinguivel, sem vazar identidade).
  const bad = await fetch(url.replace(/\/$/, '') + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: 'Bearer ' + anon },
    body: JSON.stringify({ email: EMAIL, password: pw + '-errada' }),
  });
  console.log('WRONG_PASSWORD_REJECTED=' + (bad.status !== 200 ? 'YES' : 'NO'));

  console.log('=== CREDENCIAIS TEMPORARIAS (USO UNICO - NAO REGISTRAR) ===');
  console.log('LOGIN_HML=' + EMAIL);
  console.log('SENHA_HML=' + pw);
  await c.end();
})().catch((e) => { console.error('ERR:' + e.message); process.exit(1); });
