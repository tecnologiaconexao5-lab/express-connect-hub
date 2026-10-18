import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type UserInfo = {
  email: string;
  password: string;
  label: string;
};

const USERS: UserInfo[] = [
  { email: "tamiris.castilho@conexaoexpress.com.br", password: "__CONEXAO2026_TAMIRIS__", label: "ADMIN (tamiris.castilho)" },
  { email: "contato@conexaoexpress.com.br", password: "__123456_CONTATO__", label: "ATENDIMENTO (contato)" },
  { email: "cliente.teste@conexaoexpress.com.br", password: "Teste@2026", label: "CLIENTE (cliente.teste)" },
];

interface AuthUserRow {
  id: string;
  email: string;
  email_confirmed_at: Date | null;
  encrypted_password: string;
  raw_user_meta_data: any;
  created_at: Date;
  deleted_at: Date | null;
}

async function auditViaPg(pgClient: pg.Client, user: UserInfo): Promise<{
  exists: boolean;
  confirmed: boolean;
  passwordMatch: boolean | null;
  authRow: AuthUserRow | null;
}> {
  const result = await pgClient.query<AuthUserRow>(
    `SELECT id, email, email_confirmed_at, encrypted_password,
            raw_user_meta_data, created_at, deleted_at
     FROM auth.users WHERE email = $1 LIMIT 1`,
    [user.email]
  );

  if (result.rows.length === 0) {
    return { exists: false, confirmed: false, passwordMatch: null, authRow: null };
  }

  const row = result.rows[0];
  const pwResult = await pgClient.query<{ pw_match: boolean }>(
    `SELECT (encrypted_password = crypt($1, encrypted_password)) as pw_match
     FROM auth.users WHERE email = $2`,
    [user.password, user.email]
  );

  return {
    exists: true,
    confirmed: row.email_confirmed_at !== null && row.deleted_at === null,
    passwordMatch: pwResult.rows[0]?.pw_match ?? null,
    authRow: row,
  };
}

async function main() {
  console.log("=".repeat(72));
  console.log("MISSÃO — AUDITORIA COMPLETA DE CREDENCIAIS REAIS");
  console.log("=".repeat(72));

  // 1. PG connection
  const pgClient = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  for (const user of USERS) {
    console.log(`\n${"-".repeat(50)}`);
    console.log(`[${user.label}]`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Senha: ${user.password.substring(0, 15)}...`);

    // PG check
    const pgInfo = await auditViaPg(pgClient, user);
    if (pgInfo.exists) {
      console.log(`  [PG]  auth.users:       ✅ OK (id: ${pgInfo.authRow!.id})`);
      console.log(`  [PG]  email confirmado: ${pgInfo.confirmed ? "✅ SIM" : "❌ NÃO"}`);
      console.log(`  [PG]  senha confere:    ${pgInfo.passwordMatch === true ? "✅ SIM" : pgInfo.passwordMatch === false ? "❌ NÃO CONFERE" : "⚠️ SEM HASH"}`);
      console.log(`  [PG]  metadata:         ${JSON.stringify(pgInfo.authRow!.raw_user_meta_data)}`);
      console.log(`  [PG]  criado em:        ${pgInfo.authRow!.created_at}`);
      console.log(`  [PG]  deletado:         ${pgInfo.authRow!.deleted_at || "não"}`);

      // Check tenant_usuarios
      const tuResult = await pgClient.query(
        `SELECT tu.papel, t.nome as tenant_nome, tu.status
         FROM tenant_usuarios tu
         LEFT JOIN tenants t ON t.id = tu.tenant_id
         WHERE tu.user_id = $1 AND tu.status = 'ativo'
         LIMIT 1`,
        [pgInfo.authRow!.id]
      );
      if (tuResult.rows.length > 0) {
        console.log(`  [PG]  tenant_usuarios:  ✅ OK (papel: ${tuResult.rows[0].papel}, tenant: ${tuResult.rows[0].tenant_nome})`);
      } else {
        console.log(`  [PG]  tenant_usuarios:  ❌ NÃO ENCONTRADO`);
      }

      // Check usuarios_cliente for client role
      if (user.email.includes("cliente")) {
        const ucResult = await pgClient.query(
          `SELECT uc.cliente_id, uc.ativo, c.nome_empresa
           FROM usuarios_cliente uc
           LEFT JOIN clientes c ON c.id = uc.cliente_id
           WHERE uc.auth_user_id = $1 AND uc.ativo = true
           LIMIT 1`,
          [pgInfo.authRow!.id]
        );
        if (ucResult.rows.length > 0) {
          console.log(`  [PG]  usuarios_cliente: ✅ OK (cliente: ${ucResult.rows[0].nome_empresa})`);
        } else {
          console.log(`  [PG]  usuarios_cliente: ❌ NÃO ENCONTRADO`);
        }
      }

      // Check identities
      const idResult = await pgClient.query(
        `SELECT provider, provider_id FROM auth.identities WHERE user_id = $1`,
        [pgInfo.authRow!.id]
      );
      console.log(`  [PG]  identities:       ${idResult.rows.length > 0 ? `✅ ${idResult.rows.length} (${idResult.rows.map(r => r.provider).join(", ")})` : "❌ NENHUMA"}`);
    } else {
      console.log(`  [PG]  auth.users: ❌ NÃO EXISTE`);
    }

    // 3. Login via Supabase JS client (real flow)
    console.log(`  [API] Testando signInWithPassword...`);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });
      if (error) {
        console.log(`  [API] ❌ ERRO: ${error.message}`);
        // Try alternative: maybe user was created via admin API and needs a different approach
      } else if (data?.user) {
        console.log(`  [API] ✅ LOGIN OK! user: ${data.user.email}`);
        console.log(`  [API]    role da sessão: ${(data.user as any).role || "N/A"}`);

        // Sign out after test
        await supabase.auth.signOut();
      }
    } catch (e: any) {
      console.log(`  [API] ❌ EXCEÇÃO: ${e?.message || e}`);
    }
  }

  // Also check contato and other missão50 users
  const missao50Users = [
    "financeiro@conexaoexpress.com.br",
    "comercial@conexaoexpress.com.br",
    "operacional@conexaoexpress.com.br",
  ];
  console.log(`\n${"=".repeat(50)}`);
  console.log("USUÁRIOS ADICIONAIS (MISSÃO 50)");
  for (const email of missao50Users) {
    const result = await pgClient.query(
      `SELECT id, email, email_confirmed_at, deleted_at FROM auth.users WHERE email = $1 LIMIT 1`,
      [email]
    );
    if (result.rows.length > 0) {
      console.log(`  [${email}] ✅ auth.users id=${result.rows[0].id} confirmado=${!!result.rows[0].email_confirmed_at}`);
      const tu = await pgClient.query(
        `SELECT papel, status FROM tenant_usuarios WHERE user_id = $1 AND status = 'ativo' LIMIT 1`,
        [result.rows[0].id]
      );
      console.log(`           tenant_usuarios: ${tu.rows.length > 0 ? `✅ ${tu.rows[0].papel}` : "❌ nenhum"}`);
    } else {
      console.log(`  [${email}] ❌ NÃO EXISTE em auth.users`);
    }
  }

  await pgClient.end();
  console.log(`\n${"=".repeat(72)}`);
  console.log("AUDITORIA CONCLUÍDA");
  console.log("=".repeat(72));
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
