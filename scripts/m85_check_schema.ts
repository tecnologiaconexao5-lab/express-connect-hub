import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.VITE_SUPABASE_ANON_KEY || ""
);
const { data: os } = await supabase.from("ordens_servico").select("id, cliente, cliente_id, numero").limit(3);
console.log("OS:", JSON.stringify(os));
const { data: cli } = await supabase.from("clientes").select("id, nome_fantasia").limit(3);
console.log("Clientes:", JSON.stringify(cli));
