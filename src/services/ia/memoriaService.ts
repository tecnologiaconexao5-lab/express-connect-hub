import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";
import { identidadeService } from "@/services/ia/identidadeService";

// ==================== TYPES EXISTENTES (F30.3) ====================
export interface MemoriaConhecimento {
  id: string;
  processamento_id: string;
  robo_id: string | null;
  documento_origem: string;
  tipo_arquivo: string | null;
  conteudo: string;
  categoria: string | null;
  tags: string[];
  data_ref: string;
  versao: number;
  score_relevancia: number;
  created_at: string;
}

export interface ResultadoBusca {
  fragmento: MemoriaConhecimento;
  score: number;
}

export interface RaciocinioAuditoria {
  id: string;
  robo_id: string | null;
  processo_id: string;
  documento_utilizado: string | null;
  trechos_considerados: string[];
  pergunta: string | null;
  decisao: string | null;
  acao_executada: string | null;
  contexto: Record<string, unknown>;
  created_at: string;
}

// ==================== TYPES NOVOS (F33) ====================
export type EscopoMemoria = "compartilhada" | "privada";
export type TipoEntidade = "cliente" | "lead" | "motorista" | "prestador" | "fornecedor" | "colaborador" | "robo" | "projeto" | "contrato" | "outro";
export type TipoEvento = "negociacao" | "reclamacao" | "proposta" | "contratacao" | "atraso" | "pagamento" | "bloqueio" | "elogio" | "cancelamento" | "renovacao" | "alerta" | "outro";

