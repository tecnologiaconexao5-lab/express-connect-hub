import { createClient } from "@supabase/supabase-js";

const s = createClient(
  "https://uwrvzsjtpgaifkktpepn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9zZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs"
);

async function main() {
  console.log("=".repeat(70));
  console.log("  BUSCA CALVO — TODAS AS FONTES");
  console.log("=".repeat(70));

  // 1. fiscal_documentos_vinculados - related to NF-e 2628647
  console.log("\n1. fiscal_documentos_vinculados (NF-e 2628647):");
  const { data: docs } = await s.from("fiscal_documentos_vinculados").select("*").filter("numero", "eq", "2628647").limit(5);
  if (docs && docs.length > 0) {
    for (const d of docs) {
      console.log(JSON.stringify({
        id: d.id?.slice(0,12),
        numero: d.numero,
        emitente_nome: d.emitente_nome,
        emitente_cnpj: (d as any).emitente_cnpj,
        emitente_ie: (d as any).emitente_ie,
        destinatario_nome: d.destinatario_nome,
        destinatario_cnpj: (d as any).destinatario_cnpj,
        municipio_destino: d.municipio_destino,
        uf_destino: d.uf_destino,
        ordem_servico_id: d.ordem_servico_id,
        metadata: d.metadata,
      }, null, 2));
    }
  } else {
    console.log("  Nao encontrado (numero = '2628647')");
    // Try without filter
    const { data: allDocs } = await s.from("fiscal_documentos_vinculados").select("numero, emitente_nome, emitente_cnpj, ordem_servico_id").limit(20);
    console.log(`  Total docs: ${allDocs?.length || 0}`);
    if (allDocs) for (const d of allDocs.slice(0,5)) console.log(`    NF-e=${d.numero} | emitente=${d.emitente_nome} | cnpj=${(d as any).emitente_cnpj} | OS=${d.ordem_servico_id?.slice(0,8)}`);
  }

  // 2. fiscal_documentos_vinculados - search by emitente name
  console.log("\n2. fiscal_documentos_vinculados (emitente ilike calvo):");
  const { data: dCalvo } = await s.from("fiscal_documentos_vinculados").select("numero, emitente_nome, emitente_cnpj, ordem_servico_id").or("emitente_nome.ilike.%calvo%,destinatario_nome.ilike.%calvo%").limit(5);
  console.log(`  Encontrados: ${dCalvo?.length || 0}`);
  if (dCalvo) for (const d of dCalvo) console.log(`    NF-e=${d.numero} | emitente=${d.emitente_nome} | cnpj=${(d as any).emitente_cnpj} | OS=${d.ordem_servico_id?.slice(0,8)}`);

  // 3. ordens_servico 
  console.log("\n3. ordens_servico (todas):");
  const { data: os } = await s.from("ordens_servico").select("id, numero, cliente, prestador, veiculo_alocado, status").limit(10);
  console.log(`  Total: ${os?.length || 0}`);
  if (os) for (const o of os) console.log(`    #${o.numero || 'S/N'} | cliente=${o.cliente} | prestador=${o.prestador} | veiculo=${o.veiculo_alocado}`);

  // 4. fiscal_ctes - all metadata for romaneio 340612
  console.log("\n4. fiscal_ctes (romaneio 340612) — buscar CNPJ embutido:");
  const { data: ctes } = await s.from("fiscal_ctes").select("id, metadata, status, valor").filter("metadata->>romaneio_numero", "eq", "340612").limit(3);
  console.log(`  Encontrados: ${ctes?.length || 0}`);
  if (ctes) for (const ct of ctes) {
    const m = ct.metadata as any;
    const pf = m?.payload_focus || {};
    console.log(`    CT-e ${ct.id?.slice(0,10)} | nfe=${m?.nfe_numero} | tomador=${m?.tomador_nome}`);
    console.log(`      tomador.cnpj=${pf?.tomador?.cnpj || 'null'} | tomador.ie=${pf?.tomador?.ie || 'null'}`);
    console.log(`      emitente.cnpj=${pf?.emitente?.cnpj || 'null'} | emitente.rntrc=${pf?.emitente?.rntrc || 'null'}`);
  }

  // 5. Verificar se ha tabela "notas_fiscais" ou similar
  console.log("\n5. Buscando schema publico:");
  try {
    const { data: schemaData } = await s.rpc("get_schema_tables");
    console.log("  rpc get_schema_tables:", schemaData);
  } catch (e: any) { console.log(`  rpc indisponivel: ${e.message}`); }

  // 6. Tentar todas as tabelas possiveis com ilike calvo em colunas de texto
  const tabelas = ["ordens_servico", "orcamentos", "financeiro_receber", "financeiro_pagar"];
  for (const t of tabelas) {
    console.log(`\n  ${t} (ilike %calvo% em colunas texto):`);
    const { data: d } = await s.from(t).select("*").limit(5);
    if (d && d.length > 0) {
      console.log(`    ${d.length} linhas`);
      const first = d[0] as any;
      const colunas = Object.keys(first).filter(k => k !== "id" && k !== "metadata" && k !== "created_at" && k !== "updated_at");
      console.log(`    Colunas: ${colunas.join(", ")}`);
      
      for (const col of colunas) {
        const { data: match } = await s.from(t).select("*").filter(col, "ilike", "%calvo%").limit(3);
        if (match && match.length > 0) {
          console.log(`    ✅ ENCONTRADO em ${t}.${col}: ${match.length} linhas`);
          for (const m of match) console.log(JSON.stringify(m).slice(0, 500));
        }
      }
    } else {
      console.log(`    Vazio`);
    }
  }

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);
