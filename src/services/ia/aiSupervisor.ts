import { supabase } from "@/lib/supabase";
import { aiProviderManager } from "./aiProviderManager";
import { cacheIAService } from "./cacheIAService";

// ============================================================
// TIPOS
// ============================================================

export type Complexidade = "1_economico" | "2_intermediario" | "3_complexo";
export type ModoTenant = "economico" | "balanceado" | "premium";

export interface SupervisorParams {
  tenant_id: string;
  usuario_id?: string;
  tipo_tarefa: string;
  prompt: string;
  contexto?: string;
  prioridade?: "baixa" | "normal" | "alta";
  modo?: ModoTenant;
  robo_id?: string;
  cachear?: boolean;
}

export interface ProviderModel {
  provider: string;
  model: string;
  custo_por_1k_tokens: number;
  velocidade: number;
  qualidade: number;
}

export interface ResultadoSupervisor {
  sucesso: boolean;
  resposta: string;
  provedor: string;
  modelo: string;
  complexidade: Complexidade;
  modo: ModoTenant;
  custo_estimado: number;
  tempo_resposta_ms: number;
  cache_hit: boolean;
  fallback_usado: boolean;
  erro?: string;
}

// ============================================================
// TABELA DE PREÇOS REFERÊNCIA (USD por 1k tokens)
// ============================================================

const TABELA_PRECOS: Record<string, Record<string, number>> = {
  groq: {
    "llama-3.1-8b-instant": 0.00005,
    "llama-3.3-70b-versatile": 0.00059,
  },
  gemini: {
    "gemini-2.0-flash": 0.0001,
    "gemini-2.0-flash-lite": 0.00005,
  },
  openrouter: {
    "openrouter/auto": 0.0005,
    "openai/gpt-4o": 0.005,
    "openai/gpt-4o-mini": 0.00015,
  },
};

// ============================================================
// CLASSIFICAÇÃO DE COMPLEXIDADE
// ============================================================

const PALAVRAS_ECONOMICO = [
  "resumir", "classificar", "extrair", "curto", "simples",
  "traduzir", "corrigir", "formatar", "separar", "listar",
];

const PALAVRAS_INTERMEDIARIO = [
  "atendimento", "responder cliente", "conferir", "analisar os",
  "planejar rota", "verificar", "comparar", "validar",
  "sugerir", "recomendar", "avaliar", "opera",
];

const PALAVRAS_COMPLEXO = [
  "auditar", "decisao", "estrategia", "diagnosticar",
  "investigar", "negociar", "juridico", "contrato",
  "financeiro", "logistica multipla", "otimizar frota",
  "analise de risco", "cenario", "simulacao",
];

function classificarComplexidade(tipo_tarefa: string, prompt: string): Complexidade {
  const texto = `${tipo_tarefa} ${prompt}`.toLowerCase();

  // Verificar palavras complexas primeiro (maior prioridade)
  for (const palavra of PALAVRAS_COMPLEXO) {
    if (texto.includes(palavra)) return "3_complexo";
  }

  // Verificar palavras intermediárias
  for (const palavra of PALAVRAS_INTERMEDIARIO) {
    if (texto.includes(palavra)) return "2_intermediario";
  }

  // Verificar palavras econômicas
  for (const palavra of PALAVRAS_ECONOMICO) {
    if (texto.includes(palavra)) return "1_economico";
  }

  // Padrão: intermediário
  return "2_intermediario";
}

// ============================================================
// SELEÇÃO DE PROVIDER POR MODO + COMPLEXIDADE
// ============================================================

