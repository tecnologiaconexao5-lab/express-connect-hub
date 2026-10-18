import pg from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const CLIENT_EMAIL = "cliente.teste@conexaoexpress.com.br";

async function main() {
  console.log("=".repeat(72));
  console.log("DIAGNÓSTICO — DATABASE ERROR QUERYING SCHEMA");
  console.log("=".repeat(72));

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // ==========================================================================
  // 1. Triggers em auth.users
  // ==========================================================================
  console.log("\n1. TRIGGERS EM auth.users");

  const triggers = await client.query(`
    SELECT t.tgname AS trigger_name,
           p.proname AS function_name,
           pg_get_triggerdef(t.oid) AS trigger_def
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'users' AND n.nspname = 'auth'
      AND NOT t.tgisinternal
  `);
  if (triggers.rows.length === 0) {
    console.log("  Nenhum trigger encontrado (ou consulta falhou)");
  } else {
    for (const tr of triggers.rows) {
      console.log(`  Trigger: ${tr.trigger_name}`);
      console.log(`  Função: ${tr.function_name}`);
      console.log(`  Def: ${tr.trigger_def?.substring(0, 200)}`);
    }
  }

  // ==========================================================================
  // 2. Functions do schema auth que são chamadas em login
  // ==========================================================================
  console.log("\n2. FUNCTIONS DO AUTH (possivelmente chamadas em login)");

  const functions = await client.query(`
    SELECT p.proname AS function_name,
           l.lanname AS language,
           pg_get_functiondef(p.oid) AS func_def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'auth'
      AND p.proname IN ('login', 'sign_in', 'authenticate', 'confirm', 'is_authorized',
                        'role', 'check_col', 'users', 'email', 'uid')
    ORDER BY p.proname
  `);
  if (functions.rows.length === 0) {
    console.log("  Nenhuma function auth encontrada com nomes comuns");
  } else {
    for (const fn of functions.rows) {
      console.log(`  Function: ${fn.function_name} (${fn.language})`);
    }
  }

  // List ANY function in auth schema
  const allFuncs = await client.query(`
    SELECT p.proname, l.lanname, p.prosrc::text AS src
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'auth'
    ORDER BY p.proname
  `);
  console.log(`  Total functions in auth schema: ${allFuncs.rows.length}`);
  for (const fn of allFuncs.rows) {
    console.log(`    ${fn.proname} (${fn.lanname})`);
  }

  // ==========================================================================
  // 3. Tabelas do schema public e auth
  // ==========================================================================
  console.log("\n3. TABELAS RELACIONADAS");

  const tablesToCheck = ["usuarios_cliente", "tenant_usuarios", "usuarios_cliente_tenant", "clientes", "alocacoes_escala", "financeiro_receber"];

  for (const tbl of tablesToCheck) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tbl]);
    console.log(`\n  --- ${tbl} (${cols.rows.length} colunas) ---`);
    for (const c of cols.rows) {
      console.log(`    ${c.column_name}: ${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    }
  }

  // ==========================================================================
  // 4. RLS Policies
  // ==========================================================================
  console.log("\n4. RLS POLICIES");

  const policies = await client.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename IN ('usuarios_cliente', 'tenant_usuarios', 'usuarios_cliente_tenant', 'clientes', 'alocacoes_escala', 'financeiro_receber')
    ORDER BY tablename, policyname
  `);
  if (policies.rows.length === 0) {
    console.log("  Nenhuma policy encontrada");
  } else {
    for (const p of policies.rows) {
      console.log(`\n  ${p.tablename} / ${p.policyname}:`);
      console.log(`    Roles: ${p.roles}`);
      console.log(`    Cmd: ${p.cmd}`);
      console.log(`    Qual: ${(p.qual || '').substring(0, 200)}`);
      console.log(`    With check: ${(p.with_check || '').substring(0, 200)}`);
    }
  }

  // ==========================================================================
  // 5. Verificar triggers de users que podem referenciar colunas inexistentes
  // ==========================================================================
  console.log("\n5. ANALISAR TRIGGERS/FUNCTIONS EM DETALHE");

  for (const tr of triggers.rows) {
    console.log(`\n  Função ${tr.function_name}:`);
    const funcDetail = await client.query(`
      SELECT p.prosrc FROM pg_proc p
      WHERE p.proname = $1 AND p.pronamespace = (SELECT pg_namespace.oid FROM pg_namespace WHERE pg_namespace.nspname = 'auth')
    `, [tr.function_name]);
    if (funcDetail.rows.length > 0) {
      const source = funcDetail.rows[0].prosrc;
      console.log(`    Código (primeiros 2000 chars):`);
      console.log(`    ${source.substring(0, 2000)}`);
    }
  }

  // Also check any handle_new_user trigger
  const handleTriggers = await client.query(`
    SELECT t.tgname, t.tgrelid::regclass::text AS table_name,
           t.tgfoid::regproc::text AS function_name,
           pg_get_triggerdef(t.oid) AS trigger_def
    FROM pg_trigger t
    WHERE t.tgname LIKE '%user%' OR t.tgname LIKE '%auth%' OR t.tgname LIKE '%handle%'
      AND NOT t.tgisinternal
  `);
  console.log("\n  Triggers com 'user'/'auth'/'handle' no nome (schema auth ou public):");
  if (handleTriggers.rows.length === 0) {
    console.log("    Nenhum encontrado");
  } else {
    for (const tr of handleTriggers.rows) {
      console.log(`    ${tr.tgname} on ${tr.table_name}: ${tr.function_name}`);
    }
  }

  // ==========================================================================
  // 6. Verificar o usuário cliente no auth
  // ==========================================================================
  console.log("\n6. USUÁRIO CLIENTE NO AUTH");

  const authUser = await client.query(`
    SELECT id, email, email_confirmed_at, confirmed_at, raw_user_meta_data, raw_app_meta_data,
           encrypted_password IS NOT NULL AS has_password,
           is_sso_user, is_anonymous, created_at, updated_at, last_sign_in_at,
           confirmation_sent_at
    FROM auth.users WHERE email = $1
  `, [CLIENT_EMAIL]);

  if (authUser.rows.length === 0) {
    console.log(`  USUÁRIO ${CLIENT_EMAIL} NÃO EXISTE EM auth.users`);
    console.log("  CAUSA PROVÁVEL: Foi deletado pelo script anterior sem ser recriado.");
  } else {
    const u = authUser.rows[0];
    console.log(`  ID: ${u.id}`);
    console.log(`  Email confirmed at: ${u.email_confirmed_at}`);
    console.log(`  Confirmed at: ${u.confirmed_at}`);
    console.log(`  Confirmation sent at: ${u.confirmation_sent_at}`);
    console.log(`  Has password: ${u.has_password}`);
    console.log(`  Is SSO: ${u.is_sso_user}`);
    console.log(`  Is anonymous: ${u.is_anonymous}`);
    console.log(`  Last sign in: ${u.last_sign_in_at}`);
    console.log(`  Raw app meta: ${JSON.stringify(u.raw_app_meta_data)}`);
    console.log(`  Raw user meta: ${JSON.stringify(u.raw_user_meta_data)}`);

    // Identities
    const identities = await client.query(`
      SELECT provider, provider_id, identity_data FROM auth.identities WHERE user_id = $1
    `, [u.id]);
    console.log(`  Identities: ${identities.rows.length}`);
    for (const ident of identities.rows) {
      console.log(`    Provider: ${ident.provider}`);
      console.log(`    Provider ID: ${ident.provider_id}`);
      console.log(`    Identity data: ${JSON.stringify(ident.identity_data).substring(0, 200)}`);
    }
  }

  // ==========================================================================
  // 7. Verificar vínculos na tabela public
  // ==========================================================================
  console.log("\n7. VÍNCULOS DO CLIENTE EM TABELAS PUBLIC");

  // Need to handle the case where auth user may or may not exist
  let authUserId = authUser.rows[0]?.id;

  if (authUserId) {
    // usuarios_cliente
    const uc = await client.query(`
      SELECT * FROM usuarios_cliente WHERE auth_user_id = $1
    `, [authUserId]);
    console.log(`  usuarios_cliente: ${uc.rows.length} registros`);
    for (const r of uc.rows) {
      console.log(`    ID: ${r.id}, Nome: ${r.nome}, Email: ${r.email}, Tipo: ${r.tipo}, Ativo: ${r.ativo}`);
    }

    // tenant_usuarios
    const tu = await client.query(`
      SELECT * FROM tenant_usuarios WHERE auth_user_id = $1
    `, [authUserId]);
    console.log(`  tenant_usuarios: ${tu.rows.length} registros`);
    for (const r of tu.rows) {
      console.log(`    ID: ${r.id}, Tenant: ${r.tenant_id}, Papel: ${r.papel}`);
    }

    // usuarios_cliente_tenant
    const uct = await client.query(`
      SELECT * FROM usuarios_cliente_tenant WHERE auth_user_id = $1
    `, [authUserId]);
    console.log(`  usuarios_cliente_tenant: ${uct.rows.length} registros`);
    for (const r of uct.rows) {
      console.log(`    ID: ${r.id}, Tenant: ${r.tenant_id}, Papel: ${r.papel}`);
    }

    // clientes table
    const cl = await client.query(`
      SELECT * FROM clientes c
      JOIN usuarios_cliente uc ON uc.cliente_id = c.id OR uc.email = $1
      WHERE uc.auth_user_id = $2
      LIMIT 5
    `, [CLIENT_EMAIL, authUserId]);
    console.log(`  clientes (via join usuarios_cliente): ${cl.rows.length} registros`);
    for (const r of cl.rows) {
      console.log(`    ID: ${r.id}, Nome: ${r.nome}, Documento: ${r.documento}`);
    }
  } else {
    console.log("  (auth user não existe, pulando vínculos)");
  }

  // ==========================================================================
  // 8. Verificar extensão pgcrypto
  // ==========================================================================
  console.log("\n8. EXTENSÕES DO BANCO");
  const extensions = await client.query(`
    SELECT extname, extversion FROM pg_extension ORDER BY extname
  `);
  for (const ext of extensions.rows) {
    console.log(`  ${ext.extname}: ${ext.extversion}`);
  }

  // ==========================================================================
  // 9. Verificar função crypt no auth schema ou public
  // ==========================================================================
  console.log("\n9. VERIFICAR FUNÇÃO crypt/pgcrypto");
  const cryptFuncs = await client.query(`
    SELECT n.nspname, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname IN ('crypt', 'gen_salt')
    ORDER BY n.nspname, p.proname
  `);
  for (const fn of cryptFuncs.rows) {
    console.log(`  ${fn.nspname}.${fn.proname}`);
  }

  // ==========================================================================
  // 10. RESUMO E CAUSA PROVÁVEL
  // ==========================================================================
  console.log("\n" + "=".repeat(72));
  console.log("RESUMO DO DIAGNÓSTICO");
  console.log("=".repeat(72));

  if (authUser.rows.length === 0) {
    console.log("\n  USUÁRIO NÃO EXISTE: cliente.teste@conexaoexpress.com.br não está em auth.users");
    console.log("  Provável: foi deletado pelo script _fix_client_user2.ts anterior.");
    console.log("  Correção: Recriar via fluxo oficial Supabase.");
    console.log("  Recomendação: Usar supabase.auth.signUp() + confirmar via SQL seguro.");
  } else {
    const u = authUser.rows[0];
    console.log(`\n  USUÁRIO EXISTE: ${u.id}`);

    if (!u.email_confirmed_at) {
      console.log("  ⚠️ Email NÃO confirmado");
    }

    if (!u.has_password) {
      console.log("  ⚠️ Sem senha");
    }

    // Check identities
    const identCount = (await client.query(`SELECT COUNT(*) FROM auth.identities WHERE user_id = $1`, [u.id])).rows[0].count;
    if (parseInt(identCount) === 0) {
      console.log("  ⚠️ Sem identities");
    }

    // Check trigger issues
    console.log("\n  Possíveis causas do erro 'Database error querying schema':");
    console.log("  1. Trigger ou função no schema 'auth' que referencia uma tabela/coluna");
    console.log("     que não existe ou foi alterada por migration recente.");
    console.log("  2. Função 'login' ou 'sign_in' no auth schema que executa SQL dinâmico");
    console.log("     e falha ao referenciar campo ausente.");
    console.log("  3. Trigger 'on_auth_user_created' ou similar que tenta inserir em tabela");
    console.log("     que não existe ou viola constraint.");
    console.log("  4. RLS policy que referencia coluna inexistente na tabela.");
    console.log("  5. Migração recente que removeu/renomeou coluna referenciada pelo auth.");
  }

  // Check for JSONB operator issues in policies
  console.log("\n  Verificando policies com operadores JSONB:");
  for (const p of policies.rows) {
    if ((p.qual || '').includes('->') || (p.with_check || '').includes('->')) {
      console.log(`    ${p.tablename} / ${p.policyname}: usa operador JSONB ->`);
    }
  }

  await client.end();
  console.log("\n" + "=".repeat(72));
  console.log("FIM DO DIAGNÓSTICO");
  console.log("=".repeat(72));
}

main().catch(e => console.error("ERRO FATAL:", e));
