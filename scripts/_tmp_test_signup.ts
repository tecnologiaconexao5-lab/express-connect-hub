import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || "",
    process.env.VITE_SUPABASE_ANON_KEY || ""
  );

  // Check if contato user can login (papel=cliente tenant_usuarios)
  console.log("=== Test 1: contato@conexaoexpress.com.br ===");
  // We don't know the password for contato, skip this

  // Check if supabase.auth.signUp works (no email confirmation needed?)
  console.log("\n=== Test 2: signUp test ===");
  const testEmail = `teste.cliente.${Date.now()}@conexaoexpress.com.br`;
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email: testEmail,
    password: "Teste@2026",
    options: {
      data: { name: "Test SignUp" },
    },
  });

  if (signUpErr) {
    console.log(`signUp error: ${signUpErr.message}`);
  } else {
    console.log(`signUp OK: ${signUpData.user?.id}`);
    console.log(`Email confirmed? ${signUpData.user?.email_confirmed_at}`);
    console.log(`Identities: ${signUpData.user?.identities?.length}`);
    console.log(`Session: ${signUpData.session ? 'PRESENT' : 'NONE'}`);

    if (signUpData.session) {
      console.log("Session exists - user is auto-confirmed!");
      console.log(`Token: ${signUpData.session.access_token.substring(0, 30)}...`);
    } else {
      console.log("No session - email confirmation required");
    }

    // Try to login
    console.log("\n=== Test 3: Login with test user ===");
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: "Teste@2026",
    });

    if (loginErr) {
      console.log(`Login error: ${loginErr.message}`);
    } else {
      console.log(`Login OK! Session: ${loginData.session?.access_token?.substring(0, 30)}...`);
    }
  }
}

main().catch(e => console.error(e));
