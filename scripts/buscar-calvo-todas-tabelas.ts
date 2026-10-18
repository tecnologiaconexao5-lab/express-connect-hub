/**
 * BUSCA "CALVO" EM TODAS AS TABELAS RELEVANTES DO SUPABASE
 * Executar: npx tsx scripts/buscar-calvo-todas-tabelas.ts
 */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const supabase = createClient(
  "https://uwrvzsjtpgaifkktpepn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9zZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs"
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGS_DIR = path.resolve(__dirname, "..", "logs");

async function main() {
  console.log("=".repeat(70));
  console.log("  BUSCA CALVO EM TODAS AS TABELAS");
  console.log("=".repeat(70));

  const resultados: Record<string, any> = {};

  // 1. clientes
  console.log("\n1. clientes");
  const { data: clientes1 } = await supabase.from("clientes").select("*").or("razao_social.ilike.%calvo%,nome_fantasia.ilike.%calvo%");
  const { data: clientes2 } = await supabase.from("clientes").select("*").or("nome.ilike.%calvo%");
  const { data: clientes3 } = await supabase.from("clientes").select("*").limit(20);
  const todosClientes = new Set<string>();
  const merge = (arr: any[] | null) => { if (arr) arr.forEach((r: any) => todosClientes.add(JSON.stringify(r))); };
  merge(clientes1); merge(clientes2);
  resultados.clientes = [...todosClientes].map((s) => JSON.parse(s));
  console.log(`  Encontrados: ${resultados.clientes.length}`);

  // 2. prestadores
  console.log("2. prestadores");
  const { data: prest } = await supabase.from("prestadores").select("*").or("nome_completo.ilike.%calvo%,nome_fantasia.ilike.%calvo%");
  resultados.prestadores = prest || [];
  console.log(`  Encontrados: ${resultados.prestadores.length}`);

  // 3. ordens_servico
  console.log("3. ordens_servico");
  const { data: os } = await supabase.from("ordens_servico").select("*").or("cliente.ilike.%calvo%,prestador.ilike.%calvo%");
  resultados.ordens_servico = os || [];
  console.log(`  Encontrados: ${resultados.ordens_servico.length}`);

  // 4. configuracoes_fiscais
  console.log("4. configuracoes_fiscais");
  const { data: cf } = await supabase.from("configuracoes_fiscais").select("*").or("razao_social.ilike.%calvo%,nome_fantasia.ilike.%calvo%");
  resultados.configuracoes_fiscais = cf || [];
  console.log(`  Encontrados: ${resultados.configuracoes_fiscais.length}`);

  // 5. orcamentos
  console.log("5. orcamentos");
  const { data: orc } = await supabase.from("orcamentos").select("*").or("cliente.ilike.%calvo%");
  resultados.orcamentos = orc || [];
  console.log(`  Encontrados: ${resultados.orcamentos.length}`);

  // 6. Verificar todas as linhas de clientes para inspecionar
  console.log("\n6. TODOS OS CLIENTES (para inspecao):");
  if (resultados.clientes.length === 0 && clientes3) {
    console.log(`  Nenhum cliente encontrado com "calvo". Total clientes: ${clientes3.length}`);
    for (const c of clientes3) {
      console.log(`    id=${c.id?.slice(0,8)} | razao=${c.razao_social} | fantasia=${c.nome_fantasia} | nome=${c.nome} | cnpj=${c.cnpj}`);
    }
  } else {
    for (const c of resultados.clientes) {
      console.log(JSON.stringify(c, null, 2));
    }
  }

  // 7. Tambem buscar emitente configurado
  console.log("\n7. EMITENTE ATIVO:");
  const { data: emitenteDb } = await supabase.from("configuracoes_fiscais").select("*").eq("ativo", true).limit(1).maybeSingle();
  console.log(emitenteDb ? JSON.stringify(emitenteDb, null, 2) : "  Nao encontrado");

  // Save
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.writeFileSync(path.join(LOGS_DIR, "calvo-busca.json"), JSON.stringify({
    data: new Date().toISOString(),
    resultados,
    total_clientes: clientes3?.length || 0,
    emitente: emitenteDb,
  }, null, 2));
  console.log(`\nSalvo em logs/calvo-busca.json`);
}

main().catch(console.error);
