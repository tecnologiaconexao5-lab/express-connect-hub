const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env" });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error("FALHA: VITE_SUPABASE_ANON_KEY não definida");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const IDS = {
  financeiro_receber: "53e7ccb9-ab9e-4282-82bb-0e736487d99f",
  financeiro_pagar: "df755520-4db1-4feb-97c3-6bd0f768fb60",
  pagamentos_prestadores: "534e674d-8c3d-4d69-abf7-cd818e88f06e",
  alocacoes_escala: "09b7126a-7f68-48cf-aca1-72de65ff4fcc",
  ordens_servico: "28640e7b-fbe5-4141-a59a-c5bead26d25a",
};

async function precheck() {
  let allOk = true;

  for (const [table, id] of Object.entries(IDS)) {
    const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
    if (error) {
      console.log(`[FAIL] ${table} (${id}): erro ${error.code} - ${error.message}`);
      allOk = false;
    } else if (!data) {
      console.log(`[FAIL] ${table} (${id}): registro NÃO ENCONTRADO`);
      allOk = false;
    } else {
      console.log(`[PASS] ${table} (${id}): encontrado - ${JSON.stringify(data).slice(0,150)}...`);
    }
  }

  if (allOk) {
    console.log("\n✅ PRÉ-CHECK: TODOS OS 6 REGISTROS EXISTEM. FASE 9 PODE PROSSEGUIR.");
  } else {
    console.log("\n❌ PRÉ-CHECK: UM OU MAIS REGISTROS AUSENTES. FASE 9 BLOQUEADA.");
    process.exit(1);
  }
}

precheck().catch(console.error);