function selecionarProviderPorModo(
  complexidade: Complexidade,
  modo: ModoTenant,
): ProviderModel[] {
  // Ordem de tentativa (primeiro = preferencial)
  const tabela: Record<string, Record<string, ProviderModel[]>> = {
    economico: {
      "1_economico": [
        { provider: "groq", model: "llama-3.1-8b-instant", custo_por_1k_tokens: 0.00005, velocidade: 10, qualidade: 3 },
        { provider: "gemini", model: "gemini-2.0-flash-lite", custo_por_1k_tokens: 0.00005, velocidade: 9, qualidade: 4 },
        { provider: "openrouter", model: "openai/gpt-4o-mini", custo_por_1k_tokens: 0.00015, velocidade: 8, qualidade: 5 },
      ],
      "2_intermediario": [
        { provider: "groq", model: "llama-3.3-70b-versatile", custo_por_1k_tokens: 0.00059, velocidade: 8, qualidade: 6 },
        { provider: "gemini", model: "gemini-2.0-flash", custo_por_1k_tokens: 0.0001, velocidade: 7, qualidade: 8 },
        { provider: "openrouter", model: "openai/gpt-4o-mini", custo_por_1k_tokens: 0.00015, velocidade: 8, qualidade: 5 },
      ],
      "3_complexo": [
        { provider: "gemini", model: "gemini-2.0-flash", custo_por_1k_tokens: 0.0001, velocidade: 7, qualidade: 8 },
        { provider: "openrouter", model: "openai/gpt-4o-mini", custo_por_1k_tokens: 0.00015, velocidade: 8, qualidade: 5 },
        { provider: "groq", model: "llama-3.3-70b-versatile", custo_por_1k_tokens: 0.00059, velocidade: 8, qualidade: 6 },
      ],
    },
    balanceado: {
      "1_economico": [
        { provider: "groq", model: "llama-3.1-8b-instant", custo_por_1k_tokens: 0.00005, velocidade: 10, qualidade: 3 },
        { provider: "gemini", model: "gemini-2.0-flash-lite", custo_por_1k_tokens: 0.00005, velocidade: 9, qualidade: 4 },
        { provider: "openrouter", model: "openrouter/gpt-4o-mini", custo_por_1k_tokens: 0.00015, velocidade: 8, qualidade: 5 },
      ],
      "2_intermediario": [
        { provider: "gemini", model: "gemini-2.0-flash", custo_por_1k_tokens: 0.0001, velocidade: 7, qualidade: 8 },
        { provider: "groq", model: "llama-3.3-70b-versatile", custo_por_1k_tokens: 0.00059, velocidade: 8, qualidade: 6 },
        { provider: "openrouter", model: "openrouter/auto", custo_por_1k_tokens: 0.0005, velocidade: 7, qualidade: 7 },
      ],
      "3_complexo": [
        { provider: "gemini", model: "gemini-2.0-flash", custo_por_1k_tokens: 0.0001, velocidade: 7, qualidade: 8 },
        { provider: "openrouter", model: "openrouter/auto", custo_por_1k_tokens: 0.0005, velocidade: 7, qualidade: 7 },
        { provider: "groq", model: "llama-3.3-70b-versatile", custo_por_1k_tokens: 0.00059, velocidade: 8, qualidade: 6 },
      ],
    },
    premium: {
      "1_economico": [
        { provider: "gemini", model: "gemini-2.0-flash", custo_por_1k_tokens: 0.0001, velocidade: 9, qualidade: 6 },
        { provider: "openrouter", model: "openai/gpt-4o-mini", custo_por_1k_tokens: 0.00015, velocidade: 8, qualidade: 5 },
        { provider: "groq", model: "llama-3.1-8b-instant", custo_por_1k_tokens: 0.00005, velocidade: 10, qualidade: 3 },
      ],
      "2_intermediario": [
        { provider: "gemini", model: "gemini-2.0-flash", custo_por_1k_tokens: 0.0001, velocidade: 7, qualidade: 8 },
        { provider: "openrouter", model: "openai/gpt-4o", custo_por_1k_tokens: 0.005, velocidade: 6, qualidade: 9 },
        { provider: "openrouter", model: "openai/gpt-4o-mini", custo_por_1k_tokens: 0.00015, velocidade: 8, qualidade: 5 },
      ],
      "3_complexo": [
        { provider: "openrouter", model: "openai/gpt-4o", custo_por_1k_tokens: 0.005, velocidade: 6, qualidade: 9 },
        { provider: "openrouter", model: "openai/gpt-4o-mini", custo_por_1k_tokens: 0.00015, velocidade: 8, qualidade: 5 },
        { provider: "gemini", model: "gemini-2.0-flash", custo_por_1k_tokens: 0.0001, velocidade: 7, qualidade: 8 },
      ],
    },
  };

  return tabela[modo]?.[complexidade] || tabela.balanceado["2_intermediario"];
}

