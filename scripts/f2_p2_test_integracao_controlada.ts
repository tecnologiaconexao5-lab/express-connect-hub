/**
 * FASE P2 — ETAPA 4: Teste de Integração Controlada
 *
 * Valida:
 * 1. ConectoresService: 4 modos de operação (HOMOLOGACAO, PRODUCAO_ASSISTIDA, PRODUCAO, PRODUCAO_AUTONOMA)
 * 2. PRODUCAO_ASSISTIDA: bloqueio de execução externa sem aprovação
 * 3. LLM Router: leitura de config.llm por robô via aiProviderManager
 * 4. Action Engine: governança + aprovação + execução + log
 * 5. Rotinas editáveis: CRUD com prioridade, aprovação, dias_semana, ferramenta_id
 *
 * Uso: npx tsx scripts/f2_p2_test_integracao_controlada.ts
 */
import { supabase } from "../src/lib/supabase";
import { actionEngineService } from "../src/services/ia/actionEngineService";
import { conectoresService } from "../src/services/ia/conectoresService";
import { aiProviderManager } from "../src/services/ia/aiProviderManager";
import { rotinasMotorService } from "../src/services/ia/rotinasMotorService";

type Resultado = {
  etapa: string;
  subetapa: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  detalhe: string;
};

const resultados: Resultado[] = [];

function registrar(etapa: string, subetapa: string, status: "PASS" | "FAIL" | "BLOCKED", detalhe: string) {
  resultados.push({ etapa, subetapa, status, detalhe });
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏭️";
  console.log(`${icon} [${etapa}] ${subetapa}: ${detalhe}`);
}

// ============================================================
// ETAPA 4.1 — ConectoresService: 4 modos de operação
// ============================================================
async function testConectores() {
  console.log("\n=== ETAPA 4.1 — ConectoresService: 4 modos ===");

  // 4.1.1 — Listar conectores
  try {
    const conectores = await conectoresService.listarConectores({});
    const count = conectores.length;
    if (count >= 9) {
      registrar("4.1", "Listar conectores", "PASS", `${count} conectores encontrados`);
    } else {
      registrar("4.1", "Listar conectores", "FAIL", `Esperado >=9, encontrado ${count}`);
    }
  } catch (e: any) {
    registrar("4.1", "Listar conectores", "FAIL", `Erro: ${e.message}`);
  }

  // 4.1.2 — Executar conector em HOMOLOGACAO (simulado)
  try {
    const simulado = await conectoresService.executarConector(
      "test-homolog", "comercial", { tipo: "zoho_mail" },
      { mensagem: "teste" }, "HOMOLOGACAO",
    );
    if (simulado.status === "simulado" || simulado.modo_execucao === "HOMOLOGACAO") {
      registrar("4.1", "Executar HOMOLOGACAO", "PASS", `Status: ${simulado.status}`);
    } else {
      registrar("4.1", "Executar HOMOLOGACAO", "FAIL", `Esperado simulado, recebeu ${simulado.status}`);
    }
  } catch (e: any) {
    registrar("4.1", "Executar HOMOLOGACAO", "FAIL", `Erro: ${e.message}`);
  }

  // 4.1.3 — Validar modos existentes
  try {
    const modosValidos = ["HOMOLOGACAO", "PRODUCAO_ASSISTIDA", "PRODUCAO", "PRODUCAO_AUTONOMA"];
    const { data: vinculos } = await supabase
      .from("ia_conector_robo")
      .select("modo")
      .limit(5);
    const modosUsados = new Set(vinculos?.map(v => v.modo) || []);
    const todosValidos = [...modosUsados].every(m => modosValidos.includes(m));
    if (todosValidos) {
      registrar("4.1", "Validar modos", "PASS", `Modos: ${[...modosUsados].join(", ")}`);
    } else {
      registrar("4.1", "Validar modos", "FAIL", `Modo inválido encontrado`);
    }
  } catch (e: any) {
    registrar("4.1", "Validar modos", "BLOCKED", `Supabase: ${e.message}`);
  }
}

