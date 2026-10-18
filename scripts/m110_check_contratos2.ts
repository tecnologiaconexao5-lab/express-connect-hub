import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
const s = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ""
);
async function run() {
  const tables = ["contratos_gerados", "contratos_modelos", "contratos_historico", "contratos_operacao"];
  for (const t of tables) {
    const { data, error } = await s.from(t).select("id").limit(1);
    const c = error ? ("ERROR: " + error.message) : ((data?.length || 0) + " registros");
    console.log(t.padEnd(25), c);
  }
}
run().then(() => process.exit(0));