// ============================================================
// REGISTRO DE CUSTO
// ============================================================

async function registrarCusto(params: {
  tenant_id: string;
  usuario_id?: string;
  provedor: string;
  modelo: string;
  tipo_tarefa: string;
  complexidade: Complexidade;
  modo: ModoTenant;
  tokens_entrada: number;
  tokens_saida: number;
  custo_estimado: number;
  tempo_resposta_ms: number;
  status: "sucesso" | "falha" | "fallback" | "cache";
  erro_resumido?: string;
}): Promise<void> {
  try {
    await supabase.from("ia_custos_ia").insert([{
      tenant_id: params.tenant_id,
      usuario_id: params.usuario_id || null,
      provedor: params.provedor,
      modelo: params.modelo,
      tipo_tarefa: params.tipo_tarefa,
      complexidade: params.complexidade,
      modo_tenant: params.modo,
      tokens_entrada: params.tokens_entrada,
      tokens_saida: params.tokens_saida,
      custo_estimado: params.custo_estimado,
      tempo_resposta_ms: params.tempo_resposta_ms,
      status: params.status,
      erro_resumido: params.erro_resumido ? params.erro_resumido.substring(0, 500) : null,
    }]);
  } catch (e) {
    console.warn("[aiSupervisor] Erro ao registrar custo:", e);
  }
}

// ============================================================
// CARREGAR CONFIG DO TENANT
// ============================================================

async function carregarModoTenant(tenant_id: string): Promise<ModoTenant> {
  try {
    const { data } = await supabase
      .from("ia_config_tenant")
      .select("modo")
      .eq("tenant_id", tenant_id)
      .single();
    if (data?.modo) return data.modo as ModoTenant;
  } catch { /* padrão */ }
  return "balanceado";
}

// ============================================================
// SUPERVISOR — EXECUTAR
// ============================================================

