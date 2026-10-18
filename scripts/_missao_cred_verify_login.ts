import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const tests = [
  { label: "ADMIN", email: "tamiris.castilho@conexaoexpress.com.br", pw: "Conexao@2026" },
  { label: "ATENDIMENTO", email: "contato@conexaoexpress.com.br", pw: "Conexao@2026" },
  { label: "FINANCEIRO", email: "financeiro@conexaoexpress.com.br", pw: "Conexao@2026" },
  { label: "COMERCIAL", email: "comercial@conexaoexpress.com.br", pw: "Conexao@2026" },
  { label: "OPERACIONAL", email: "operacional@conexaoexpress.com.br", pw: "Conexao@2026" },
  { label: "CLIENTE", email: "cliente.teste@conexaoexpress.com.br", pw: "Teste@2026" },
];

async function main() {
  console.log("=".repeat(60));
  console.log("VERIFICAÇÃO DE LOGIN — TODOS OS USUÁRIOS");
  console.log("=".repeat(60));

  let ok = 0;
  let fail = 0;

  for (const t of tests) {
    process.stdout.write(`[${t.label}] ${t.email.padEnd(45)} `);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: t.email,
        password: t.pw,
      });
      if (error) {
        console.log(`❌ ${error.message}`);
        fail++;
      } else if (data?.user) {
        console.log(`✅ LOGIN OK!`);
        ok++;
        await supabase.auth.signOut();
      }
    } catch (e: any) {
      console.log(`❌ EXCEPTION: ${e?.message || e}`);
      fail++;
    }
  }

  console.log("=".repeat(60));
  console.log(`RESULTADO: ${ok} sucesso, ${fail} falha`);
  console.log("=".repeat(60));
}

main().catch(e => console.error(e));
