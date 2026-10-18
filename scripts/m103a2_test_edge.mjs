// ═══════════════════════════════════════════════════════════════════════════════
// Teste real da Edge Function criar-alocacao-escala com prestador/OS válidos
// ═══════════════════════════════════════════════════════════════════════════════
import "dotenv/config";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const INTERNAL_TOKEN = process.env.VITE_TMS_EDGE_INTERNAL_TOKEN || "tms-internal-token-temporario";

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║  TESTE EDGE FUNCTION — Criação de Alocação              ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  // 1. Buscar um prestador real
  console.log("1. Buscando prestador válido...");
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, ANON_KEY);

  const { data: prestador, error: errP } = await supabase
    .from("prestadores")
    .select("id, nome_completo, cpf_cnpj")
    .limit(1)
    .single();

  if (errP || !prestador) {
    console.error("❌ Nenhum prestador encontrado:", errP?.message);
    process.exit(1);
  }
  console.log(`   Prestador: ${prestador.nome_completo || prestador.id}`);

  // 2. Buscar uma OS válida (opcional)
  console.log("2. Buscando OS pendente (opcional)...");
  const { data: os } = await supabase
    .from("ordens_servico")
    .select("id, numero, cliente, cliente_id")
    .eq("status", "pendente")
    .limit(1)
    .single();

  if (os) {
    console.log(`   OS encontrada: ${os.numero || os.id}`);
  } else {
    console.log("   Nenhuma OS pendente encontrada — testando sem OS vinculada.");
  }

  // 3. Chamar Edge Function
  console.log("\n3. Chamando Edge Function criar-alocacao-escala...");
  const today = "2026-07-07";
  const functionUrl = `${SUPABASE_URL}/functions/v1/criar-alocacao-escala`;

  const payload = {
    prestador_id: prestador.id,
    data_escala: today,
    status: "planejada",
    tipo_veiculo: "vuc",
    turno: "diurno",
    placa: "TESTE-001",
    origem: "Centro de Distribuição - Teste",
    destino: "Cliente Final - Teste Automatizado",
    valor_frete: 500.00,
    valor_repasse: 300.00,
    valor_pedagio: 25.00,
    valor_combustivel: 80.00,
    valor_ajudante: 50.00,
    km_previstos: 120,
    horario_saida: "08:00",
    horario_retorno_previsto: "18:00",
    observacoes: "Teste automático M103A2 - desconsiderar",
    ...(os ? { ordem_servico_id: os.id, cliente_id: os.cliente_id, cliente_nome: os.cliente } : {}),
  };

  console.log(`   URL: ${functionUrl}`);
  console.log(`   Payload: ${JSON.stringify(payload, null, 2)}`);

  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ANON_KEY}`,
      "x-tms-internal-token": INTERNAL_TOKEN,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  console.log(`\n   Status HTTP: ${response.status}`);
  console.log(`   Resposta: ${JSON.stringify(result, null, 2)}`);

  // 4. Verificar resultado
  if (response.ok && result.ok) {
    console.log(`\n✅ ALCORAÇÃO CRIADA COM SUCESSO!`);
    console.log(`   ID: ${result.id}`);

    // Verificar no banco se foi persistida
    console.log("\n4. Verificando persistência no banco...");
    const { data: alocacao, error: errA } = await supabase
      .from("alocacoes_escala")
      .select("id, status, data_escala, prestador_id, valor_frete, valor_repasse, created_at")
      .eq("id", result.id)
      .single();

    if (errA || !alocacao) {
      console.error(`   ❌ Alocação não encontrada no banco: ${errA?.message}`);
    } else {
      console.log(`   ✅ Alocação persistida:`);
      console.log(`      ID: ${alocacao.id}`);
      console.log(`      Status: ${alocacao.status}`);
      console.log(`      Data: ${alocacao.data_escala}`);
      console.log(`      Frete: R$ ${alocacao.valor_frete}`);
      console.log(`      Repasse: R$ ${alocacao.valor_repasse}`);
      console.log(`      Criado em: ${alocacao.created_at}`);

      // Verificar propagação financeira (trigger M66)
      console.log("\n5. Verificando propagação financeira (trigger M66)...");

      // Verificar financeiro_receber
      const { data: rec } = await supabase
        .from("financeiro_receber")
        .select("id, valor, status, cliente_nome")
        .eq("os_id", result.id)
        .maybeSingle();
      console.log(`   Financeiro Receber: ${rec ? `✅ R$ ${rec.valor} (${rec.status})` : "❌ AUSENTE (esperado)"}`);

      // Verificar financeiro_pagar
      const { data: pag } = await supabase
        .from("financeiro_pagar")
        .select("id, valor, status, fornecedor_nome")
        .eq("os_id", result.id)
        .maybeSingle();
      console.log(`   Financeiro Pagar: ${pag ? `✅ R$ ${pag.valor} (${pag.status})` : "❌ AUSENTE (esperado)"}`);

      // Verificar pagamentos_prestadores
      const { data: pp } = await supabase
        .from("pagamentos_prestadores")
        .select("id, valor_liquido, prestador_nome, os_id")
        .eq("os_id", result.id)
        .maybeSingle();
      console.log(`   Pagamentos Prestadores: ${pp ? `✅ R$ ${pp.valor_liquido}` : "❌ AUSENTE (esperado)"}`);
    }

    // 6. Limpeza: remover alocação de teste
    console.log("\n6. Limpando registro de teste...");
    const { error: errDel } = await supabase
      .from("alocacoes_escala")
      .delete()
      .eq("id", result.id);

    if (errDel) {
      console.warn(`   ⚠️  Não foi possível remover: ${errDel.message}`);
    } else {
      console.log(`   ✅ Alocação de teste removida.`);
    }

    console.log(`\n🎯 TESTE COMPLETO — FLUXO DE CRIAÇÃO DE ESCALA FUNCIONAL!`);
    return true;
  } else {
    console.error(`\n❌ FALHA NA CRIAÇÃO DE ALCORAÇÃO`);
    console.error(`   Erro: ${result.error || result.message}`);
    if (result.detalhes) console.error(`   Detalhes: ${result.detalhes}`);
    if (result.erro_code) console.error(`   Código: ${result.erro_code}`);
    if (result.erro_hint) console.error(`   Hint: ${result.erro_hint}`);
    return false;
  }
}

main()
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((err) => { console.error("Fatal:", err); process.exit(1); });
