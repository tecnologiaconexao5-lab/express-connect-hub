import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://uwrvzsjtpgaifkktpepn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs"
);

async function main() {
  const { data, error: authErr } = await supabase.auth.signInWithPassword({
    email: "tamiris.castilho@conexaoexpress.com.br",
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026",
  });
  if (authErr) { console.error("Auth:", authErr.message); return; }
  console.log("Auth OK");

  // Get one complete record from alocacoes_escala to see all columns
  const { data: aloc, error: alocErr } = await supabase
    .from("alocacoes_escala")
    .select("*")
    .limit(1);

  if (alocErr) {
    console.log("ALOC query error:", alocErr.message);
    return;
  }

  if (aloc && aloc.length > 0) {
    console.log("\n=== ALOOCACAO FULL RECORD ===");
    for (const [key, value] of Object.entries(aloc[0])) {
      const vStr = value === null ? "NULL" : String(value).slice(0, 60);
      console.log(`  ${key}: ${vStr}`);
    }
  }

  // Get distinct statuses
  const { data: statuses } = await supabase
    .from("alocacoes_escala")
    .select("status");

  if (statuses && statuses.length > 0) {
    const distStatus = [...new Set(statuses.map((s) => s.status))];
    console.log("\nDistinct statuses:", distStatus);

    const statusCounts: Record<string, number> = {};
    statuses.forEach((s) => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
    });
    for (const [s, c] of Object.entries(statusCounts)) {
      console.log(`  ${s}: ${c}`);
    }
  }

  // Check distinct created_at dates to understand data age
  const { data: dates } = await supabase
    .from("alocacoes_escala")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(176);

  if (dates && dates.length > 0) {
    const allDates = dates.map((d) => (d.created_at || "").slice(0, 10));
    const uniqueDates = [...new Set(allDates)].sort();
    console.log("\nDate range:", uniqueDates[uniqueDates.length - 1], "to", uniqueDates[0]);
    console.log("Unique dates with data:", uniqueDates.length);

    // Count by month
    const months: Record<string, number> = {};
    allDates.forEach((d) => {
      const m = d.slice(0, 7);
      months[m] = (months[m] || 0) + 1;
    });
    console.log("\nBy month:");
    for (const [m, c] of Object.entries(months)) {
      console.log(`  ${m}: ${c}`);
    }
  }
}

main().catch(console.error);