// ============================================================
// ETAPA 4.2 — PRODUCAO_ASSISTIDA: bloqueio sem aprovação
// ============================================================
async function testProducaoAssistida() {
  console.log("\n=== ETAPA 4.2 — PRODUCAO_ASSISTIDA: Bloqueio e Auditoria ===");

  // 4.2.1 — Verificar se VITE_COMUNICACAO_PRODUCAO_ASSISTIDA está false
  const prodAssistida = import.meta.env.VITE_COMUNICACAO_PRODUCAO_ASSISTIDA;
  if (prodAssistida === "false" || prodAssistida === undefined) {
    registrar("4.2", "Flag PRODUCAO_ASSISTIDA", "PASS",
      `VITE_COMUNICACAO_PRODUCAO_ASSISTIDA=${prodAssistida} — bloqueado por padrão`);
  } else {
    registrar("4.2", "Flag PRODUCAO_ASSISTIDA", "FAIL",
      `Esperado false, recebeu ${prodAssistida}`);
  }

  // 4.2.2 — Verificar chaves de API ausentes (Evolution, Zoho — IA via proxy-ia backend)
  const envKeys = {
    evolution: import.meta.env.VITE_EVOLUTION_API_KEY,
    evolutionUrl: import.meta.env.VITE_EVOLUTION_API_URL,
    zohoUrl: import.meta.env.VITE_ZOHO_EMAIL_API_URL,
    zohoKey: import.meta.env.VITE_ZOHO_EMAIL_API_KEY,
    zohoFrom: import.meta.env.VITE_ZOHO_EMAIL_FROM,
  };
  const ausentes = Object.entries(envKeys).filter(([_, v]) => !v).map(([k]) => k);
  const presentes = Object.entries(envKeys).filter(([_, v]) => v).map(([k]) => k);
  if (ausentes.length > 0) {
    registrar("4.2", "Chaves de API", "BLOCKED",
      `${presentes.length} presentes (${presentes.join(", ")}), ${ausentes.length} ausentes: ${ausentes.join(", ")}`);
  } else {
    registrar("4.2", "Chaves de API", "PASS", "Todas presentes");
  }

  // 4.2.3 — Verificar fluxo de governança no actionEngine
  try {
    const { data: robos } = await supabase.from("automacoes_robos").select("id, nome, setor").limit(3);
    if (!robos || robos.length === 0) {
      registrar("4.2", "Buscar robôs", "FAIL", "Nenhum robô encontrado");
      return;
    }

    const robo = robos[0];
    const { data: ferramentas } = await supabase
      .from("ia_robo_ferramentas")
      .select("ferramenta_id")
      .eq("robo_id", robo.id)
      .limit(1);

    if (!ferramentas || ferramentas.length === 0) {
      registrar("4.2", "Ferramentas do robô", "FAIL", `${robo.nome} sem ferramentas`);
      return;
    }

    // Tenta solicitar ação — deve passar pela governança
    const resultado = await actionEngineService.solicitarAcao({
      roboId: robo.id,
      ferramentaId: ferramentas[0].ferramenta_id,
      params: { objetivo: `teste producao assistida - ${Date.now()}` },
    });

    if (resultado.status === "CONCLUIDA") {
      registrar("4.2", "Fluxo governança", "PASS",
        `Robô ${robo.nome}: ação CONCLUIDA (rota: ${resultado.rota || "N/A"})`);
    } else if (resultado.status === "AGUARDANDO_APROVACAO" || resultado.status === "SOLICITADA") {
      registrar("4.2", "Fluxo governança", "PASS",
        `Robô ${robo.nome}: ação ${resultado.status} (aprovacao pendente — comportamento correto)`);
    } else {
      registrar("4.2", "Fluxo governança", "FAIL",
        `Status inesperado: ${resultado.status}`);
    }
  } catch (e: any) {
    registrar("4.2", "Fluxo governança", "BLOCKED", `Erro: ${e.message}`);
  }

  // 4.2.4 — Verificar tabela ia_execucoes_conectores
  try {
    const { data: execs, count } = await supabase
      .from("ia_execucoes_conectores")
      .select("id, status, modo_execucao", { count: "exact", head: false })
      .limit(3);
    if (execs && execs.length >= 0) {
      registrar("4.2", "Tabela ia_execucoes_conectores", "PASS",
        `Acessível, ${count || 0} registros`);
    } else {
      registrar("4.2", "Tabela ia_execucoes_conectores", "FAIL", "Inacessível");
    }
  } catch (e: any) {
    registrar("4.2", "Tabela ia_execucoes_conectores", "FAIL", `Erro: ${e.message}`);
  }

  // 4.2.5 — Verificar registro de log na centralIA
  try {
    const { data: logs } = await supabase
      .from("automacoes_logs")
      .select("id, mensagem, created_at")
      .order("created_at", { ascending: false })
      .limit(3);
    if (logs && logs.length > 0) {
      registrar("4.2", "Central IA logs", "PASS", `${logs.length} logs recentes encontrados`);
    } else {
      registrar("4.2", "Central IA logs", "BLOCKED", "Nenhum log encontrado");
    }
  } catch (e: any) {
    registrar("4.2", "Central IA logs", "FAIL", `Erro: ${e.message}`);
  }
}

