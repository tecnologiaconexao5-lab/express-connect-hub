/**
 * MISSÃO 108-C1 — Teste da sincronização delivery_proofs → entregas_protocolo
 *
 * Fluxo:
 *   1. Busca alocacao ativa (concluída ou em_rota) para usar como base
 *   2. Insere delivery_proofs simulando o App Motorista
 *   3. Verifica se entregas_protocolo foi populado
 *   4. Verifica idempotência (segundo insert não duplica)
 *   5. Verifica Event Bus (se possível)
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl) {
  console.error("❌ VITE_SUPABASE_URL não definido no .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey || supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface TestResult {
  name: string;
  status: "✅" | "❌" | "⚠️";
  detail: string;
}

const results: TestResult[] = [];

async function main() {
  console.log("=".repeat(60));
  console.log("M108-C1 — Teste POD Único (delivery_proofs → entregas_protocolo)");
  console.log("=".repeat(60));

  // 1. Buscar alocação ativa para teste
  console.log("\n📡 Buscando alocação ativa...");
  const { data: alocacoes, error: errAloc } = await supabase
    .from("alocacoes_escala")
    .select("id, prestador_id, ordem_servico_id, tenant_id, status")
    .in("status", ["concluida", "em_rota", "aceita"])
    .limit(1);

  if (errAloc || !alocacoes || alocacoes.length === 0) {
    results.push({
      name: "Buscar alocação",
      status: "⚠️",
      detail: "Nenhuma alocação ativa encontrada. Criando alocação de teste...",
    });
    console.log("⚠️ Nenhuma alocação ativa encontrada.");
    console.log("   O teste não pode prosseguir sem uma alocação real.");
    console.log("   Execute manualmente: INSERT INTO alocacoes_escala (prestador_id, status) VALUES (...);");
    printResults();
    process.exit(0);
  }

  const alocacao = alocacoes[0];
  console.log(`   ✅ Alocação: ${alocacao.id} (status: ${alocacao.status})`);

  // 2. Verificar se já existe entregas_protocolo para esta alocação
  console.log("\n📡 Verificando entregas_protocolo existente...");
  const { data: existingPod } = await supabase
    .from("entregas_protocolo")
    .select("id")
    .eq("alocacao_id", alocacao.id)
    .maybeSingle();

  if (existingPod) {
    console.log(`   ⚠️ Já existe POD para esta alocação (${existingPod.id}).`);
    console.log("   O teste de idempotência será validado com duplicata.");
  } else {
    console.log("   ✅ Nenhum POD existente para esta alocação.");
  }

  // 3. Inserir delivery_proofs simulando App Motorista
  console.log("\n📝 Inserindo delivery_proofs (simulando App Motorista)...");
  const deliveryProofId = crypto.randomUUID();
  const deliveryProofData = {
    id: deliveryProofId,
    stop_id: alocacao.id,
    operation_id: alocacao.id,
    driver_id: alocacao.prestador_id || "00000000-0000-0000-0000-000000000000",
    receiver_name: "João Teste",
    receiver_document: "123.456.789-00",
    receiver_relationship: "Recebedor",
    status: "delivered",
    photo_url: "https://storage.example.com/foto_entrega.jpg",
    signature_url: "https://storage.example.com/assinatura.png",
    observation: "Entrega realizada conforme pedido - teste M108-C1",
    latitude: -23.5505,
    longitude: -46.6333,
    gps_accuracy: 8.5,
    delivered_at: new Date().toISOString(),
  };

  const { error: errInsert } = await supabase
    .from("delivery_proofs")
    .insert(deliveryProofData);

  if (errInsert) {
    results.push({
      name: "Inserir delivery_proofs",
      status: "❌",
      detail: errInsert.message,
    });
    console.log(`   ❌ Erro: ${errInsert.message}`);
    printResults();
    process.exit(1);
  }

  results.push({
    name: "Inserir delivery_proofs",
    status: "✅",
    detail: `ID: ${deliveryProofId}`,
  });
  console.log(`   ✅ delivery_proofs inserido: ${deliveryProofId}`);

  // 4. Aguardar trigger (praticamente instantâneo - mesma transação)
  console.log("\n⏳ Aguardando trigger de sincronização...");
  await new Promise((r) => setTimeout(r, 2000));

  // 5. Verificar se entregas_protocolo foi populado
  console.log("\n🔍 Verificando entregas_protocolo...");
  const { data: ep, error: errEp } = await supabase
    .from("entregas_protocolo")
    .select("*")
    .eq("alocacao_id", alocacao.id)
    .maybeSingle();

  if (errEp) {
    results.push({
      name: "Sincronização delivery_proofs → entregas_protocolo",
      status: "❌",
      detail: `Erro ao consultar: ${errEp.message}`,
    });
  } else if (ep) {
    const checks = [
      ep.nome_recebedor === deliveryProofData.receiver_name,
      ep.documento_recebedor === deliveryProofData.receiver_document,
      ep.receiver_relationship === deliveryProofData.receiver_relationship,
      ep.foto_entrega_url === deliveryProofData.photo_url,
      ep.assinatura_url === deliveryProofData.signature_url,
      ep.observacao === deliveryProofData.observation,
      ep.latitude === deliveryProofData.latitude,
      ep.longitude === deliveryProofData.longitude,
      ep.gps_accuracy === deliveryProofData.gps_accuracy,
      ep.alocacao_id === alocacao.id,
    ];

    const allOk = checks.every(Boolean);
    const failedFields = [
      ["nome_recebedor", ep.nome_recebedor, deliveryProofData.receiver_name],
      ["documento_recebedor", ep.documento_recebedor, deliveryProofData.receiver_document],
      ["receiver_relationship", ep.receiver_relationship, deliveryProofData.receiver_relationship],
      ["foto_entrega_url", ep.foto_entrega_url, deliveryProofData.photo_url],
      ["assinatura_url", ep.assinatura_url, deliveryProofData.signature_url],
      ["observacao", ep.observacao, deliveryProofData.observation],
      ["latitude", ep.latitude, deliveryProofData.latitude],
      ["longitude", ep.longitude, deliveryProofData.longitude],
      ["gps_accuracy", ep.gps_accuracy, deliveryProofData.gps_accuracy],
      ["alocacao_id", ep.alocacao_id, alocacao.id],
    ].filter(([_, got, expected]) => got !== expected);

    if (allOk) {
      results.push({
        name: "Sincronização delivery_proofs → entregas_protocolo",
        status: "✅",
        detail: `${ep.id} — 10/10 campos conferem`,
      });
      console.log(`   ✅ entregas_protocolo populado: ${ep.id}`);
      console.log(`   ✅ 10/10 campos mapeados corretamente`);
    } else {
      results.push({
        name: "Sincronização delivery_proofs → entregas_protocolo",
        status: "❌",
        detail: `${failedFields.length} campos divergentes: ${failedFields.map(([f]) => f).join(", ")}`,
      });
      console.log(`   ❌ ${failedFields.length} campos divergentes:`);
      for (const [field, got, expected] of failedFields) {
        console.log(`       ${field}: esperado=${expected}, recebido=${got}`);
      }
    }
  } else {
    results.push({
      name: "Sincronização delivery_proofs → entregas_protocolo",
      status: "❌",
      detail: "Nenhum registro encontrado em entregas_protocolo para esta alocação",
    });
    console.log("   ❌ Nenhum registro em entregas_protocolo!");
  }

  // 6. Testar idempotência: inserir delivery_proofs duplicado
  console.log("\n🔁 Testando idempotência (insert duplicado)...");
  const dupData = { ...deliveryProofData, id: crypto.randomUUID(), receiver_name: "João Teste 2" };
  const { error: errDup } = await supabase.from("delivery_proofs").insert(dupData);

  if (errDup) {
    results.push({
      name: "Idempotência (insert duplicado em delivery_proofs)",
      status: "❌",
      detail: errDup.message,
    });
  } else {
    // Aguardar trigger
    await new Promise((r) => setTimeout(r, 1000));

    const { data: ep2, error: errEp2 } = await supabase
      .from("entregas_protocolo")
      .select("id, nome_recebedor")
      .eq("alocacao_id", alocacao.id);

    if (errEp2) {
      results.push({
        name: "Idempotência",
        status: "⚠️",
        detail: `Erro ao verificar: ${errEp2.message}`,
      });
    } else if (ep2 && ep2.length === 1) {
      results.push({
        name: "Idempotência (não duplicou entregas_protocolo)",
        status: "✅",
        detail: `1 registro apenas para alocação (${ep2[0].nome_recebedor})`,
      });
      console.log("   ✅ Idempotente: segundo insert não duplicou entregas_protocolo");
    } else {
      results.push({
        name: "Idempotência",
        status: "❌",
        detail: `${ep2?.length || 0} registros encontrados (esperado: 1)`,
      });
    }
  }

  // 7. Verificar Event Bus (evento entrega.comprovante.pod_enviado)
  console.log("\n📡 Verificando Event Bus...");
  const { data: eventos } = await supabase
    .from("eventos_oficiais")
    .select("event_type, entity_id, created_at")
    .eq("event_type", "entrega.comprovante.pod_enviado")
    .order("created_at", { ascending: false })
    .limit(3);

  if (eventos && eventos.length > 0) {
    results.push({
      name: "Event Bus (pod_enviado)",
      status: "✅",
      detail: `${eventos.length} evento(s) encontrado(s). Último: ${eventos[0].event_type}`,
    });
  } else {
    results.push({
      name: "Event Bus (pod_enviado)",
      status: "⚠️",
      detail: "Nenhum evento encontrado (trigger M104 pode não estar ativa)",
    });
  }

  // 8. Resultado
  printResults();

  // Cleanup (opcional - manter dados para auditoria)
  const totalOk = results.filter((r) => r.status === "✅").length;
  const totalFail = results.filter((r) => r.status === "❌").length;
  const totalWarn = results.filter((r) => r.status === "⚠️").length;

  console.log("\n" + "=".repeat(60));
  console.log(`RESULTADO: ${totalOk} ✅ / ${totalFail} ❌ / ${totalWarn} ⚠️`);
  if (totalFail === 0) {
    console.log("✅ Sincronização delivery_proofs → entregas_protocolo VALIDADA!");
  } else {
    console.log("❌ Falhas encontradas — revisar migration.");
    process.exit(1);
  }
}

function printResults() {
  console.log("\n" + "-".repeat(60));
  console.log("RESULTADOS:");
  console.log("-".repeat(60));
  for (const r of results) {
    console.log(`  ${r.status} ${r.name}`);
    console.log(`     ${r.detail}`);
  }
}

main().catch((err) => {
  console.error("\n❌ Erro fatal:", err);
  process.exit(1);
});
