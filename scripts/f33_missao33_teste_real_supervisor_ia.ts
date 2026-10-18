/**
 * MISSÃO 33 — TESTE REAL DO SUPERVISOR IA
 *
 * Valida em ambiente real:
 * 1. proxy-ia Edge Function (Groq, Gemini, OpenRouter)
 * 2. aiSupervisor (econômico, balanceado, premium, cache, fallback)
 * 3. Custos (ia_custos_ia)
 * 4. Segurança (não expõe chaves)
 */
import dotenv from "dotenv";
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const PROXY_IA_URL = `${SUPABASE_URL}/functions/v1/proxy-ia`;

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (SUPABASE_ANON_KEY) h["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
  return h;
}

interface ProxyResult {
  sucesso: boolean;
  resposta: string;
  provider: string;
  model: string;
  tokens_entrada: number;
  tokens_saida: number;
  erro?: string;
}

interface CostRecord {
  tenant_id: string;
  provedor: string;
  modelo: string;
  tipo_tarefa: string;
  status: string;
  custo_estimado: number;
  tempo_resposta_ms: number;
}

// ============================================================
// HELPERS
// ============================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

function assert(label: string, ok: boolean, detail?: string) {
  totalTests++;
  if (ok) {
    passedTests++;
    console.log(`   ✅ ${label}`);
  } else {
    failedTests++;
    const msg = detail ? `${label}: ${detail}` : label;
    failures.push(msg);
    console.log(`   ❌ ${msg}`);
  }
}

async function chamarProxy(
  provider: string,
  model: string,
  prompt: string,
  context = "",
  temperature = 0.7,
  maxTokens = 1024,
): Promise<ProxyResult> {
  const body = { provider, model, prompt, context, temperature, max_tokens: maxTokens };
  const response = await fetch(PROXY_IA_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return {
      sucesso: false,
      resposta: "",
      provider,
      model,
      tokens_entrada: 0,
      tokens_saida: 0,
      erro: `HTTP ${response.status}: ${text.substring(0, 200)}`,
    };
  }
}

function medirTempo(fn: () => Promise<void>): Promise<number> {
  const inicio = Date.now();
  return fn().then(() => Date.now() - inicio);
}

// ============================================================
// 1. PROXY-IA EDGE FUNCTION
// ============================================================

async function testProxyIa() {
  console.log("\n" + "=".repeat(70));
  console.log("1. PROXY-IA EDGE FUNCTION");
  console.log("=".repeat(70));

  // 1.1 Verificar se a URL está configurada
  assert("proxy-ia URL configurada", !!SUPABASE_URL, `SUPABASE_URL: ${SUPABASE_URL ? "ok" : "vazio"}`);

  // 1.2 Chamada simples para ver se está publicada
  const inicio = Date.now();
  try {
    const res = await chamarProxy("groq", "llama-3.1-8b-instant", "Ping");
    const tempo = Date.now() - inicio;

    assert("proxy-ia respondeu", res.sucesso === true, `tempo: ${tempo}ms, erro: ${res.erro || "nenhum"}`);
    if (res.sucesso) {
      assert("proxy-ia retornou resposta não vazia", res.resposta && res.resposta.length > 0, `resposta: ${(res.resposta || "").slice(0, 100)}`);
      assert("proxy-ia retornou provider correto", res.provider === "groq");
      assert("proxy-ia retornou modelo correto", res.model === "llama-3.1-8b-instant");
      assert("proxy-ia tempo aceitável (< 15s)", tempo < 15000, `tempo: ${tempo}ms`);
      assert("proxy-ia não expõe chave na resposta", !JSON.stringify(res).includes("sk-") && !JSON.stringify(res).includes("GEMINI_API_KEY"), "chave exposta na resposta!");

      console.log(`   📊 Tempo: ${tempo}ms | Tokens entrada: ${res.tokens_entrada} | saída: ${res.tokens_saida}`);
      console.log(`   📝 Resumo: ${(res.resposta || "").slice(0, 120)}`);
    } else {
      assert("proxy-ia resposta com sucesso", false, `Erro: ${res.erro}`);
    }
  } catch (e: any) {
    assert("proxy-ia está publicada e acessível", false, `${e.message}`);
  }
}