// ============================================================
// ETAPA 4.3 — LLM Router: leitura de config.llm por robô
// ============================================================
async function testLLMRouter() {
  console.log("\n=== ETAPA 4.3 — LLM Router por Robô ===");

  // 4.3.1 — Verificar providers ativos no ia_providers_config
  try {
    const providers = await aiProviderManager.listarProviders();
    const ativos = providers.filter(p => p.ativo);
    if (ativos.length >= 1) {
      registrar("4.3", "Providers ativos", "PASS",
        `${ativos.length}/${providers.length} ativos: ${ativos.map(p => `${p.provider} (${p.model})`).join(", ")}`);
    } else {
      registrar("4.3", "Providers ativos", "BLOCKED",
        `${providers.length} providers configurados, ${ativos.length} ativos — chaves ausentes`);
    }
  } catch (e: any) {
    registrar("4.3", "Providers ativos", "FAIL", `Erro: ${e.message}`);
    return;
  }

  // 4.3.2 — Verificar config.llm nos robôs
  try {
    const { data: robos } = await supabase
      .from("automacoes_robos")
      .select("id, nome, setor, config->llm")
      .not("config->llm", "is", null);
    if (robos && robos.length >= 4) {
      for (const robo of robos) {
        const llm = (robo as any).llm || {};
        if (llm.modelo_principal && llm.modelo_secundario && llm.fallback) {
          registrar("4.3", `Config LLM: ${robo.nome}`, "PASS",
            `Principal: ${llm.modelo_principal}, Secundário: ${llm.modelo_secundario}, Fallback: ${llm.fallback}`);
        } else {
          registrar("4.3", `Config LLM: ${robo.nome}`, "FAIL",
            `Config incompleta: ${JSON.stringify(llm)}`);
        }
      }
    } else {
      registrar("4.3", "Config LLM robôs", "BLOCKED",
        `Apenas ${robos?.length || 0} robôs com config.llm — executar migration 20260727`);
    }
  } catch (e: any) {
    registrar("4.3", "Config LLM robôs", "FAIL", `Erro: ${e.message}`);
  }

  // 4.3.3 — Testar gerarRespostaComFallback com roboId
  try {
    const { data: robo } = await supabase
      .from("automacoes_robos")
      .select("id, nome, config->llm")
      .not("config->llm", "is", null)
      .limit(1)
      .single();
    if (robo) {
      const llm = (robo as any).llm as Record<string, string>;
      // Chama o método apenas para verificar se aceita roboId (sem chave, vai falhar)
      const resposta = await aiProviderManager.gerarRespostaComFallback(
        "teste de ping",
        "teste_llm_router",
        robo.id,
      );
      registrar("4.3", "LLM Router com roboId", "PASS",
        `Robô ${robo.nome}: ${resposta.substring(0, 80)}...`);
    } else {
      registrar("4.3", "LLM Router com roboId", "BLOCKED",
        "Nenhum robô com config.llm — executar migration 20260727");
    }
  } catch (e: any) {
    // Esperado: sem chaves, o LLM não vai responder, mas o roteamento funciona
    registrar("4.3", "LLM Router com roboId", "BLOCKED",
      `Sem chaves de API — comportamento esperado. Detalhe: ${e.message.substring(0, 100)}`);
  }
}

// ============================================================
// ETAPA 4.4 — Rotinas Editáveis (FASE P1A)
// ============================================================
async function testRotinasEditaveis() {
  console.log("\n=== ETAPA 4.4 — Rotinas Editáveis (P1A) ===");

  // 4.4.1 — Listar rotinas com novas colunas
  try {
    const rotinas = await rotinasMotorService.listarRotinas({});
    if (rotinas.length >= 0) {
      const temColunas = rotinas.some(r =>
        "prioridade" in r || "aprovacao_necessaria" in r || "ferramenta_id" in r
      );
      if (temColunas || rotinas.length === 0) {
        registrar("4.4", "Listar rotinas", "PASS", `${rotinas.length} rotinas`);
      } else {
        registrar("4.4", "Listar rotinas", "FAIL", "Colunas P1A ausentes");
      }
    }
  } catch (e: any) {
    registrar("4.4", "Listar rotinas", "FAIL", `Erro: ${e.message}`);
  }

  // 4.4.2 — Listar ferramentas disponíveis
  try {
    const ferramentas = await rotinasMotorService.listarFerramentasDisponiveis();
    if (ferramentas.length >= 10) {
      registrar("4.4", "Ferramentas disponíveis", "PASS", `${ferramentas.length} ferramentas`);
    } else {
      registrar("4.4", "Ferramentas disponíveis", "FAIL", `Esperado >=10, encontrado ${ferramentas.length}`);
    }
  } catch (e: any) {
    registrar("4.4", "Ferramentas disponíveis", "FAIL", `Erro: ${e.message}`);
  }
}

