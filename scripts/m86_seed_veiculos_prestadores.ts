/**
 * M86 — Seed de veículos para prestadores ativos
 * 
 * Garante que FRANKLIN, CESAR e BRUNO tenham veículos cadastrados
 * para que apareçam como compatíveis na Rede de Prestadores.
 * 
 * Uso: npx tsx -r dotenv/config scripts/m86_seed_veiculos_prestadores.ts
 */

import { createClient } from "@supabase/supabase-js";
import { guardHarness } from "./_guard.mjs";

// TMS-FIN-DATA-04D2 — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/m86_seed_veiculos_prestadores.ts");

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.VITE_SUPABASE_ANON_KEY || ""
);

interface VeiculoSeed {
  tipo: string;
  placa: string;
  capacidade_kg: number;
  capacidade_m3?: number;
  status: string;
}

const VEICULOS_SEED: Record<string, VeiculoSeed[]> = {
  "FRANKLIN": [
    { tipo: "VUC", placa: "ABC-1F23", capacidade_kg: 3000, capacidade_m3: 15, status: "Ativo" },
    { tipo: "Van", placa: "ABC-1F24", capacidade_kg: 1500, capacidade_m3: 8, status: "Ativo" },
  ],
  "CESAR": [
    { tipo: "Toco", placa: "DEF-2C45", capacidade_kg: 8000, capacidade_m3: 40, status: "Ativo" },
  ],
  "BRUNO": [
    { tipo: "VUC", placa: "GHI-3B67", capacidade_kg: 3000, capacidade_m3: 15, status: "Ativo" },
    { tipo: "Van", placa: "GHI-3B68", capacidade_kg: 1000, capacidade_m3: 6, status: "Ativo" },
    { tipo: "Bitruck", placa: "GHI-3B69", capacidade_kg: 5000, capacidade_m3: 25, status: "Ativo" },
  ],
};

async function main() {
  console.log("=".repeat(60));
  console.log("M86 — SEED VEÍCULOS PRESTADORES");
  console.log("=".repeat(60));

  // Buscar prestadores ativos por nome
  const nomes = Object.keys(VEICULOS_SEED);
  const { data: prestadores } = await supabase
    .from("prestadores")
    .select("id, nome_completo, status, regiao_principal")
    .in("nome_completo", nomes);

  if (!prestadores || prestadores.length === 0) {
    console.log("❌ Nenhum prestador encontrado. Verificando LIKE...");
    
    // Tentar busca parcial
    for (const nome of nomes) {
      const { data: parcial } = await supabase
        .from("prestadores")
        .select("id, nome_completo, status, regiao_principal")
        .ilike("nome_completo", `%${nome}%`)
        .limit(1);
      
      if (parcial && parcial.length > 0) {
        console.log(`   Encontrado via LIKE: ${parcial[0].nome_completo} (${parcial[0].id})`);
        await cadastrarVeiculos(parcial[0], nome);
      } else {
        console.log(`   ⚠️  Prestador "${nome}" não encontrado no banco`);
      }
    }
  } else {
    console.log(`\n${prestadores.length} prestadores encontrados:`);
    for (const p of prestadores) {
      console.log(`   ${p.nome_completo.padEnd(30)} ${p.id} (${p.regiao_principal || "N/I"})`);
      await cadastrarVeiculos(p, p.nome_completo);
    }
  }

  // Verificar resultado final
  console.log("\n📊 Verificando veículos cadastrados...");
  const { data: todosVeiculos } = await supabase
    .from("veiculos_prestadores")
    .select("prestador_id, tipo, placa, status");

  if (todosVeiculos) {
    console.log(`   Total de veículos: ${todosVeiculos.length}`);
    for (const v of todosVeiculos) {
      const { data: p } = await supabase
        .from("prestadores")
        .select("nome_completo")
        .eq("id", v.prestador_id)
        .single();
      console.log(`   ${p?.nome_completo?.padEnd(30) || "N/I"} ${(v.tipo || "N/I").padEnd(12)} ${v.placa || "N/I"} [${v.status}]`);
    }
  }
}

async function cadastrarVeiculos(prestador: { id: string; nome_completo: string }, nomeChave: string) {
  const veiculos = VEICULOS_SEED[nomeChave];
  if (!veiculos) return;

  // Remover veículos existentes para evitar duplicatas
  const { data: existentes } = await supabase
    .from("veiculos_prestadores")
    .select("placa")
    .eq("prestador_id", prestador.id);

  const placasExistentes = new Set((existentes || []).map(v => v.placa));

  for (const v of veiculos) {
    if (placasExistentes.has(v.placa)) {
      console.log(`   ⏭️  Veículo ${v.placa} já existe para ${prestador.nome_completo}`);
      continue;
    }

    const { error } = await supabase
      .from("veiculos_prestadores")
      .insert([{
        prestador_id: prestador.id,
        tipo: v.tipo,
        placa: v.placa,
        capacidade_kg: v.capacidade_kg,
        status: v.status,
      }]);

    if (error) {
      console.log(`   ❌ Erro ao cadastrar ${v.placa} para ${prestador.nome_completo}: ${error.message}`);
    } else {
      console.log(`   ✅ ${v.tipo.padEnd(12)} ${v.placa} — ${v.capacidade_kg}kg para ${prestador.nome_completo}`);
    }
  }
}

main().catch(console.error);