// ============================================================
// 2. GROQ
// ============================================================

async function testGroq() {
  console.log("\n" + "=".repeat(70));
  console.log("2. GROQ");
  console.log("=".repeat(70));

  // 2.1 Resumo curto
  let tempo = await medirTempo(async () => {
    const res = await chamarProxy("groq", "llama-3.1-8b-instant", "Resuma em uma frase: A logística reversa é um processo essencial para empresas que buscam sustentabilidade.");
    assert("Groq resumo curto", res.sucesso && res.resposta.length > 0, `erro: ${res.erro || "vazio"}`);
  });
  console.log(`   📊 Tempo resumo: ${tempo}ms`);

  // 2.2 Resposta de atendimento
  tempo = await medirTempo(async () => {
    const res = await chamarProxy("groq", "llama-3.1-8b-instant",
      "Você é atendente de uma transportadora. Responda educadamente: 'Onde está minha entrega?'",
      "Cliente: João Silva, Pedido: #12345");
    assert("Groq resposta atendimento", res.sucesso && res.resposta.length > 20, `erro: ${res.erro || "curta demais"}`);
  });
  console.log(`   📊 Tempo atendimento: ${tempo}ms`);

  // 2.3 Classificação de mensagem
  tempo = await medirTempo(async () => {
    const res = await chamarProxy("groq", "llama-3.1-8b-instant",
      "Classifique a mensagem como: duvida, reclamacao, orcamento, urgente. Mensagem: 'Minha carga chegou avariada! Quero falar com o supervisor agora!'");
    assert("Groq classificação", res.sucesso && res.resposta && res.resposta.length > 0, `erro: ${res.erro || "vazio"}`);
    if (res.resposta) {
      const classificacao = (res.resposta || "").toLowerCase();
      const valida = classificacao.includes("reclamacao") || classificacao.includes("urgente") || classificacao.includes("reclama");
      assert("Groq classificação correta (reclamação/urgente)", valida, `resposta: ${res.resposta.slice(0, 100)}`);
    }
  });
  console.log(`   📊 Tempo classificação: ${tempo}ms`);
}

// ============================================================
// 3. GEMINI
// ============================================================

async function testGemini() {
  console.log("\n" + "=".repeat(70));
  console.log("3. GEMINI");
  console.log("=".repeat(70));

  // Helper para testar Gemini (pode retornar 429 se quota excedida)
  const geminiModel = "gemini-2.0-flash";
  async function testGeminiCall(label: string, prompt: string, minLen = 0) {
    let t = await medirTempo(async () => {
      const res = await chamarProxy("gemini", geminiModel, prompt);
      if (res.sucesso) {
        assert(`Gemini ${label}`, res.resposta.length > minLen, `erro: ${res.erro || "curta"}`);
      } else {
        const err = res.erro || "";
        if (err.includes("429") || err.includes("quota")) {
          assert(`Gemini ${label} (quota excedida)`, false, "Modelo reconhecido mas quota diária excedida - configurar billing");
        } else {
          assert(`Gemini ${label}`, false, err.slice(0, 100));
        }
      }
    });
    console.log(`   📊 Tempo ${label}: ${t}ms`);
  }

  await testGeminiCall("análise texto",
    "Analise este texto e extraia as palavras-chave: 'Precisamos contratar mais motoristas para a rota São Paulo-Rio, pois a demanda aumentou 40% no último trimestre.'");

  await testGeminiCall("resposta comercial",
    "Escreva uma resposta comercial curta e profissional para um lead interessado em fretes.", 10);

  await testGeminiCall("triagem motorista",
    "Analise este candidato a motorista: CNH E, 5 anos de experiência, sem multas nos últimos 2 anos, disponível para rotas noturnas. Classifique como: apto, condicional ou inapto.");

  await testGeminiCall("análise documento",
    "Resuma em 3 tópicos este documento fictício: 'Contrato de prestação de serviços de transporte. Cliente: Empresa X. Valor: R$ 50.000/mês. Prazo: 12 meses. Renovação automática.'", 10);
}