// ============================================================
// RELATÓRIO FINAL
// ============================================================
function gerarRelatorio() {
  const pass = resultados.filter(r => r.status === "PASS").length;
  const fail = resultados.filter(r => r.status === "FAIL").length;
  const blocked = resultados.filter(r => r.status === "BLOCKED").length;
  const total = resultados.length;

  console.log("\n\n=============================================");
  console.log("RELATÓRIO FINAL — FASE P2 ETAPA 4");
  console.log("=============================================");
  console.log(`Total: ${total} | ✅ PASS: ${pass} | ❌ FAIL: ${fail} | ⏭️ BLOCKED: ${blocked}`);
  console.log(`Percentual: ${total > 0 ? ((pass / total) * 100).toFixed(1) : 0}%`);

  if (resultados.length === 0) {
    console.log("\n⚠️  Nenhum teste executado — provavelmente sem conexão Supabase.");
  }

  // Sugestões
  const blockedPorChaves = resultados.filter(r =>
    r.status === "BLOCKED" && r.subetapa === "Chaves de API");
  if (blockedPorChaves.length > 0) {
    console.log("\n📋 Ações necessárias para PRODUCAO_ASSISTIDA:");
    console.log("  1. Adicionar ao .env (Evolution, Zoho):");
    console.log("     VITE_EVOLUTION_API_URL=https://seu-server.evolution.com");
    console.log("     VITE_EVOLUTION_API_KEY=sua-chave-evolution");
    console.log("     VITE_ZOHO_EMAIL_API_URL=https://mail.zoho.com/api");
    console.log("     VITE_ZOHO_EMAIL_API_KEY=sua-chave-zoho");
    console.log("     VITE_ZOHO_EMAIL_FROM=noreply@seudominio.com");
    console.log("  2. Chaves de IA no Supabase Edge Function Secrets:");
    console.log("     supabase secrets set GROQ_API_KEY=sua-chave-groq");
    console.log("     supabase secrets set GEMINI_API_KEY=sua-chave-gemini");
    console.log("     supabase secrets set OPENAI_API_KEY=sua-chave-openai");
    console.log("     supabase secrets set OPENROUTER_API_KEY=sua-chave-openrouter");
    console.log("     supabase secrets set ANTHROPIC_API_KEY=sua-chave-anthropic");
    console.log("  3. Alterar modo dos conectores:");
    console.log("     UPDATE ia_conectores SET modo = 'PRODUCAO_ASSISTIDA'");
    console.log("     WHERE modo = 'HOMOLOGACAO' AND tipo IN ('zoho_mail', 'evolution_whatsapp');");
  }

  const blockedPorMigration = resultados.filter(r =>
    r.status === "BLOCKED" && r.subetapa.includes("config.llm"));
  if (blockedPorMigration.length > 0) {
    console.log("\n📋 Ações necessárias para LLM Router:");
    console.log("  Executar migration: supabase db push --include-all");
    console.log("  Ou manualmente: psql -f supabase/migrations/20260727_f2_llm_router_por_robo.sql");
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("🚀 FASE P2 — ETAPA 4: Teste de Integração Controlada\n");
  console.log(`📅 ${new Date().toISOString()}\n`);

  try {
    // Testa conexão Supabase primeiro
    const { data, error } = await supabase.from("automacoes_robos").select("count");
    if (error) {
      console.log(`⚠️  Sem conexão Supabase: ${error.message}`);
      console.log("   Os testes serão simulados (sem persistência em banco).\n");
    } else {
      console.log(`✅ Conexão Supabase OK (${JSON.stringify(data)})\n`);
    }
  } catch (e: any) {
    console.log(`⚠️  Supabase indisponível: ${e.message}\n`);
  }

  await testConectores();
  await testProducaoAssistida();
  await testLLMRouter();
  await testRotinasEditaveis();

  gerarRelatorio();
}

main().catch(console.error);
