import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  "https://uwrvzsjtpgaifkktpepn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9zZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs"
);

async function main() {
  // EXACT copy from auditoria - the table listing loop
  const t = "clientes";
  const { data, error } = await supabase.from(t).select("count", { count: "exact", head: true });
  console.log("exists check:", { error: error?.message, data });

  const { data: d, error: e } = await supabase.from(t).select("*").limit(5);
  console.log("rows:", { count: d?.length, error: e?.message, sample: d?.slice(0,2) });
  if (d?.length) {
    for (const r of d) {
      const rr = r as any;
      console.log("  ->", rr.razao_social || rr.nome_fantasia, "| cnpj:", rr.cnpj, "| ie:", rr.ie);
    }
  }
}

main().catch(console.error);