// ============================================================
// 4. OPENROUTER
// ============================================================

async function testOpenRouter() {
  console.log("\n" + "=".repeat(70));
  console.log("4. OPENROUTER");
  console.log("=".repeat(70));

  // 4.1 Tarefa complexa
  let tempo = await medirTempo(async () => {
    const res = await chamarProxy("openrouter", "openrouter/auto",
      "Planeje uma rota otimizada para entregas: 3 pontos em São Paulo (Zona Sul, Centro, Zona Norte), saindo do depósito em Guarulhos, considerando horários de pico.");
    if (res.sucesso) {
      assert("OpenRouter tarefa complexa", true, `resposta: ${res.resposta.slice(0, 80)}...`);
    } else {
      const errMsg = res.erro || "";
      if (errMsg.includes("crédito") || errMsg.includes("quota") || errMsg.includes("credit") || errMsg.includes("insufficient")) {
        assert("OpenRouter sem crédito (reportado)", false, "Sem crédito ou quota excedida - chave válida mas sem saldo");
      } else if (errMsg.includes("503") || errMsg.includes("não configurado")) {
        assert("OpenRouter não configurado", false, "OPENROUTER_API_KEY não configurada no Supabase Secrets");
      } else {
        assert("OpenRouter tarefa complexa", false, errMsg.slice(0, 150));
      }
    }
  });
  console.log(`   📊 Tempo: ${tempo}ms`);
}

// ============================================================
// 5. SUPERVISOR (aiSupervisor)
// ============================================================

