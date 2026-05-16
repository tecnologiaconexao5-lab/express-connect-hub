import { supabase } from "@/lib/supabase";

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
  // Pega chaves do env
  getKeys() {
    return {
      groq: import.meta.env.VITE_GROQ_API_KEY || null,
      gemini: import.meta.env.VITE_GEMINI_API_KEY || null,
      openrouter: import.meta.env.VITE_OPENROUTER_API_KEY || null,
      openai: import.meta.env.VITE_OPENAI_API_KEY || null,
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

  async testarProvider(provider: AIProviderConfig): Promise<{ success: boolean; message: string }> {
    const keys = this.getKeys();
    const key = keys[provider.provider as keyof typeof keys];
    
    if (!key) {
      return { success: false, message: "Chave não configurada no .env" };
    }

    try {
      let result = "";
      if (provider.provider === 'groq') result = await this.testGroq(key, provider.model);
      else if (provider.provider === 'gemini') result = await this.testGemini(key, provider.model);
      else if (provider.provider === 'openrouter') result = await this.testOpenRouter(key, provider.model);
      else if (provider.provider === 'openai') result = await this.testOpenAI(key, provider.model);
      
      await this.registrarLogIA(provider.provider, provider.model, 'test', "Ping", result, 10, true);
      return { success: true, message: "Conexão bem sucedida!" };
    } catch (e: any) {
      await this.registrarLogIA(provider.provider, provider.model, 'test', "Ping", "", 0, false, e.message);
      return { success: false, message: e.message || "Erro na conexão" };
    }
  },

  async testGroq(key: string, model: string) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Ping" }], max_tokens: 10 })
    });
    if (!res.ok) throw new Error(`Groq HTTP error! status: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "Pong";
  },

  async testGemini(key: string, model: string) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Ping" }] }] })
    });
    if (!res.ok) throw new Error(`Gemini HTTP error! status: ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Pong";
  },

  async testOpenRouter(key: string, model: string) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${key}`, 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Ping" }], max_tokens: 10 })
    });
    if (!res.ok) throw new Error(`OpenRouter HTTP error! status: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "Pong";
  },

  async testOpenAI(key: string, model: string) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Ping" }], max_tokens: 10 })
    });
    if (!res.ok) throw new Error(`OpenAI HTTP error! status: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "Pong";
  },

  async gerarResposta(provider: AIProviderConfig, prompt: string, context: string = ""): Promise<string> {
    const keys = this.getKeys();
    const key = keys[provider.provider as keyof typeof keys];
    
    if (!key) throw new Error("Chave não configurada");

    const fullPrompt = context ? `Contexto:\n${context}\n\nPrompt:\n${prompt}` : prompt;

    let result = "";
    if (provider.provider === 'groq') {
       const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
         method: "POST",
         headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
         body: JSON.stringify({ model: provider.model, messages: [{ role: "user", content: fullPrompt }], temperature: provider.temperatura, max_tokens: provider.max_tokens })
       });
       if (!res.ok) throw new Error("Erro Groq");
       const data = await res.json();
       result = data.choices[0].message.content;
    } else if (provider.provider === 'gemini') {
       const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${key}`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
       });
       if (!res.ok) throw new Error("Erro Gemini");
       const data = await res.json();
       result = data.candidates[0].content.parts[0].text;
    } else if (provider.provider === 'openrouter') {
       const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
         method: "POST",
         headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
         body: JSON.stringify({ model: provider.model, messages: [{ role: "user", content: fullPrompt }], temperature: provider.temperatura })
       });
       if (!res.ok) throw new Error("Erro OpenRouter");
       const data = await res.json();
       result = data.choices[0].message.content;
    } else if (provider.provider === 'openai') {
       const res = await fetch("https://api.openai.com/v1/chat/completions", {
         method: "POST",
         headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
         body: JSON.stringify({ model: provider.model, messages: [{ role: "user", content: fullPrompt }], temperature: provider.temperatura, max_tokens: provider.max_tokens })
       });
       if (!res.ok) throw new Error("Erro OpenAI");
       const data = await res.json();
       result = data.choices[0].message.content;
    }
    
    await this.registrarLogIA(provider.provider, provider.model, 'generate', prompt, result, result.length, true);
    return result;
  },

  async gerarRespostaComFallback(prompt: string, context: string = ""): Promise<string> {
    const providers = await this.listarProviders();
    const actives = providers.filter(p => p.ativo).sort((a, b) => a.prioridade - b.prioridade);

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