export interface MemoriaEntidade {
  id: string;
  robo_id: string | null;
  entidade_tipo: TipoEntidade;
  entidade_id: string;
  nome: string;
  resumo: string | null;
  metadata: Record<string, unknown>;
  escopo: EscopoMemoria;
  relevancia: number;
  ultima_interacao: string | null;
  criado_por_robo: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoriaEvento {
  id: string;
  robo_id: string | null;
  entidade_tipo: TipoEntidade | null;
  entidade_id: string | null;
  tipo_evento: TipoEvento;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  metadata: Record<string, unknown>;
  escopo: EscopoMemoria;
  criado_por_robo: string | null;
  created_at: string;
}

export interface MemoriaConversa {
  id: string;
  robo_id: string | null;
  entidade_tipo: TipoEntidade | null;
  entidade_id: string | null;
  canal: string;
  assunto: string | null;
  resumo: string | null;
  mensagens_count: number;
  ultima_mensagem: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  metadata: Record<string, unknown>;
  escopo: EscopoMemoria;
  created_at: string;
  updated_at: string;
}

export interface MemoriaPreferencia {
  id: string;
  robo_id: string;
  entidade_tipo: TipoEntidade | null;
  entidade_id: string | null;
  chave: string;
  valor: string;
  tipo: string;
  categoria: string;
  aprendido_automaticamente: boolean;
  escopo: EscopoMemoria;
  created_at: string;
  updated_at: string;
}

export interface MemoriaResumo {
  id: string;
  robo_id: string | null;
  entidade_tipo: TipoEntidade | null;
  entidade_id: string | null;
  sumario: string;
  nivel_detalhe: string;
  periodo_referencia: string | null;
  gerado_por: string | null;
  origem_dados: string[];
  escopo: EscopoMemoria;
  created_at: string;
}

export interface ContextoCompleto {
  entidade: MemoriaEntidade | null;
  preferencias: MemoriaPreferencia[];
  eventos_recentes: MemoriaEvento[];
  conversas_recentes: MemoriaConversa[];
  resumo_atual: MemoriaResumo | null;
  conhecimento: string;
  fontes_conhecimento: string[];
  texto_contexto: string;
}

function nowISO(): string {
  return new Date().toISOString();
}

function calcularSimilaridadeSimples(_termos: string[], _conteudo: string): number {
  const termos = _termos.filter((t) => t.length > 2);
  if (termos.length === 0) return 0;
  const conteudoLower = _conteudo.toLowerCase();
  const matches = termos.filter((t) => conteudoLower.includes(t.toLowerCase()));
  return matches.length / termos.length;
}

export const memoriaService = {
  // ==================== BUSCA EM MEMORIA CONHECIMENTO (F30.3) ====================
  async buscarConhecimento(roboId: string, consulta: string, limite = 10): Promise<ResultadoBusca[]> {
    const termos = consulta.split(/\s+/).filter((t) => t.length > 2);
    const { data: memorias } = await supabase
      .from("memoria_conhecimento")
      .select("*")
      .eq("robo_id", roboId)
      .order("score_relevancia", { ascending: false });
    if (!memorias) return [];
    const items = memorias as MemoriaConhecimento[];
    const scored = items
      .map((m) => ({
        fragmento: m,
        score: calcularSimilaridadeSimples(termos, m.conteudo) * 0.7 + m.score_relevancia * 0.3,
      }))
      .filter((r) => r.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limite);
    return scored;
  },

  async buscarConhecimentoGlobal(consulta: string, limite = 10): Promise<ResultadoBusca[]> {
    const termos = consulta.split(/\s+/).filter((t) => t.length > 2);
    const { data: memorias } = await supabase
      .from("memoria_conhecimento")
      .select("*")
      .order("score_relevancia", { ascending: false });
    if (!memorias) return [];
    const items = memorias as MemoriaConhecimento[];
    const scored = items
      .map((m) => ({
        fragmento: m,
        score: calcularSimilaridadeSimples(termos, m.conteudo) * 0.7 + m.score_relevancia * 0.3,
      }))
      .filter((r) => r.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limite);
    return scored;
  },

  async montarContexto(roboId: string, consulta: string, limite = 5): Promise<{
    contexto: string;
    fragmentos: MemoriaConhecimento[];
    fontes: string[];
  }> {
    const resultados = await memoriaService.buscarConhecimento(roboId, consulta, limite);
    const fragmentos = resultados.map((r) => r.fragmento);
    const fontes = [...new Set(fragmentos.map((f) => f.documento_origem))];
    const contexto = fragmentos
      .map((f, i) => `[Fonte ${i + 1}: ${f.documento_origem} | Score: ${resultados[i]?.score.toFixed(2)}]\n${f.conteudo}`)
      .join("\n\n---\n\n");
    return { contexto, fragmentos, fontes };
  },

  // ==================== RACIOCINIO (F30.3) ====================
  async registrarRaciocinio(dados: {
    robo_id?: string;
    processo_id: string;
    documento_utilizado?: string;
    trechos_considerados?: string[];
    pergunta?: string;
    decisao?: string;
    acao_executada?: string;
    contexto?: Record<string, unknown>;
  }): Promise<RaciocinioAuditoria | null> {
    const { data, error } = await supabase.from("raciocinio_auditoria").insert({
      robo_id: dados.robo_id || null,
      processo_id: dados.processo_id,
      documento_utilizado: dados.documento_utilizado || null,
      trechos_considerados: dados.trechos_considerados || [],
      pergunta: dados.pergunta || null,
      decisao: dados.decisao || null,
      acao_executada: dados.acao_executada || null,
      contexto: dados.contexto || {},
    }).select().single();
    if (error) { console.error("[Memoria] erro registrar raciocinio:", error.message); return null; }
    return data as RaciocinioAuditoria;
  },

  async listarRaciocinios(filtros?: { robo_id?: string; limite?: number }): Promise<RaciocinioAuditoria[]> {
    let query = supabase.from("raciocinio_auditoria").select("*").order("created_at", { ascending: false });
    if (filtros?.robo_id) query = query.eq("robo_id", filtros.robo_id);
    if (filtros?.limite) query = query.limit(filtros.limite);
    const { data } = await query;
    return (data as RaciocinioAuditoria[]) || [];
  },

  async limparMemoriaRobo(roboId: string): Promise<void> {
    await supabase.from("memoria_conhecimento").delete().eq("robo_id", roboId);
    await centralIaService.registrarLog({
      robo_id: roboId, acao: "memoria_robo_limpa", entrada: {}, saida: {}, status: "info",
    });
  },

  // ==================== ENTIDADES (F33) ====================
  async upsertEntidade(dados: {
    robo_id?: string;
    entidade_tipo: TipoEntidade;
    entidade_id: string;
    nome: string;
    resumo?: string;
    metadata?: Record<string, unknown>;
    escopo?: EscopoMemoria;
    relevancia?: number;
    criado_por_robo?: string;
  }): Promise<MemoriaEntidade | null> {
    const { data, error } = await supabase.from("memoria_entidades").upsert({
      robo_id: dados.robo_id || null,
      entidade_tipo: dados.entidade_tipo,
      entidade_id: dados.entidade_id,
      nome: dados.nome,
      resumo: dados.resumo || null,
      metadata: dados.metadata || {},
      escopo: dados.escopo || "compartilhada",
      relevancia: dados.relevancia ?? 0.5,
      ultima_interacao: nowISO(),
      criado_por_robo: dados.criado_por_robo || null,
    }, { onConflict: "entidade_tipo, entidade_id" }).select().single();
    if (error) { console.error("[Memoria] erro upsert entidade:", error.message); return null; }
    await centralIaService.registrarLog({
      robo_id: dados.robo_id, acao: "memoria_entidade_upsert",
      entrada: { entidade_tipo: dados.entidade_tipo, entidade_id: dados.entidade_id, nome: dados.nome },
      saida: { entidade_id: data.id }, status: "sucesso",
    });
    return data as MemoriaEntidade;
  },

  async buscarEntidade(entidadeTipo: TipoEntidade, entidadeId: string): Promise<MemoriaEntidade | null> {
    const { data } = await supabase
      .from("memoria_entidades")
      .select("*")
      .eq("entidade_tipo", entidadeTipo)
      .eq("entidade_id", entidadeId)
      .maybeSingle();
    return data as MemoriaEntidade | null;
  },

  async listarEntidades(params?: {
    entidade_tipo?: TipoEntidade;
    robo_id?: string;
    limite?: number;
    escopo?: EscopoMemoria;
  }): Promise<MemoriaEntidade[]> {
    let query = supabase.from("memoria_entidades").select("*").order("ultima_interacao", { ascending: false });
    if (params?.entidade_tipo) query = query.eq("entidade_tipo", params.entidade_tipo);
    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.escopo) query = query.eq("escopo", params.escopo);
    if (params?.limite) query = query.limit(params.limite);
    const { data } = await query;
    return (data as MemoriaEntidade[]) || [];
  },