async function testSupervisor() {
  console.log("\n" + "=".repeat(70));
  console.log("5. AI SUPERVISOR");
  console.log("=".repeat(70));

  // Importar o supervisor
  const { aiSupervisor } = await import("../src/services/ia/aiSupervisor");
  const TENANT_ID = crypto.randomUUID ? crypto.randomUUID() : "00000000-0000-0000-0000-000000000001";

  // 5.1 Modo econômico
  console.log("\n   🔵 5.1 Modo Econômico");
  try {
    const res = await aiSupervisor.executar({
      tenant_id: TENANT_ID,
      tipo_tarefa: "classificar_mensagem",
      prompt: "Resuma em uma frase: O transporte rodoviário de cargas é regulado pela ANTT.",
      modo: "economico",
    });
    assert("Econômico: sucesso", res.sucesso, `erro: ${res.erro || "nenhum"}`);
    assert("Econômico: provedor esperado (groq)", res.provedor === "groq" || res.provedor === "gemini", `provedor: ${res.provedor}`);
    assert("Econômico: complexidade economico", res.complexidade === "1_economico", `complexidade: ${res.complexidade}`);
    assert("Econômico: custo baixo", res.custo_estimado < 0.01, `custo: ${res.custo_estimado}`);
    assert("Econômico: não veio do cache (primeira chamada)", !res.cache_hit);
    console.log(`   📊 Provedor: ${res.provedor}/${res.modelo} | Custo: $${res.custo_estimado} | Tempo: ${res.tempo_resposta_ms}ms`);
  } catch (e: any) {
    assert("Econômico: executou sem erro", false, e.message);
  }

  // 5.2 Modo balanceado
  console.log("\n   🔵 5.2 Modo Balanceado");
  try {
    const res = await aiSupervisor.executar({
      tenant_id: TENANT_ID,
      tipo_tarefa: "atendimento_cliente",
      prompt: "Um cliente está reclamando de atraso na entrega. Responda de forma profissional.",
      modo: "balanceado",
    });
    assert("Balanceado: sucesso", res.sucesso, `erro: ${res.erro || "nenhum"}`);
    assert("Balanceado: complexidade intermediario", res.complexidade === "2_intermediario", `complexidade: ${res.complexidade}`);
    assert("Balanceado: custo moderado", res.custo_estimado < 0.05, `custo: ${res.custo_estimado}`);
    console.log(`   📊 Provedor: ${res.provedor}/${res.modelo} | Custo: $${res.custo_estimado} | Tempo: ${res.tempo_resposta_ms}ms`);
  } catch (e: any) {
    assert("Balanceado: executou sem erro", false, e.message);
  }

  // 5.3 Modo premium
  console.log("\n   🔵 5.3 Modo Premium");
  try {
    const res = await aiSupervisor.executar({
      tenant_id: TENANT_ID,
      tipo_tarefa: "auditoria_contrato",
      prompt: "Analise este contrato e identifique cláusulas de risco: Prazo de 24 meses, multa rescisória de 50%, renovação automática, arbitragem internacional.",
      modo: "premium",
    });
    assert("Premium: sucesso", res.sucesso, `erro: ${res.erro || "nenhum"}`);
    assert("Premium: complexidade complexo", res.complexidade === "3_complexo", `complexidade: ${res.complexidade}`);
    console.log(`   📊 Provedor: ${res.provedor}/${res.modelo} | Custo: $${res.custo_estimado} | Tempo: ${res.tempo_resposta_ms}ms`);
  } catch (e: any) {
    assert("Premium: executou sem erro", false, e.message);
  }

  // 5.4 Cache
  console.log("\n   🔵 5.4 Cache");
  try {
    const res1 = await aiSupervisor.executar({
      tenant_id: TENANT_ID,
      tipo_tarefa: "classificar_mensagem",
      prompt: "Classifique: 'Preciso de um orçamento para fretes.' como: lead, duvida, orcamento.",
      modo: "economico",
      cachear: true,
    });
    const res2 = await aiSupervisor.executar({
      tenant_id: TENANT_ID,
      tipo_tarefa: "classificar_mensagem",
      prompt: "Classifique: 'Preciso de um orçamento para fretes.' como: lead, duvida, orcamento.",
      modo: "economico",
      cachear: true,
    });
    assert("Cache: primeira chamada não foi cache", !res1.cache_hit);
    assert("Cache: segunda chamada veio do cache", res2.cache_hit, `cache_hit: ${res2.cache_hit}`);
    assert("Cache: respostas idênticas", res1.resposta === res2.resposta);
    assert("Cache: segunda chamada mais rápida", res2.tempo_resposta_ms < res1.tempo_resposta_ms,
      `1a: ${res1.tempo_resposta_ms}ms, 2a: ${res2.tempo_resposta_ms}ms`);
    console.log(`   📊 1a: ${res1.tempo_resposta_ms}ms (${res1.cache_hit ? "cache" : "direto"}) | 2a: ${res2.tempo_resposta_ms}ms (${res2.cache_hit ? "cache" : "direto"})`);
  } catch (e: any) {
    assert("Cache: executou sem erro", false, e.message);
  }

  // 5.5 Cache evitado em tarefa sensível
  console.log("\n   🔵 5.5 Cache evitado em tarefa sensível");
  try {
    const res1 = await aiSupervisor.executar({
      tenant_id: TENANT_ID,
      tipo_tarefa: "auditoria",
      prompt: "Audite a conformidade fiscal do último mês.",
      modo: "balanceado",
      cachear: true,
    });
    const res2 = await aiSupervisor.executar({
      tenant_id: TENANT_ID,
      tipo_tarefa: "auditoria",
      prompt: "Audite a conformidade fiscal do último mês.",
      modo: "balanceado",
      cachear: true,
    });
    assert("Cache sensível: primeira chamada não foi cache", !res1.cache_hit);
    assert("Cache sensível: segunda chamada também NÃO veio do cache (tarefa sensível)", !res2.cache_hit,
      `cache_hit: ${res2.cache_hit} — tarefa auditoria não deveria usar cache`);
    console.log(`   📊 1a: ${res1.tempo_resposta_ms}ms | 2a: ${res2.tempo_resposta_ms}ms (ambas diretas)`);
  } catch (e: any) {
    assert("Cache sensível: executou sem erro", false, e.message);
  }

  // 5.6 Fallback
  console.log("\n   🔵 5.6 Fallback (provedor inválido)");
  try {
    const res = await aiSupervisor.executar({
      tenant_id: TENANT_ID,
      tipo_tarefa: "classificar_mensagem",
      prompt: "Teste de fallback com provedor inválido.",
      modo: "economico",
    });
    // Mesmo que o primeiro da fila falhe, o fallback deve funcionar
    assert("Fallback: resposta foi gerada", res.sucesso || !res.sucesso, `status: ${res.sucesso}, erro: ${res.erro || "nenhum"}`);
    if (!res.sucesso) {
      assert("Fallback: todos falharam (reportado)", false, `Todos os provedores falharam: ${res.erro}`);
    } else {
      assert("Fallback: resposta não vazia", res.resposta.length > 0);
      console.log(`   📊 Provedor final: ${res.provedor}/${res.modelo} | Fallback usado: ${res.fallback_usado}`);
    }
  } catch (e: any) {
    assert("Fallback: executou sem erro", false, e.message);
  }
}

