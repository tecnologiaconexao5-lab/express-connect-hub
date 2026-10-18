import { createClient } from "@supabase/supabase-js";

const URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const supabase = createClient(URL, KEY);

async function main() {
  // Get all BRUNO TEST items with full UUIDs
  console.log("--- BRUNO TEST items (full UUIDs) ---");
  const { data: items } = await supabase
    .from("pagamentos_prestadores")
    .select("id, prestador_id, prestador_nome, valor_liquido, tipo_pagamento, fechamento_id, is_teste")
    .like("prestador_nome", "%BRUNO%")
    .eq("is_teste", true)
    .order("created_at");

  items?.forEach(i => console.log(`  id=${i.id} | R$${i.valor_liquido} | tipo=${i.tipo_pagamento} | fech=${i.fechamento_id || "null"} | prestador_id=${i.prestador_id}`));

  // Get fechamento if exists
  console.log("\n--- Fechamento existente ---");
  const { data: fech } = await supabase
    .from("pagamentos_prestadores")
    .select("id, tipo_pagamento, qtd_os, valor_liquido")
    .like("prestador_nome", "%BRUNO%")
    .eq("tipo_pagamento", "fechamento")
    .eq("is_teste", true);

  fech?.forEach(f => console.log(`  id=${f.id} | qtd_os=${f.qtd_os} | R$${f.valor_liquido}`));
}

main().catch(console.error);
