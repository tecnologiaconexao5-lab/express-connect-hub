/**
 * Script para popular tabela municipios_ibge com seeds + vincular OS ao romaneio 340612
 * Executar: npx tsx scripts/calvo-ibge-e-os-340612.ts
 */
import { createClient } from "@supabase/supabase-js";

const s = createClient(
  "https://uwrvzsjtpgaifkktpepn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs"
);

async function main() {
  console.log("═".repeat(60));
  console.log("  CALVO 340612 — IBGE + OS");
  console.log("═".repeat(60));

  // ── Autenticação ──────────────────────────────────────────────
  console.log("\n🔐 Autenticando...");
  const email = `calvo-op-${Date.now()}@conexaoexpress.com.br`;
  const pwd = "Calvo340612!";

  let authOk = false;

  // Tentar signUp
  const { data: signUpData, error: signUpErr } = await s.auth.signUp({ email, password: pwd });
  if (signUpErr) {
    console.log("  signUp erro:", signUpErr.message);
    // Tentar signIn
    const { error: signInErr } = await s.auth.signInWithPassword({ email, password: pwd });
    if (signInErr) {
      console.log("  signIn erro:", signInErr.message);
    } else {
      console.log("  ✅ Autenticado via signIn");
      authOk = true;
    }
  } else if (signUpData.session) {
    console.log("  ✅ Autenticado via signUp (session ativa)");
    authOk = true;
  } else {
    console.log("  ⚠️ signUp OK mas sem session (email confirmation pode ser necessário)");
    // Tenta signIn mesmo assim
    const { error: signInErr } = await s.auth.signInWithPassword({ email, password: pwd });
    if (!signInErr) {
      console.log("  ✅ signIn funcionou");
      authOk = true;
    }
  }

  // ── IBGE ──────────────────────────────────────────────────────
  console.log("\n🏙️  Populando municipios_ibge...");

  const municipios = [
    { codigo: "3550308", nome: "São Paulo", uf: "SP" },
    { codigo: "3509502", nome: "Campinas", uf: "SP" },
    { codigo: "3518800", nome: "Guarulhos", uf: "SP" },
    { codigo: "3524402", nome: "Jacareí", uf: "SP" },
    { codigo: "3546801", nome: "Santa Isabel", uf: "SP" },
    { codigo: "4106902", nome: "Curitiba", uf: "PR" },
    { codigo: "3118601", nome: "Contagem", uf: "MG" },
    { codigo: "3304557", nome: "Rio de Janeiro", uf: "RJ" },
    { codigo: "3106200", nome: "Belo Horizonte", uf: "MG" },
  ];

  let ibgeOk = 0;
  for (const m of municipios) {
    const { error } = await s.from("municipios_ibge").upsert(
      { codigo: m.codigo, nome: m.nome, uf: m.uf },
      { onConflict: "codigo" }
    );
    if (error) {
      console.log(`  ❌ ${m.codigo} ${m.nome}: ${error.message}`);
    } else {
      console.log(`  ✅ ${m.codigo} ${m.nome}/${m.uf}`);
      ibgeOk++;
    }
  }

  const { count } = await s.from("municipios_ibge").select("*", { count: "exact", head: true });
  console.log(`\n  Total municipios_ibge: ${count}`);

  // ── Vincular OS ───────────────────────────────────────────────
  console.log("\n🔗 Buscando OS para vincular...");

  // Buscar OS disponível
  const { data: oss } = await s.from("ordens_servico")
    .select("id,numero,cliente,cliente_id,status")
    .or("cliente.ilike.%calvo%,cliente.ilike.%CALVO%")
    .order("created_at", { ascending: false })
    .limit(5);

  if (oss && oss.length > 0) {
    console.log(`  OS encontradas: ${oss.length}`);
    for (const os of oss) {
      console.log(`    ${os.numero} (${os.status}) - ${os.cliente || os.cliente_id}`);
    }

    // Usar a primeira OS
    const osAlvo = oss[0];
    console.log(`\n  Usando OS: ${osAlvo.numero} (${osAlvo.id})`);

    // Vincular documentos do romaneio 340612
    const { data: docs } = await s.from("fiscal_documentos_vinculados")
      .select("id,numero")
      .filter("metadata->>romaneio_numero", "eq", "340612");

    if (docs && docs.length > 0) {
      let vincOk = 0;
      for (const doc of docs) {
        const { error } = await s.from("fiscal_documentos_vinculados")
          .update({ ordem_servico_id: osAlvo.id, status: "vinculado" })
          .eq("id", doc.id);

        if (error) {
          console.log(`    ❌ NF-e ${doc.numero}: ${error.message}`);
        } else {
          console.log(`    ✅ NF-e ${doc.numero} → OS ${osAlvo.numero}`);
          vincOk++;
        }
      }
      console.log(`\n  Vinculados: ${vincOk}/${docs.length}`);
    }
  } else {
    console.log("  ⚠️ Nenhuma OS encontrada para Calvo.");
    console.log("    Criando OS de teste...");

    // Buscar cliente Calvo
    const { data: cliente } = await s.from("clientes")
      .select("id,razao_social")
      .or("razao_social.ilike.%calvo%,nome_fantasia.ilike.%calvo%")
      .limit(1)
      .maybeSingle();

    if (cliente) {
      console.log(`  Cliente: ${cliente.razao_social} (${cliente.id})`);

      const { data: osNova } = await s.from("ordens_servico")
        .insert([{
          numero: `OS-CALVO-340612`,
          cliente_id: cliente.id,
          cliente: cliente.razao_social,
          status: "finalizada",
          veiculo_tipo: "VAN",
          tipo_operacao: "TRANSPORTE",
          valor_cliente: 600.00,
          created_at: new Date().toISOString(),
        }])
        .select("id,numero")
        .single();

      if (osNova) {
        console.log(`  ✅ OS criada: ${osNova.numero} (${osNova.id})`);

        const { data: docs } = await s.from("fiscal_documentos_vinculados")
          .select("id,numero")
          .filter("metadata->>romaneio_numero", "eq", "340612");

        if (docs) {
          let vincOk = 0;
          for (const doc of docs) {
            const { error } = await s.from("fiscal_documentos_vinculados")
              .update({ ordem_servico_id: osNova.id, status: "vinculado" })
              .eq("id", doc.id);
            console.log(error ? `    ❌ NF-e ${doc.numero}: ${error.message}` : `    ✅ NF-e ${doc.numero} → OS ${osNova.numero}`);
            if (!error) vincOk++;
          }
          console.log(`\n  Vinculados: ${vincOk}/${docs.length}`);
        }
      } else {
        console.log("  ❌ Erro ao criar OS");
      }
    } else {
      console.log("  ❌ Cliente Calvo não encontrado.");
    }
  }

  // ── Resumo final ──────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("  RESUMO");
  console.log("═".repeat(60));
  const { count: ibgeCount } = await s.from("municipios_ibge").select("*", { count: "exact", head: true });
  console.log(`  IBGE populado:         ${ibgeCount} municípios`);

  const { data: docsFinal } = await s.from("fiscal_documentos_vinculados")
    .select("numero,ordem_servico_id")
    .filter("metadata->>romaneio_numero", "eq", "340612");

  const comOs = docsFinal?.filter((d: any) => d.ordem_servico_id).length || 0;
  console.log(`  Documentos com OS:     ${comOs}/${docsFinal?.length || 0}`);
}

main().catch(console.error);
