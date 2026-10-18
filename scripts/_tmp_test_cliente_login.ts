import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || "",
    process.env.VITE_SUPABASE_ANON_KEY || ""
  );

  console.log("=== Test login: cliente.teste@conexaoexpress.com.br ===");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "cliente.teste@conexaoexpress.com.br",
    password: "Teste@2026",
  });

  if (error) {
    console.log(`❌ FAILED: ${error.message} (status=${error.status})`);
  } else {
    console.log(`✅ LOGIN OK`);
    console.log(`  User: ${data.user?.email}`);
    console.log(`  ID: ${data.user?.id}`);
    console.log(`  Token: ${data.session?.access_token?.substring(0, 30)}...`);

    // Now try to query tenant_usuarios
    const { data: tu, error: tuErr } = await supabase
      .from("tenant_usuarios")
      .select("*")
      .eq("user_id", data.user?.id)
      .single();

    if (tuErr) {
      console.log(`❌ tenant_usuarios query error: ${tuErr.message}`);
    } else {
      console.log(`  Tenant: ${tu.papel} (${tu.tenant_id})`);
    }

    // Query usuarios_cliente
    const { data: uc, error: ucErr } = await supabase
      .from("usuarios_cliente")
      .select("*")
      .eq("auth_user_id", data.user?.id)
      .single();

    if (ucErr) {
      console.log(`❌ usuarios_cliente error: ${ucErr.message}`);
    } else {
      console.log(`  Cliente ID: ${uc.cliente_id}`);
    }

    // Query alocacoes_escala
    if (uc) {
      const { data: os, error: osErr } = await supabase
        .from("alocacoes_escala")
        .select("*")
        .eq("cliente_id", uc.cliente_id);

      if (osErr) {
        console.log(`❌ OS query error: ${osErr.message}`);
      } else {
        console.log(`  OS encontradas: ${os.length}`);
        for (const o of os) {
          console.log(`    ${o.id.substring(0,8)}... | ${o.status} | ${o.data_escala} | ${o.origem} -> ${o.destino}`);
        }
      }

      // Query financeiro_receber
      const { data: fin, error: finErr } = await supabase
        .from("financeiro_receber")
        .select("*")
        .eq("cliente_id", uc.cliente_id);

      if (finErr) {
        console.log(`❌ Financeiro query error: ${finErr.message}`);
      } else {
        console.log(`  Financeiro registros: ${fin.length}`);
        for (const f of fin) {
          console.log(`    ${f.id.substring(0,8)}... | ${f.descricao} | R$${f.valor} | ${f.status} | ${f.vencimento}`);
        }
      }
    }
  }
}

main().catch(e => console.error(e));
