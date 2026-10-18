import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.VITE_SUPABASE_ANON_KEY || ""
);

async function checkTable(name: string) {
  const { data, error } = await supabase.from(name).select("*").limit(1);
  if (error) {
    console.log(`${name}: ❌ ${error.message?.slice(0, 80)}`);
    return false;
  }
  console.log(`${name}: ✅ (${data?.length || 0} rows)`);
  return true;
}

async function checkColumns(table: string) {
  // Try to get column info from a row
  const { data } = await supabase.from(table).select("*").limit(1);
  if (data && data.length > 0) {
    console.log(`   Columns: ${Object.keys(data[0]).join(", ")}`);
  } else {
    // Try to get column names from insert returning
    try {
      const { data: inserted } = await supabase
        .from(table)
        .insert([{ id: "00000000-0000-0000-0000-000000000000" }])
        .select("*")
        .limit(1);
      if (inserted) console.log(`   Columns (via insert): ${Object.keys(inserted[0] || {}).join(", ")}`);
    } catch {
      console.log("   No rows to inspect columns");
    }
  }
}

console.log("Checking vehicle-related tables:");
await checkTable("veiculos");
await checkTable("veiculos_prestadores");

if (await checkTable("veiculos")) {
  console.log("\nVeiculos columns:");
  await checkColumns("veiculos");
}

console.log("\nChecking prestadores.veiculos JSONB:");
const { data: p } = await supabase.from("prestadores").select("veiculos").limit(1);
console.log(`   prestadores.veiculos: ${JSON.stringify(p?.[0]?.veiculos)?.slice(0, 100) || "N/A"}`);
