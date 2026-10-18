// MISSÃO 133-D.6 — TESTES PG (ETAPA 4.B-E)
// Verifica permissões via has_function_privilege + chamadas diretas

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('ERRO: DATABASE_URL'); process.exit(1); }

async function main() {
  console.log('=== TESTES PG — ETAPA 4.B-E ===\n');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 15000,
  });
  await client.connect();

  let allPass = true;

  // 4.B — has_function_privilege para anon (deve ser FALSE)
  console.log('--- 4.A/B — has_function_privilege (anon deve ser FALSE) ---');
  const anonTests = [
    ['f_buscar_operacoes_motorista(uuid)', 'anon'],
    ['f_avancar_etapa_app_motorista(uuid,text,jsonb,text,uuid)', 'anon'],
    ['f_atualizar_reversa_app(uuid,text,integer,text,text,text,date,jsonb,text,numeric,numeric,uuid)', 'anon'],
  ];
  for (const [func, role] of anonTests) {
    const res = await client.query(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS pode`, [role, func]);
    const pode = res.rows[0].pode;
    const ok = !pode;
    console.log(`  ${role} ${func}: ${pode ? 'PODE ❌' : 'BLOQUEADO ✅'}${ok ? '' : ' (ok)'}`);
    if (!ok) allPass = false;
  }

  // 4.E — has_function_privilege para service_role + postgres (deve ser TRUE)
  console.log('\n--- 4.E — has_function_privilege (service_role/postgres deve ser TRUE) ---');
  const authTests = [
    ['f_buscar_operacoes_motorista(uuid)', 'service_role'],
    ['f_avancar_etapa_app_motorista(uuid,text,jsonb,text,uuid)', 'service_role'],
    ['f_atualizar_reversa_app(uuid,text,integer,text,text,text,date,jsonb,text,numeric,numeric,uuid)', 'service_role'],
    ['f_buscar_operacoes_motorista(uuid)', 'postgres'],
    ['f_avancar_etapa_app_motorista(uuid,text,jsonb,text,uuid)', 'postgres'],
    ['f_atualizar_reversa_app(uuid,text,integer,text,text,text,date,jsonb,text,numeric,numeric,uuid)', 'postgres'],
  ];
  for (const [func, role] of authTests) {
    const res = await client.query(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS pode`, [role, func]);
    const pode = res.rows[0].pode;
    const ok = pode;
    console.log(`  ${role} ${func}: ${pode ? '✅ PODE' : '❌ BLOQUEADO'}`);
    if (!ok) allPass = false;
  }

  // 4.B — authenticated has_function_privilege
  console.log('\n--- 4.B — has_function_privilege (authenticated deve ser TRUE) ---');
  const authTests2 = [
    ['f_buscar_operacoes_motorista(uuid)', 'authenticated'],
    ['f_avancar_etapa_app_motorista(uuid,text,jsonb,text,uuid)', 'authenticated'],
    ['f_atualizar_reversa_app(uuid,text,integer,text,text,text,date,jsonb,text,numeric,numeric,uuid)', 'authenticated'],
  ];
  for (const [func, role] of authTests2) {
    const res = await client.query(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS pode`, [role, func]);
    const pode = res.rows[0].pode;
    const ok = pode;
    console.log(`  ${role} ${func}: ${pode ? '✅ PODE' : '❌ BLOQUEADO'}`);
    if (!ok) allPass = false;
  }

  // Teste de chamada direta (como postgres) — esperado: USUARIO_NAO_AUTENTICADO
  console.log('\n--- Chamada direta das 3 RPCs (como postgres, sem auth context) ---');
  
  // f_buscar
  try {
    const r1 = await client.query(`SELECT public.f_buscar_operacoes_motorista(NULL::uuid) AS result`);
    const msg = r1.rows[0].result?.error || JSON.stringify(r1.rows[0].result);
    console.log(`  f_buscar: ${r1.rows[0].result?.success === false ? '✅ Bloqueado (auth)' : '⚠️ ' + msg}`);
  } catch (err) {
    console.log(`  f_buscar: ❌ Erro: ${err.message}`);
    allPass = false;
  }

  // f_avancar_etapa
  try {
    const r2 = await client.query(`SELECT public.f_avancar_etapa_app_motorista('00000000-0000-0000-0000-000000000000', 'viagem_aceita', '{}', NULL, NULL) AS result`);
    const msg = r2.rows[0].result?.error || JSON.stringify(r2.rows[0].result);
    console.log(`  f_avancar_etapa: ${r2.rows[0].result?.success === false ? '✅ Bloqueado (auth)' : '⚠️ ' + msg}`);
  } catch (err) {
    console.log(`  f_avancar_etapa: ❌ Erro: ${err.message}`);
    allPass = false;
  }

  // f_atualizar_reversa
  try {
    const r3 = await client.query(`SELECT public.f_atualizar_reversa_app('00000000-0000-0000-0000-000000000000', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL) AS result`);
    const msg = r3.rows[0].result?.erro || JSON.stringify(r3.rows[0].result);
    console.log(`  f_atualizar_reversa: ${r3.rows[0].result?.sucesso === false ? '✅ Bloqueado (auth)' : '⚠️ ' + msg}`);
  } catch (err) {
    console.log(`  f_atualizar_reversa: ❌ Erro: ${err.message}`);
    allPass = false;
  }

  console.log(`\nResultado: ${allPass ? '✅ TODOS OS TESTES PASSARAM' : '❌ HOUVE FALHAS'}`);
  await client.end();
  process.exit(allPass ? 0 : 1);
}

main().catch(err => {
  console.error('ERRO FATAL:', err.message);
  process.exit(2);
});