  async atualizarInteracaoEntidade(entidadeTipo: TipoEntidade, entidadeId: string): Promise<void> {
    await supabase.from("memoria_entidades").update({ ultima_interacao: nowISO() })
      .eq("entidade_tipo", entidadeTipo).eq("entidade_id", entidadeId);
  },

  // ==================== EVENTOS (F33) ====================
  async registrarEvento(dados: {
    robo_id?: string;
    entidade_tipo?: TipoEntidade;
    entidade_id?: string;
    tipo_evento: TipoEvento;
    titulo: string;
    descricao?: string;
    data_evento?: string;
    metadata?: Record<string, unknown>;
    escopo?: EscopoMemoria;
    criado_por_robo?: string;
  }): Promise<MemoriaEvento | null> {
    const { data, error } = await supabase.from("memoria_eventos").insert({
      robo_id: dados.robo_id || null,
      entidade_tipo: dados.entidade_tipo || null,
      entidade_id: dados.entidade_id || null,
      tipo_evento: dados.tipo_evento,
      titulo: dados.titulo,
      descricao: dados.descricao || null,
      data_evento: dados.data_evento || nowISO(),
      metadata: dados.metadata || {},
      escopo: dados.escopo || "compartilhada",
      criado_por_robo: dados.criado_por_robo || null,
    }).select().single();
    if (error) { console.error("[Memoria] erro registrar evento:", error.message); return null; }
    return data as MemoriaEvento;
  },