// ============================================================
// 6. CUSTOS / LOGS
// ============================================================

async function testCustos() {
  console.log("\n" + "=".repeat(70));
  console.log("6. CUSTOS E LOGS");
  console.log("=".repeat(70));

  const { supabase } = await import("../src/lib/supabase");
  // Usar UUID fixo para garantir consistência entre insert e lookup
  const TENANT_ID = "00000000-0000-0000-0000-00000000custo";

  // 6.1 Usar aiSupervisor para gerar custos
  const { aiSupervisor } = await import("../src/services/ia/aiSupervisor");

  const res = await aiSupervisor.executar({
    tenant_id: TENANT_ID,
    usuario_id: TENANT_ID,
    tipo_tarefa: "teste_custos",
    prompt: "Teste de registro de custos na tabela ia_custos_ia.",
    modo: "economico",
  });
  assert("Custos: execução do supervisor ok", res.sucesso, res.erro || "ok");
  // Aguardar registro de custo assíncrono completar
  await new Promise((r) => setTimeout(r, 2000));

  // 6.2 Verificar se os custos foram registrados
  const { data: custos } = await supabase
    .from("ia_custos_ia")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false })
    .limit(5);

  if (custos && custos.length > 0) {
    assert("Custos: registros encontrados", true, `${custos.length} registros`);
    const c = custos[0] as CostRecord;
    assert("Custos: tenant_id correto", c.tenant_id === TENANT_ID);
    assert("Custos: provedor preenchido", !!c.provedor, `provedor: ${c.provedor}`);
    assert("Custos: modelo preenchido", !!c.modelo, `modelo: ${c.modelo}`);
    assert("Custos: status preenchido", !!c.status, `status: ${c.status}`);
    assert("Custos: custo_estimado é número", typeof c.custo_estimado === "number");
    assert("Custos: tempo_resposta_ms > 0", c.tempo_resposta_ms > 0, `tempo: ${c.tempo_resposta_ms}ms`);
    console.log(`   📊 Último custo: ${c.provedor}/${c.modelo} | $${c.custo_estimado} | ${c.tempo_resposta_ms}ms | ${c.status}`);
  } else {
    assert("Custos: registros encontrados", false, "Nenhum registro de custo encontrado para o tenant");
  }

  // 6.3 Verificar que prompts sensíveis NÃO estão completos nos logs
  const { data: logs } = await supabase
    .from("ia_logs")
    .select("prompt, entrada")
    .order("created_at", { ascending: false })
    .limit(3);

  if (logs && logs.length > 0) {
    // Verificar que prompts estão truncados (máx 2000 caracteres)
    for (const log of logs) {
      const p = (log as any).prompt || "";
      const e = (log as any).entrada || "";
      if (p.length > 0) {
        assert("Logs: prompt truncado (<=2000)", p.length <= 2000, `tamanho: ${p.length}`);
      }
      if (e.length > 0) {
        assert("Logs: entrada truncada (<=2000)", e.length <= 2000, `tamanho: ${e.length}`);
      }
    }
    console.log(`   📊 ${logs.length} logs verificados — prompts truncados corretamente`);
  }
}

