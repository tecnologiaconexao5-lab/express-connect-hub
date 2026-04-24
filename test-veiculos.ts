import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testVeiculos() {
  console.log("TESTE VEICULOS - DESCOBRIR SCHEMA");
  console.log("=".repeat(40));
  
  // Tentar veiculos (sem _prestadores)
  console.log("\n[1] Tabela: veiculos");
  const { data: veiculos, error: vErro } = await supabase.from("veiculos").select("*").limit(1);
  if (vErro) {
    console.log("NAO existe:" + vErro.message);
  } else {
    console.log("EXISTE! Colunas:" + (veiculos ? Object.keys(veiculos[0] || {}) : "vazia"));
  }

  // Tentar veiculos_prestadores
  console.log("\n[2] Tabela: veiculos_prestadores");
  const { data: vp, error: vpErro } = await supabase.from("veiculos_prestadores").select("*").limit(1);
  if (vpErro) {
    console.log("NAO existe:" + vpErro.message);
  } else {
    console.log("EXISTE! Colunas:" + (vp ? Object.keys(vp[0] || {}) : "vazia"));
  }

  // Verificar schema detalhado de veiculos se existir
  if (veiculos) {
    console.log("\n[3] Schema detalhado de veiculos:");
    console.log(JSON.stringify(veiculos[0], null, 2));
  }
  
  // Verificar se existe prestador_id em veiculos
  if (veiculos && veiculos.length > 0) {
    const colunas = Object.keys(veiculos[0]);
    const temPrestador = colunas.some(c => c.includes("prestador") || c.includes("motorista") || c.includes("parceiro"));
    console.log("\n[4] Tem coluna de vínculo:" + temPrestador);
    if (temPrestador) {
      console.log("Colunas relacionadas:" + colunas.filter(c => c.includes("prestador") || c.includes("motorista") || c.includes("parceiro")));
    }
  }
}

testVeiculos();