import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Try to sign in with the client user
  console.log("Tentando login com cliente.teste...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "cliente.teste@conexaoexpress.com.br",
    password: "Teste@2026",
  });

  if (error) {
    console.log("ERRO no login:", JSON.stringify(error, null, 2));
  } else {
    console.log("LOGIN OK!");
    console.log("User:", data.user?.email);
    console.log("Session:", data.session?.access_token?.substring(0, 30) + "...");
  }

  // Try admin login for comparison
  console.log("\nTentando login admin...");
  const { data: aData, error: aError } = await supabase.auth.signInWithPassword({
    email: "tamiris.castilho@conexaoexpress.com.br",
    password: "Admin@123",
  });

  if (aError) {
    console.log("ERRO admin:", JSON.stringify(aError, null, 2));
  } else {
    console.log("LOGIN admin OK!");
    console.log("User:", aData.user?.email);
  }
}

main().catch(e => console.error(e));
