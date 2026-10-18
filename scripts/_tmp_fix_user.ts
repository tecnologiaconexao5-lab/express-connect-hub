import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // First, delete the old user via PG
  console.log("Limpando dados antigos...");
  const pgClient = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  // Delete old user if exists
  await pgClient.query(`DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'cliente.teste@conexaoexpress.com.br')`);
  await pgClient.query(`DELETE FROM auth.users WHERE email = 'cliente.teste@conexaoexpress.com.br'`);
  console.log("Old user deleted.");

  // Now use signUp to create the user properly (triggers all auth hooks)
  console.log("Criando usuario via signUp...");
  const { data, error } = await supabase.auth.signUp({
    email: "cliente.teste@conexaoexpress.com.br",
    password: "Teste@2026",
    options: {
      data: {
        name: "Cliente Teste",
        papel: "cliente",
      },
    },
  });

  if (error) {
    console.error("signUp error:", error.message);
    // Try another method
    console.log("Trying admin API directly...");
    // The project might have email confirmation disabled - let me check
    // Just confirm the user via SQL
  } else {
    console.log("signUp OK:", data.user?.id);
  }

  // Wait a bit for the trigger to fire
  await new Promise(r => setTimeout(r, 2000));

  // Confirm the user via SQL (set email_confirmed_at)
  const userId = data?.user?.id;
  if (userId) {
    await pgClient.query(
      `UPDATE auth.users SET email_confirmed_at = NOW(), confirmed_at = NOW(),
       raw_app_meta_data = '{"provider":"email","providers":["email"]}',
       raw_user_meta_data = '{"name":"Cliente Teste","papel":"cliente"}'
       WHERE id = $1`,
      [userId]
    );
    console.log("User confirmed via SQL.");
  }

  // Now also update/ensure the identity records are correct
  if (userId) {
    await pgClient.query(
      `DELETE FROM auth.identities WHERE user_id = $1 AND provider != 'email'`,
      [userId]
    );

    const { rows: identities } = await pgClient.query(
      `SELECT * FROM auth.identities WHERE user_id = $1`,
      [userId]
    );
    console.log(`Identities after: ${identities.length}`);

    // Make sure the email identity has the right provider_id
    if (identities.length > 0) {
      const ident = identities[0];
      if (ident.provider_id !== userId) {
        await pgClient.query(
          `UPDATE auth.identities SET provider_id = $1, identity_data = $2 WHERE id = $3`,
          [
            userId,
            JSON.stringify({
              sub: userId,
              email: "cliente.teste@conexaoexpress.com.br",
              email_verified: true,
              phone_verified: false,
            }),
            ident.id,
          ]
        );
        console.log("Identity updated.");
      }
    }
  }

  // Test login
  console.log("\nTestando login...");
  const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: "cliente.teste@conexaoexpress.com.br",
    password: "Teste@2026",
  });

  if (loginErr) {
    console.error("Login ERRO:", loginErr.message);
  } else {
    console.log("Login OK!", loginData.user?.email);
  }

  await pgClient.end();
}

main().catch(e => console.error(e));
