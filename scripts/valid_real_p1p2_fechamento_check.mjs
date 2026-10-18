import { createClient } from "@supabase/supabase-js";

const URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const supabase = createClient(URL, KEY);

async function main() {
  // 1. Fechamento 03b7ee2f completo
  console.log("--- 1. Fechamento 03b7ee2f ---");
  const { data: f } = await supabase
    .from("pagamentos_prestadores")
    .select("*")
    .like("id", "03b7ee2f%")
    .single();
  console.log(JSON.stringify(f, null, 2));

  // 2. BRUNO servicos sem fechamento_id
  console.log("\n--- 2. BRUNO servicos ---");
  const { data: items } = await supabase
    .from("pagamentos_prestadores")
    .select("id, prestador_nome, valor_liquido, tipo_pagamento, fechamento_id, is_teste, prestador_id")
    .like("prestador_nome", "%BRUNO%")
    .order("created_at");
  items?.forEach(i => console.log(`  ${i.id.slice(0,8)} | R$${i.valor_liquido} | tipo=${i.tipo_pagamento} | fech=${i.fechamento_id || "null"} | teste=${i.is_teste}`));

  // 3. BRUNO prestador
  console.log("\n--- 3. BRUNO prestador ---");
  const { data: p } = await supabase
    .from("prestadores")
    .select("id, nome_completo, cpf_cnpj, ativo")
    .like("nome_completo", "%BRUNO%");
  console.log(JSON.stringify(p, null, 2));

  // 4. Tables with conta/extrato
  console.log("\n--- 4. Tables containing conta/extrato ---");
  const { data: tables } = await supabase.rpc("executar_sql_seguro", {
    q: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE '%conta%' OR table_name LIKE '%extrato%' OR table_name LIKE '%fluxo%' OR table_name LIKE '%saldo%') ORDER BY table_name"
  });
  console.log(JSON.stringify(tables, null, 2));

  // 5. Check extrato_prestador table
  console.log("\n--- 5. extrato_prestador ---");
  const { data: ext, error: e5 } = await supabase
    .from("extrato_prestador")
    .select("*")
    .limit(3);
  if (e5) console.log("  Erro:", e5.message);
  else console.log(JSON.stringify(ext, null, 2));

  // 6. Check if conta_financeiras has any rows
  console.log("\n--- 6. contas_financeiras (all) ---");
  const { data: cf } = await supabase
    .from("contas_financeiras")
    .select("*")
    .limit(5);
  console.log(JSON.stringify(cf, null, 2));
}

main().catch(console.error);