  async listarEventos(params?: {
    entidade_tipo?: TipoEntidade;
    entidade_id?: string;
    tipo_evento?: TipoEvento;
    robo_id?: string;
    limite?: number;
  }): Promise<MemoriaEvento[]> {
    let query = supabase.from("memoria_eventos").select("*").order("data_evento", { ascending: false });
    if (params?.entidade_tipo) query = query.eq("entidade_tipo", params.entidade_tipo);
    if (params?.entidade_id) query = query.eq("entidade_id", params.entidade_id);
    if (params?.tipo_evento) query = query.eq("tipo_evento", params.tipo_evento);
    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.limite) query = query.limit(params.limite);
    const { data } = await query;
    return (data as MemoriaEvento[]) || [];
  },

  // ==================== CONVERSAS (F33) ====================
  async registrarConversa(dados: {
    robo_id?: string;
    entidade_tipo?: TipoEntidade;
    entidade_id?: string;
    canal?: string;
    assunto?: string;
    resumo?: string;
    mensagens_count?: number;
    ultima_mensagem?: string;
    data_inicio?: string;
    data_fim?: string;
    metadata?: Record<string, unknown>;
    escopo?: EscopoMemoria;
  }): Promise<MemoriaConversa | null> {
    const { data, error } = await supabase.from("memoria_conversas").insert({
      robo_id: dados.robo_id || null,
      entidade_tipo: dados.entidade_tipo || null,
      entidade_id: dados.entidade_id || null,
      canal: dados.canal || "whatsapp",
      assunto: dados.assunto || null,
      resumo: dados.resumo || null,
      mensagens_count: dados.mensagens_count || 0,
      ultima_mensagem: dados.ultima_mensagem || null,
      data_inicio: dados.data_inicio || null,
      data_fim: dados.data_fim || nowISO(),
      metadata: dados.metadata || {},
      escopo: dados.escopo || "compartilhada",
    }).select().single();
    if (error) { console.error("[Memoria] erro registrar conversa:", error.message); return null; }
    return data as MemoriaConversa;
  },

  async listarConversas(params?: {
    entidade_tipo?: TipoEntidade;
    entidade_id?: string;
    robo_id?: string;
    limite?: number;
  }): Promise<MemoriaConversa[]> {
    let query = supabase.from("memoria_conversas").select("*").order("data_fim", { ascending: false });
    if (params?.entidade_tipo) query = query.eq("entidade_tipo", params.entidade_tipo);
    if (params?.entidade_id) query = query.eq("entidade_id", params.entidade_id);
    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.limite) query = query.limit(params.limite);
    const { data } = await query;
    return (data as MemoriaConversa[]) || [];
  },

  // ==================== PREFERENCIAS (F33) ====================
  async upsertPreferencia(dados: {
    robo_id: string;
    entidade_tipo?: TipoEntidade;
    entidade_id?: string;
    chave: string;
    valor: string;
    tipo?: string;
    categoria?: string;
    aprendido_automaticamente?: boolean;
    escopo?: EscopoMemoria;
  }): Promise<MemoriaPreferencia | null> {
    const { data, error } = await supabase.from("memoria_preferencias").upsert({
      robo_id: dados.robo_id,
      entidade_tipo: dados.entidade_tipo || null,
      entidade_id: dados.entidade_id || null,
      chave: dados.chave,
      valor: dados.valor,
      tipo: dados.tipo || "texto",
      categoria: dados.categoria || "geral",
      aprendido_automaticamente: dados.aprendido_automaticamente ?? false,
      escopo: dados.escopo || "compartilhada",
    }, { onConflict: "entidade_tipo, entidade_id, chave" }).select().single();
    if (error) { console.error("[Memoria] erro upsert preferencia:", error.message); return null; }
    return data as MemoriaPreferencia;
  },

  async listarPreferencias(params?: {
    entidade_tipo?: TipoEntidade;
    entidade_id?: string;
    robo_id?: string;
    categoria?: string;
  }): Promise<MemoriaPreferencia[]> {
    let query = supabase.from("memoria_preferencias").select("*").order("categoria").order("chave");
    if (params?.entidade_tipo) query = query.eq("entidade_tipo", params.entidade_tipo);
    if (params?.entidade_id) query = query.eq("entidade_id", params.entidade_id);
    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.categoria) query = query.eq("categoria", params.categoria);
    const { data } = await query;
    return (data as MemoriaPreferencia[]) || [];
  },

  async removerPreferencia(id: string): Promise<void> {
    await supabase.from("memoria_preferencias").delete().eq("id", id);
  },

  // ==================== RESUMOS (F33) ====================
  async registrarResumo(dados: {
    robo_id?: string;
    entidade_tipo?: TipoEntidade;
    entidade_id?: string;
    sumario: string;
    nivel_detalhe?: string;
    periodo_referencia?: string;
    gerado_por?: string;
    origem_dados?: string[];
    escopo?: EscopoMemoria;
  }): Promise<MemoriaResumo | null> {
    const { data, error } = await supabase.from("memoria_resumos").insert({
      robo_id: dados.robo_id || null,
      entidade_tipo: dados.entidade_tipo || null,
      entidade_id: dados.entidade_id || null,
      sumario: dados.sumario,
      nivel_detalhe: dados.nivel_detalhe || "normal",
      periodo_referencia: dados.periodo_referencia || null,
      gerado_por: dados.gerado_por || null,
      origem_dados: dados.origem_dados || [],
      escopo: dados.escopo || "compartilhada",
    }).select().single();
    if (error) { console.error("[Memoria] erro registrar resumo:", error.message); return null; }
    return data as MemoriaResumo;
  },

  async obterResumoAtual(entidadeTipo: TipoEntidade, entidadeId: string): Promise<MemoriaResumo | null> {
    const { data } = await supabase
      .from("memoria_resumos")
      .select("*")
      .eq("entidade_tipo", entidadeTipo)
      .eq("entidade_id", entidadeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data as MemoriaResumo | null;
  },

  async listarResumos(params?: {
    entidade_tipo?: TipoEntidade;
    entidade_id?: string;
    robo_id?: string;
    limite?: number;
  }): Promise<MemoriaResumo[]> {
    let query = supabase.from("memoria_resumos").select("*").order("created_at", { ascending: false });
    if (params?.entidade_tipo) query = query.eq("entidade_tipo", params.entidade_tipo);
    if (params?.entidade_id) query = query.eq("entidade_id", params.entidade_id);
    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.limite) query = query.limit(params.limite);
    const { data } = await query;
    return (data as MemoriaResumo[]) || [];
  },

  // ==================== CONTEXTO COMPLETO (F33 — FASE 3: MOTOR DE RECUPERAÇÃO) ====================
  async montarContextoCompleto(params: {
    roboId: string;
    entidadeTipo: TipoEntidade;
    entidadeId: string;
    consulta?: string;
    limiteEventos?: number;
    limiteConversas?: number;
  }): Promise<ContextoCompleto> {
    const { roboId, entidadeTipo, entidadeId, consulta, limiteEventos = 10, limiteConversas = 5 } = params;

    const [
      entidade,
      preferencias,
      eventos,
      conversas,
      resumoAtual,
      conhecimento,
    ] = await Promise.all([
      memoriaService.buscarEntidade(entidadeTipo, entidadeId),
      memoriaService.listarPreferencias({ entidade_tipo: entidadeTipo, entidade_id: entidadeId }),
      memoriaService.listarEventos({
        entidade_tipo: entidadeTipo, entidade_id: entidadeId, limite: limiteEventos,
      }),
      memoriaService.listarConversas({
        entidade_tipo: entidadeTipo, entidade_id: entidadeId, limite: limiteConversas,
      }),
      memoriaService.obterResumoAtual(entidadeTipo, entidadeId),
      consulta ? memoriaService.montarContexto(roboId, consulta, 3) : Promise.resolve({ contexto: "", fragmentos: [], fontes: [] }),
    ]);

    const linhas: string[] = [];

    if (entidade) {
      linhas.push(`=== ENTIDADE: ${entidade.nome} (${entidade.entidade_tipo}) ===`);
      if (entidade.resumo) linhas.push(`Resumo: ${entidade.resumo}`);
      linhas.push("");
    }

    if (preferencias.length > 0) {
      linhas.push("--- PREFERÊNCIAS ---");
      for (const p of preferencias) {
        linhas.push(`  ${p.chave}: ${p.valor} (${p.categoria})${p.aprendido_automaticamente ? " [auto]" : ""}`);
      }
      linhas.push("");
    }

    if (eventos.length > 0) {
      linhas.push("--- EVENTOS RECENTES ---");
      for (const e of eventos.slice(0, 5)) {
        const data = new Date(e.data_evento).toLocaleDateString("pt-BR");
        linhas.push(`  [${data}] ${e.tipo_evento}: ${e.titulo}`);
        if (e.descricao) linhas.push(`    ${e.descricao}`);
      }
      if (eventos.length > 5) linhas.push(`  ... mais ${eventos.length - 5} evento(s)`);
      linhas.push("");
    }

    if (conversas.length > 0) {
      linhas.push("--- CONVERSAS RECENTES ---");
      for (const c of conversas.slice(0, 3)) {
        const data = c.data_fim ? new Date(c.data_fim).toLocaleDateString("pt-BR") : "-";
        linhas.push(`  [${data}] ${c.assunto || "sem assunto"} (${c.canal}) — ${c.mensagens_count} msgs`);
        if (c.resumo) linhas.push(`    Resumo: ${c.resumo}`);
      }
      if (conversas.length > 3) linhas.push(`  ... mais ${conversas.length - 3} conversa(s)`);
      linhas.push("");
    }

    if (resumoAtual) {
      linhas.push("--- RESUMO ATUAL ---");
      linhas.push(resumoAtual.sumario);
      linhas.push("");
    }

    if (conhecimento.contexto) {
      linhas.push("--- CONHECIMENTO RELEVANTE ---");
      linhas.push(conhecimento.contexto);
    }

    await memoriaService.atualizarInteracaoEntidade(entidadeTipo, entidadeId);

    return {
      entidade: entidade || null,
      preferencias,
      eventos_recentes: eventos,
      conversas_recentes: conversas,
      resumo_atual: resumoAtual,
      conhecimento: conhecimento.contexto,
      fontes_conhecimento: conhecimento.fontes,
      texto_contexto: linhas.join("\n"),
    };
  },

  // ==================== CONTEXTO COM IDENTIDADE (F36 — FASE 4) ====================
  async montarContextoCompletoComIdentidade(params: {
    roboId: string;
    entidadeTipo: TipoEntidade;
    entidadeId: string;
    consulta?: string;
    limiteEventos?: number;
    limiteConversas?: number;
  }): Promise<ContextoCompleto & { identidade_contexto: string }> {
    const base = await memoriaService.montarContextoCompleto(params);

    let identidadeContexto = "";
    try {
      identidadeContexto = await identidadeService.montarContextoIdentidade(params.roboId);
    } catch { /* identidade indisponivel */ }

    return { ...base, identidade_contexto: identidadeContexto };
  },

  // ==================== LIMPEZA CORPORATIVA (F33) ====================
  async limparMemoriaEntidade(entidadeTipo: TipoEntidade, entidadeId: string): Promise<void> {
    await Promise.all([
      supabase.from("memoria_entidades").delete().eq("entidade_tipo", entidadeTipo).eq("entidade_id", entidadeId),
      supabase.from("memoria_eventos").delete().eq("entidade_tipo", entidadeTipo).eq("entidade_id", entidadeId),
      supabase.from("memoria_conversas").delete().eq("entidade_tipo", entidadeTipo).eq("entidade_id", entidadeId),
      supabase.from("memoria_preferencias").delete().eq("entidade_tipo", entidadeTipo).eq("entidade_id", entidadeId),
      supabase.from("memoria_resumos").delete().eq("entidade_tipo", entidadeTipo).eq("entidade_id", entidadeId),
    ]);
  },
};

export default memoriaService;
