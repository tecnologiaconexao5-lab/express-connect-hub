import { createClient } from "@supabase/supabase-js";

const URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

async function main() {
  const s = createClient(URL, ANON_KEY);
  const { error: ae } = await s.auth.signInWithPassword({
    email: "tamiris.castilho@conexaoexpress.com.br",
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026",
  });
  if (ae) { console.error("Auth:", ae.message); return; }
  console.log("Auth OK");

  const targetTables = [
    "clientes", "prestadores", "veiculos", "ordens_servico",
    "financeiro_receber", "financeiro_pagar",
  ];

  // Get column definitions for targeted tables
  for (const table of targetTables) {
    const { data: cols, error: ce } = await s.rpc("get_table_definition", { table_name: table });
    if (ce) {
      // Try alternative: query information_schema directly
      const { data: infCols, error: ie } = await s
        .from("information_schema.columns")
        .select("column_name, data_type, character_maximum_length, is_nullable, column_default")
        .eq("table_schema", "public")
        .eq("table_name", table);
      if (ie) {
        console.log(`${table}: information_schema not accessible: ${ie.message.slice(0, 60)}`);
      } else if (infCols && infCols.length > 0) {
        console.log(`\n=== ${table} (${infCols.length} columns) ===`);
        infCols.forEach((c: any) => {
          const nullable = c.is_nullable === "YES" ? "NULL" : "NOT NULL";
          const def = c.column_default ? ` DEFAULT ${c.column_default.slice(0, 30)}` : "";
          console.log(`  ${c.column_name} ${c.data_type}${c.character_maximum_length ? `(${c.character_maximum_length})` : ""} ${nullable}${def}`);
        });
      } else {
        console.log(`${table}: no columns found (RLS filtered?)`);
      }
    } else {
      console.log(`${table}: ${JSON.stringify(cols).slice(0, 200)}`);
    }
  }
}
main().catch(console.error);