export const aiSupervisor = {
  async executar(params: SupervisorParams): Promise<ResultadoSupervisor> {
    const inicio = Date.now();
    const {
      tenant_id,
      usuario_id,
      tipo_tarefa,
      prompt,
      contexto = "",
      prioridade = "normal",
      modo: modoOverride,
      robo_id,
      cachear = true,
    } = params;

    // 1. Classificar complexidade
    const complexidade = classificarComplexidade(tipo_tarefa, prompt);

    // 2. Obter modo do tenant (ou override)
    const modo = modoOverride || await carregarModoTenant(tenant_id);

    // 3. Verificar cache (se ativo)
    if (cachear) {
      const cacheHit = cacheIAService.obter(prompt, contexto, tenant_id, tipo_tarefa);
      if (cacheHit !== null) {
        void registrarCusto({
          tenant_id,
          usuario_id,
          provedor: "cache",
          modelo: "cache",
          tipo_tarefa,
          complexidade,
          modo,
          tokens_entrada: 0,
          tokens_saida: 0,
          custo_estimado: 0,
          tempo_resposta_ms: Date.now() - inicio,
          status: "cache",
        });
        return {
          sucesso: true,
          resposta: cacheHit,
          provedor: "cache",
          modelo: "cache",
          complexidade,
          modo,
          custo_estimado: 0,
          tempo_resposta_ms: Date.now() - inicio,
          cache_hit: true,
          fallback_usado: false,
        };
      }
    }

    // 4. Selecionar providers por modo + complexidade
    const providers = selecionarProviderPorModo(complexidade, modo);

    // 5. Tentar cada provider em ordem (fallback automático)
    let ultimoErro: string | undefined;
    for (const pm of providers) {
      try {
        const providerConfig = {
          id: "",
          provider: pm.provider,
          model: pm.model,
          ativo: true,
          prioridade: 1,
          setor: "supervisor",
          temperatura: prioridade === "alta" ? 0.3 : 0.7,
          max_tokens: complexidade === "1_economico" ? 512 : complexidade === "2_intermediario" ? 1024 : 2048,
          is_default: false,
          metadata: {},
        };

        const resposta = await aiProviderManager.gerarResposta(providerConfig, prompt, contexto);

        const tempo = Date.now() - inicio;
        const tokensEstimados = Math.ceil(prompt.length / 4) + Math.ceil(resposta.length / 4);
        const custo = (tokensEstimados / 1000) * pm.custo_por_1k_tokens;

        // Armazenar no cache
        if (cachear) {
          cacheIAService.armazenar(prompt, contexto, tenant_id, tipo_tarefa, resposta, pm.provider, pm.model);
        }

        // Registrar custo
        void registrarCusto({
          tenant_id,
          usuario_id,
          provedor: pm.provider,
          modelo: pm.model,
          tipo_tarefa,
          complexidade,
          modo,
          tokens_entrada: Math.ceil(prompt.length / 4),
          tokens_saida: Math.ceil(resposta.length / 4),
          custo_estimado: custo,
          tempo_resposta_ms: tempo,
          status: "sucesso",
        });

        // Log via aiProviderManager
        void aiProviderManager.registrarLogIA(
          pm.provider, pm.model, "supervisor",
          prompt, resposta, tokensEstimados, true,
        );

        return {
          sucesso: true,
          resposta,
          provedor: pm.provider,
          modelo: pm.model,
          complexidade,
          modo,
          custo_estimado: custo,
          tempo_resposta_ms: tempo,
          cache_hit: false,
          fallback_usado: false,
        };
      } catch (e: any) {
        ultimoErro = e.message || "Erro desconhecido";
        console.warn(`[aiSupervisor] ${pm.provider}/${pm.model} falhou: ${ultimoErro}. Tentando próximo...`);

        // Registrar falha
        void registrarCusto({
          tenant_id,
          usuario_id,
          provedor: pm.provider,
          modelo: pm.model,
          tipo_tarefa,
          complexidade,
          modo,
          tokens_entrada: Math.ceil(prompt.length / 4),
          tokens_saida: 0,
          custo_estimado: 0,
          tempo_resposta_ms: Date.now() - inicio,
          status: "falha",
          erro_resumido: ultimoErro,
        });

        void aiProviderManager.registrarLogIA(
          pm.provider, pm.model, "supervisor_fallback",
          prompt, "", 0, false, ultimoErro,
        );
      }
    }

    // 6. Todos falharam
    const tempo = Date.now() - inicio;
    void registrarCusto({
      tenant_id,
      usuario_id,
      provedor: "nenhum",
      modelo: "nenhum",
      tipo_tarefa,
      complexidade,
      modo,
      tokens_entrada: 0,
      tokens_saida: 0,
      custo_estimado: 0,
      tempo_resposta_ms: tempo,
      status: "falha",
      erro_resumido: "Todos os provedores falharam",
    });

    return {
      sucesso: false,
      resposta: "Não foi possível processar sua solicitação no momento. Tente novamente mais tarde.",
      provedor: "nenhum",
      modelo: "nenhum",
      complexidade,
      modo,
      custo_estimado: 0,
      tempo_resposta_ms: tempo,
      cache_hit: false,
      fallback_usado: true,
      erro: ultimoErro,
    };
  },

  // Método auxiliar para classificar sem executar
  classificar(tipo_tarefa: string, prompt: string): Complexidade {
    return classificarComplexidade(tipo_tarefa, prompt);
  },

  // Obter tabela de providers para um modo
  obterProviders(modo: ModoTenant, complexidade: Complexidade): ProviderModel[] {
    return selecionarProviderPorModo(complexidade, modo);
  },

  // Registrar custo manualmente (para integrações externas)
  async registrarCustoManual(params: {
    tenant_id: string;
    usuario_id?: string;
    provedor: string;
    modelo: string;
    tipo_tarefa: string;
    complexidade: Complexidade;
    modo: ModoTenant;
    tokens_entrada: number;
    tokens_saida: number;
    custo_estimado: number;
    tempo_resposta_ms: number;
    status: "sucesso" | "falha" | "fallback" | "cache";
    erro_resumido?: string;
  }): Promise<void> {
    return registrarCusto(params);
  },
};

export default aiSupervisor;