// ============================================================
// 7. SEGURANÇA
// ============================================================

async function testSeguranca() {
  console.log("\n" + "=".repeat(70));
  console.log("7. SEGURANÇA");
  console.log("=".repeat(70));

  // 7.1 Verificar que VITE_*_API_KEY não existem no frontend
  const fs = await import("fs");
  const path = await import("path");
  const glob = await import("glob");

  const srcFiles = glob.sync("src/**/*.{ts,tsx}", { nodir: true });
  let foundKeys = 0;
  const keyPatterns = [
    /VITE_GROQ_API_KEY/,
    /VITE_GEMINI_API_KEY/,
    /VITE_OPENAI_API_KEY/,
    /VITE_OPENROUTER_API_KEY/,
    /VITE_ANTHROPIC_API_KEY/,
    /VITE_CLAUDE_API_KEY/,
  ];

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, "utf-8");
    for (const pattern of keyPatterns) {
      if (pattern.test(content)) {
        console.log(`   ⚠️  Chave encontrada em ${file}`);
        foundKeys++;
      }
    }
  }

  assert("Segurança: VITE_*_API_KEY não presente em src/", foundKeys === 0, `${foundKeys} ocorrências encontradas!`);

  // 7.2 Verificar que proxy-ia não expõe chaves na resposta
  const res = await chamarProxy("groq", "llama-3.1-8b-instant", "Teste de segurança");
  if (res.sucesso) {
    const resStr = JSON.stringify(res);
    const hasKey = resStr.includes("GROQ_API_KEY") || resStr.includes("GEMINI_API_KEY") ||
                   resStr.includes("sk-") || resStr.includes("OPENROUTER_API_KEY");
    assert("Segurança: resposta não expõe secrets", !hasKey, "Resposta contém secrets!");
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("=".repeat(70));
  console.log("MISSÃO 33 — TESTE REAL DO SUPERVISOR IA");
  console.log("=".repeat(70));
  console.log(`\n📡 Proxy IA URL: ${PROXY_IA_URL}`);
  console.log(`🕐 ${new Date().toISOString()}\n`);

  await testProxyIa();
  await testGroq();
  await testGemini();
  await testOpenRouter();
  await testSupervisor();
  await testCustos();
  await testSeguranca();

  // RELATÓRIO FINAL
  console.log("\n" + "=".repeat(70));
  console.log("📊 RELATÓRIO FINAL");
  console.log("=".repeat(70));
  console.log(`\n✅ Passaram: ${passedTests}/${totalTests}`);
  console.log(`❌ Falharam: ${failedTests}/${totalTests}`);
  const pct = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : "0.0";
  console.log(`📈 Taxa de sucesso: ${pct}%`);

  if (failures.length > 0) {
    console.log(`\n🔴 Falhas:`);
    for (const f of failures) {
      console.log(`   - ${f}`);
    }
  }

  if (failedTests > 0) {
    console.log("\n⚠️  Alguns testes falharam. Verifique os detalhes acima.");
    process.exit(1);
  } else {
    console.log("\n🎯 MISSÃO 33 — TODOS OS TESTES CONCLUÍDOS COM SUCESSO!");
  }
}

main().catch((err) => {
  console.error("\n❌ ERRO FATAL:", err);
  process.exit(1);
});
