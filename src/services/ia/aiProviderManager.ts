import { supabase } from "@/lib/supabase";
import { proxyIaClient } from "./proxyIaClient";

export interface AIProviderConfig {
  id: string;
  provider: string; // 'groq', 'gemini', 'openrouter', 'openai'
  model: string;
  ativo: boolean;
  prioridade: number;
  setor: string;
  temperatura: number;
  max_tokens: number;
  is_default: boolean;
  metadata: any;
}

export const aiProviderManager = {
  // Chaves agora ficam no backend (proxy-ia Edge Function)
  // Este método retorna placeholder — o proxy-ia no backend tem as chaves reais
  getKeys() {
    return {
      groq: "proxy-ia",
      gemini: "proxy-ia",
      openrouter: "proxy-ia",
      openai: "proxy-ia",
    };
  },

  async listarProviders(): Promise<AIProviderConfig[]> {
    const { data, error } = await supabase
      .from('ia_providers_config')
      .select('*')
      .order('prioridade', { ascending: true });
    
    if (error) {
      console.error("Erro ao listar providers:", error);
      return [];
    }
    return data || [];
  },

  async atualizarProvider(id: string, updates: Partial<AIProviderConfig>): Promise<boolean> {
    const { error } = await supabase
      .from('ia_providers_config')
      .update(updates)
      .eq('id', id);
    if (error) {
      console.error("Erro ao atualizar provider:", error);
      return false;
    }
    return true;
  },

  async ensureDefaultProviders(): Promise<void> {
    const defaults: Omit<AIProviderConfig, 'id'>[] = [
      { provider: 'groq', model: 'llama-3.1-8b-instant', ativo: true, prioridade: 1, setor: 'Geral', temperatura: 0.7, max_tokens: 1024, is_default: true, metadata: {} },
      { provider: 'gemini', model: 'gemini-1.5-pro', ativo: true, prioridade: 2, setor: 'Geral', temperatura: 0.7, max_tokens: 1024, is_default: false, metadata: {} },
      { provider: 'openrouter', model: 'openrouter/auto', ativo: true, prioridade: 3, setor: 'Geral', temperatura: 0.7, max_tokens: 1024, is_default: false, metadata: {} },
      { provider: 'openrouter', model: 'openai/gpt-4o', ativo: true, prioridade: 4, setor: 'Geral', temperatura: 0.7, max_tokens: 1024, is_default: false, metadata: {} },
    ];

    const providerNames = defaults.map((item) => item.provider);
    const { data: existing, error } = await supabase
      .from('ia_providers_config')
      .select('id, provider, model')
      .in('provider', providerNames);

    if (error) {
      console.error('Erro ao inicializar providers padrão:', error);
      return;
    }

    const chavesExistentes = new Set(
      (existing || []).map((item) => `${item.provider}::${item.model}`)
    );

    for (const prov of defaults) {
      const chave = `${prov.provider}::${prov.model}`;
      if (!chavesExistentes.has(chave)) {
        const { error: insertError } = await supabase
          .from('ia_providers_config')
          .insert([prov]);
        if (insertError) {
          console.error(`Erro ao inserir provider padrão ${prov.provider}/${prov.model}:`, insertError);
        }
      }
    }
  },

  async testarProvider(provider: AIProviderConfig): Promise<{ success: boolean; message: string }> {
    try {
      const resultado = await proxyIaClient.executar({
        provider: provider.provider,
        model: provider.model,
        prompt: "Ping",
        max_tokens: 10,
      });

      if (resultado.sucesso) {
        await this.registrarLogIA(provider.provider, provider.model, 'test', "Ping", resultado.resposta, 10, true);
        return { success: true, message: "Conexão bem sucedida via proxy-ia!" };
      }
      await this.registrarLogIA(provider.provider, provider.model, 'test', "Ping", "", 0, false, resultado.erro);
      return { success: false, message: resultado.erro || "Erro na conexão via proxy-ia" };
    } catch (e: any) {
      await this.registrarLogIA(provider.provider, provider.model, 'test', "Ping", "", 0, false, e.message);
      return { success: false, message: e.message || "Erro na conexão" };
    }
  },

  async gerarResposta(provider: AIProviderConfig, prompt: string, context: string = ""): Promise<string> {
    const resultado = await proxyIaClient.executar({
      provider: provider.provider,
      model: provider.model,
      prompt,
      context,
      temperature: provider.temperatura,
      max_tokens: provider.max_tokens,
    });

    if (!resultado.sucesso) {
      throw new Error(resultado.erro || `Provedor ${provider.provider} falhou via proxy-ia`);
    }

    await this.registrarLogIA(provider.provider, provider.model, 'generate', prompt, resultado.resposta, resultado.tokens_saida, true);
    return resultado.resposta;
  },

  async gerarRespostaComFallback(prompt: string, context: string = "", roboId?: string): Promise<string> {
    let providers = await this.listarProviders();
    let actives = providers.filter(p => p.ativo);

    // Se roboId fornecido, tenta ordenar pelo config.llm do robô
    if (roboId) {
      const { data: robo } = await supabase
        .from("automacoes_robos")
        .select("config")
        .eq("id", roboId)
        .single();
      if (robo?.config?.llm) {
        const llm = robo.config.llm as Record<string, string>;
        const ordemNome: string[] = [];
        if (llm.modelo_principal) ordemNome.push(llm.modelo_principal);
        if (llm.modelo_secundario) ordemNome.push(llm.modelo_secundario);
        if (llm.fallback) ordemNome.push(llm.fallback);
        actives.sort((a, b) => {
          const ai = ordemNome.indexOf(`${a.provider}-${a.model}`);
          const bi = ordemNome.indexOf(`${b.provider}-${b.model}`);
          if (ai !== -1 && bi !== -1) return ai - bi;
          if (ai !== -1) return -1;
          if (bi !== -1) return 1;
          return a.prioridade - b.prioridade;
        });
      }
    } else {
      actives.sort((a, b) => a.prioridade - b.prioridade);
    }

    for (const provider of actives) {
      try {
        const resposta = await this.gerarResposta(provider, prompt, context);
        return resposta;
      } catch (e: any) {
        console.warn(`Fallback: Provedor ${provider.provider} falhou. Tentando próximo...`, e);
        await this.registrarLogIA(provider.provider, provider.model, 'generate', prompt, "", 0, false, e.message);
      }
    }
    return "Não foi possível gerar a resposta. Todos os provedores falharam ou não estão configurados com chave API.";
  },

  async classificarMensagem(mensagem: string, contexto: string = ""): Promise<{intencao: string, confianca: number, precisa_humano: boolean}> {
    const prompt = `Classifique a seguinte mensagem em uma das categorias: 'Dúvida', 'Reclamação', 'Orçamento', 'Rastreio', 'Operacional', 'Problema Crítico'. 
    Regra: Se for problema jurídico, avaria, acidente, negociação de valor, ou muito agressivo, defina precisa_humano como true.
    Retorne APENAS UM JSON no formato: {"intencao": "Categoria", "confianca": 95, "precisa_humano": true/false}.
    Mensagem: ${mensagem}`;
    
    try {
      const resp = await this.gerarRespostaComFallback(prompt, contexto);
      // Extrair o JSON da string (pode vir com markdown ```json)
      const match = resp.match(/\{[\s\S]*\}/);
      if (match) {
        const json = JSON.parse(match[0]);
        // registrar no log
        await this.registrarLogIA_v2("multi", "llama/gemini", "classificacao", prompt, resp, 50, true, "", {
          intencao: json.intencao, confianca: json.confianca, precisa_humano: json.precisa_humano
        });
        return json;
      }
      return { intencao: "Desconhecido", confianca: 50, precisa_humano: true };
    } catch (e) {
      return { intencao: "Erro", confianca: 0, precisa_humano: true };
    }
  },

  async resumirConversa(historico: string): Promise<string> {
    return this.gerarRespostaComFallback(`Resuma a seguinte conversa e extraia os pontos principais:\n${historico}`);
  },

  async sugerirResposta(mensagem: string, contexto: string = ""): Promise<string> {
    return this.gerarRespostaComFallback(`Sugira uma resposta amigável, clara e curta, estilo corporativo logístico, para a seguinte mensagem:\n${mensagem}`, contexto);
  },
  
  async detectarUrgencia(mensagem: string): Promise<boolean> {
    const prompt = `Responda apenas com 'SIM' ou 'NAO'. A seguinte mensagem é urgente (acidente, atraso crítico, avaria grave, problema jurídico)? Mensagem: ${mensagem}`;
    const resp = await this.gerarRespostaComFallback(prompt);
    return resp.toUpperCase().includes('SIM');
  },

  async registrarLogIA(provider: string, model: string, action: string, prompt: string, response: string, tokens: number, success: boolean, errorMsg: string = "") {
    return this.registrarLogIA_v2(provider, model, action, prompt, response, tokens, success, errorMsg, {});
  },

  async registrarLogIA_v2(
    provider: string, model: string, action: string, prompt: string, response: string, 
    tokens: number, success: boolean, errorMsg: string = "", extra: any = {}
  ) {
    try {
      await supabase.from('ia_logs').insert([{
        provider,
        model,
        action,
        modulo: action,
        prompt: prompt.substring(0, 2000), // legacy column
        response: response.substring(0, 2000), // legacy column
        entrada: prompt.substring(0, 2000),
        saida: response.substring(0, 2000),
        tokens_used: tokens,
        success,
        status: success ? 'success' : 'error',
        error_message: errorMsg,
        erro: errorMsg,
        intencao: extra.intencao || null,
        confianca: extra.confianca || null,
        precisa_humano: extra.precisa_humano || false
      }]);
    } catch (e) {
      console.error("Erro ao registrar log da IA:", e);
    }
  }
};
