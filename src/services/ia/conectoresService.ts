import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";
import { getProviderForConector } from "./providers/ProviderRegistry";
import { gerarIdempotencyKey, verificarDuplicidade, marcarDuplicata, registrarIdempotencyKey } from "./idempotencyService";

export type TipoConector =
  | "EMAIL" | "WHATSAPP" | "CRM" | "IA" | "AUTOMACAO_WEB"
  | "REDE_SOCIAL" | "PLATAFORMA_VAGAS" | "FINANCEIRO" | "OUTRO";

export type ModoConector = "HOMOLOGACAO" | "PRODUCAO_ASSISTIDA" | "PRODUCAO" | "PRODUCAO_AUTONOMA";

export type StatusExecucaoConector =
  | "SOLICITADA" | "AGUARDANDO_APROVACAO" | "APROVADA"
  | "EM_EXECUCAO" | "CONCLUIDA" | "FALHOU" | "CANCELADA";

export interface IaConector {
  id: string;
  codigo_unico: string;
  nome: string;
  descricao: string | null;
  tipo: TipoConector;
  provedor: string;
  config_default: Record<string, unknown>;
  modo_padrao: ModoConector;
  ativo: boolean;
  url_base: string | null;
  health_check_url: string | null;
  instrucoes_conexao: string | null;
  credenciais: Record<string, unknown>;
  token: string | null;
  refresh_token: string | null;
  token_validade: string | null;
  escopos: string[];
  limite_uso_dia: number;
  horario_permitido_inicio: string | null;
  horario_permitido_fim: string | null;
  created_at: string;
  updated_at: string;
}

export interface IaConectorRobo {
  id: string;
  robo_id: string;
  conector_id: string;
  modo: ModoConector;
  config_override: Record<string, unknown>;
  ativo: boolean;
  limite_uso_dia: number | null;
  horario_permitido_inicio: string | null;
  horario_permitido_fim: string | null;
  created_at: string;
  updated_at: string;
  conector_nome?: string;
  conector_tipo?: string;
  conector_provedor?: string;
  robo_nome?: string;
}

export interface IaExecucaoConector {
  id: string;
  robo_id: string;
  conector_id: string;
  ferramenta_id: string | null;
  tarefa_id: string | null;
  aprovacao_id: string | null;
  acao: string;
  payload: Record<string, unknown>;
  modo_executado: ModoConector;
  status: StatusExecucaoConector;
  resultado: Record<string, unknown>;
  erro: string | null;
  request_log: Record<string, unknown>[];
  response_log: Record<string, unknown>;
  tentativa: number;
  duracao_ms: number | null;
  idempotency_key: string | null;
  request_url: string | null;
  request_method: string | null;
  inicio_execucao: string | null;
  fim_execucao: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  created_at: string;
  updated_at: string;
  robo_nome?: string;
  conector_nome?: string;
  conector_tipo?: string;
}

function nowISO(): string {
  return new Date().toISOString();
}

function horaAtual(): string {
  return new Date().toTimeString().slice(0, 5);
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const SIMULAR_ACAO: Record<string, Record<string, unknown>> = {
  enviar_email: { status: "simulado", mensagem: "E-mail simulado — modo HOMOLOGACAO ativo" },
  enviar_mensagem: { status: "simulado", mensagem: "Mensagem simulada — modo HOMOLOGACAO ativo" },
  publicar_vaga: { status: "simulado", mensagem: "Vaga simulada — modo HOMOLOGACAO ativo" },
  criar_post: { status: "simulado", mensagem: "Post simulado — modo HOMOLOGACAO ativo" },
  criar_campanha: { status: "simulado", mensagem: "Campanha simulada — modo HOMOLOGACAO ativo" },
};

export const conectoresService = {
  // ==================== CATÁLOGO DE CONECTORES ====================
  async listarConectores(): Promise<IaConector[]> {
    const { data } = await supabase
      .from("ia_conectores")
      .select("*")
      .order("tipo")
      .order("nome");
    return (data as IaConector[]) || [];
  },

  async criarConector(dados: {
    codigo_unico: string;
    nome: string;
    descricao?: string;
    tipo: TipoConector;
    provedor: string;
    config_default?: Record<string, unknown>;
    modo_padrao?: ModoConector;
    url_base?: string;
    health_check_url?: string;
    instrucoes_conexao?: string;
    credenciais?: Record<string, unknown>;
    escopos?: string[];
    limite_uso_dia?: number;
    horario_permitido_inicio?: string;
    horario_permitido_fim?: string;
  }): Promise<IaConector | null> {
    const { data, error } = await supabase.from("ia_conectores").insert({
      codigo_unico: dados.codigo_unico,
      nome: dados.nome,
      descricao: dados.descricao || null,
      tipo: dados.tipo,
      provedor: dados.provedor,
      config_default: dados.config_default || {},
      modo_padrao: dados.modo_padrao || "HOMOLOGACAO",
      url_base: dados.url_base || null,
      health_check_url: dados.health_check_url || null,
      instrucoes_conexao: dados.instrucoes_conexao || null,
      credenciais: dados.credenciais || {},
      escopos: dados.escopos || [],
      limite_uso_dia: dados.limite_uso_dia || 100,
      horario_permitido_inicio: dados.horario_permitido_inicio || null,
      horario_permitido_fim: dados.horario_permitido_fim || null,
    }).select().single();
    if (error) {
      console.error("[ConectoresService] erro criar conector:", error.message);
      return null;
    }
    return data as IaConector;
  },

  async atualizarConector(id: string, dados: Partial<IaConector>): Promise<void> {
    await supabase.from("ia_conectores").update({ ...dados, updated_at: nowISO() }).eq("id", id);
  },

  async desativarConector(id: string): Promise<void> {
    await supabase.from("ia_conectores").update({ ativo: false, updated_at: nowISO() }).eq("id", id);
  },

  async salvarCredenciais(id: string, credenciais: Record<string, unknown>): Promise<void> {
    await supabase.from("ia_conectores").update({ credenciais, updated_at: nowISO() }).eq("id", id);
  },

  async salvarToken(id: string, token: string, refreshToken?: string, validade?: string): Promise<void> {
    await supabase.from("ia_conectores").update({
      token,
      refresh_token: refreshToken || null,
      token_validade: validade || null,
      updated_at: nowISO(),
    }).eq("id", id);
  },

  // ==================== VÍNCULO ROBÔ × CONECTOR ====================
  async listarVinculos(filtros?: { robo_id?: string; conector_id?: string }): Promise<IaConectorRobo[]> {
    let query = supabase
      .from("ia_conector_robo")
      .select("*, ia_conectores!inner(nome, tipo, provedor), automacoes_robos!inner(nome)")
      .order("created_at", { ascending: false });
    if (filtros?.robo_id) query = query.eq("robo_id", filtros.robo_id);
    if (filtros?.conector_id) query = query.eq("conector_id", filtros.conector_id);
    const { data } = await query;
    return ((data as Record<string, unknown>[]) || []).map((r) => ({
      ...r,
      conector_nome: (r as { ia_conectores?: { nome: string } }).ia_conectores?.nome,
      conector_tipo: (r as { ia_conectores?: { tipo: string } }).ia_conectores?.tipo,
      conector_provedor: (r as { ia_conectores?: { provedor: string } }).ia_conectores?.provedor,
      robo_nome: (r as { automacoes_robos?: { nome: string } }).automacoes_robos?.nome,
    })) as IaConectorRobo[];
  },

  async vincularRobo(dados: {
    robo_id: string;
    conector_id: string;
    modo?: ModoConector;
    config_override?: Record<string, unknown>;
    limite_uso_dia?: number;
    horario_permitido_inicio?: string;
    horario_permitido_fim?: string;
  }): Promise<IaConectorRobo | null> {
    const { data, error } = await supabase.from("ia_conector_robo").upsert({
      robo_id: dados.robo_id,
      conector_id: dados.conector_id,
      modo: dados.modo || "HOMOLOGACAO",
      config_override: dados.config_override || {},
      ativo: true,
      limite_uso_dia: dados.limite_uso_dia || null,
      horario_permitido_inicio: dados.horario_permitido_inicio || null,
      horario_permitido_fim: dados.horario_permitido_fim || null,
    }, { onConflict: "robo_id, conector_id" }).select().single();
    if (error) {
      console.error("[ConectoresService] erro vincular robo:", error.message);
      return null;
    }
    return data as IaConectorRobo;
  },

  async desvincularRobo(id: string): Promise<void> {
    await supabase.from("ia_conector_robo").update({ ativo: false, updated_at: nowISO() }).eq("id", id);
  },

  async atualizarVinculo(id: string, dados: Partial<IaConectorRobo>): Promise<void> {
    await supabase.from("ia_conector_robo").update({ ...dados, updated_at: nowISO() }).eq("id", id);
  },

  // ==================== TESTE DE CONEXÃO ====================
  async testarConexao(conectorId: string): Promise<{ ok: boolean; mensagem: string }> {
    const { data: conector } = await supabase
      .from("ia_conectores")
      .select("*")
      .eq("id", conectorId)
      .single();

    if (!conector) return { ok: false, mensagem: "Conector não encontrado" };

    const provider = getProviderForConector(conector as IaConector);
    if (!provider) return { ok: false, mensagem: `Nenhum provider implementado para ${conector.tipo}:${conector.provedor}` };

    try {
      const result = await provider.testConnection({ ...conector.config_default, url_base: conector.url_base, ...conector.credenciais });
      return result;
    } catch (err) {
      return { ok: false, mensagem: `Erro no teste: ${err instanceof Error ? err.message : "Erro desconhecido"}` };
    }
  },

  // ==================== VALIDAÇÕES ====================
  async validarPermissao(roboId: string, conectorId: string): Promise<{
    permitido: boolean;
    motivo?: string;
    vinculo?: IaConectorRobo;
  }> {
    const { data } = await supabase
      .from("ia_conector_robo")
      .select("*, ia_conectores!inner(*)")
      .eq("robo_id", roboId)
      .eq("conector_id", conectorId)
      .eq("ativo", true)
      .maybeSingle();

    if (!data) return { permitido: false, motivo: "Robô não possui acesso a este conector" };
    return { permitido: true, vinculo: data as unknown as IaConectorRobo };
  },

  async validarModo(conectorId: string): Promise<{
    pode_executar: boolean;
    modo: ModoConector;
    motivo?: string;
  }> {
    const { data: conector } = await supabase
      .from("ia_conectores")
      .select("modo_padrao, horario_permitido_inicio, horario_permitido_fim")
      .eq("id", conectorId)
      .single();

    const modo = (conector?.modo_padrao || "HOMOLOGACAO") as ModoConector;
    if (modo === "HOMOLOGACAO") {
      return {
        pode_executar: true,
        modo,
        motivo: "MODO SEGURO — Execução simulada, sem chamada a API externa",
      };
    }

    if (conector?.horario_permitido_inicio && conector?.horario_permitido_fim) {
      const agora = horaAtual();
      if (agora < conector.horario_permitido_inicio || agora > conector.horario_permitido_fim) {
        return { pode_executar: false, modo, motivo: `Fora do horário permitido (${conector.horario_permitido_inicio} - ${conector.horario_permitido_fim})` };
      }
    }

    return { pode_executar: true, modo };
  },

  async validarLimitesDiarios(conectorId: string): Promise<{
    valido: boolean;
    motivo?: string;
    usadasHoje: number;
    limite: number;
  }> {
    const { data: conector } = await supabase
      .from("ia_conectores")
      .select("limite_uso_dia")
      .eq("id", conectorId)
      .single();

    const limite = (conector?.limite_uso_dia || 100) as number;

    const { count } = await supabase
      .from("ia_execucoes_conectores")
      .select("id", { count: "exact", head: true })
      .eq("conector_id", conectorId)
      .gte("created_at", `${hojeISO()}T00:00:00`)
      .lte("created_at", `${hojeISO()}T23:59:59`)
      .in("status", ["CONCLUIDA", "EM_EXECUCAO"]);

    const usadasHoje = count || 0;
    if (usadasHoje >= limite) {
      return { valido: false, motivo: `Limite diário excedido (${usadasHoje}/${limite})`, usadasHoje, limite };
    }
    return { valido: true, usadasHoje, limite };
  },

  // ==================== EXECUÇÕES ====================
  async registrarExecucao(params: {
    robo_id: string;
    conector_id: string;
    ferramenta_id?: string;
    acao: string;
    payload?: Record<string, unknown>;
    modo: ModoConector;
  }): Promise<IaExecucaoConector | null> {
    const { data, error } = await supabase.from("ia_execucoes_conectores").insert({
      robo_id: params.robo_id,
      conector_id: params.conector_id,
      ferramenta_id: params.ferramenta_id || null,
      acao: params.acao,
      payload: params.payload || {},
      modo_executado: params.modo,
      status: "EM_EXECUCAO",
      tentativa: 1,
      inicio_execucao: nowISO(),
    }).select().single();

    if (error) {
      console.error("[ConectoresService] erro registrar execução:", error.message);
      return null;
    }
    return data as IaExecucaoConector;
  },

  async executarConector(execucaoId: string): Promise<boolean> {
    const { data: exec } = await supabase
      .from("ia_execucoes_conectores")
      .select("*, ia_conectores!inner(*)")
      .eq("id", execucaoId)
      .single();

    if (!exec) return false;

    const inicio = Date.now();

    try {
      const conectorRaw = exec as unknown as { ia_conectores?: IaConector };
      const conector = conectorRaw.ia_conectores as IaConector;
      const modo = exec.modo_executado as ModoConector;
      const acaoKey = exec.acao.split(":")[0]?.trim()?.toLowerCase()?.replace(/\s+/g, "_") || exec.acao;

      // Anti-duplicidade: verifica se já existe execução CONCLUIDA com mesma chave
      if (modo !== "HOMOLOGACAO") {
        const key = await gerarIdempotencyKey(exec.conector_id, acaoKey, exec.payload as Record<string, unknown>);
        const { duplicata, execucaoExistente } = await verificarDuplicidade(key, exec.conector_id);
        if (duplicata && execucaoExistente) {
          await marcarDuplicata(exec.id, key, execucaoExistente.id);
          void centralIaService.registrarLog({
            robo_id: exec.robo_id,
            acao: "conector_duplicata_bloqueada",
            entrada: { execucao_id: exec.id, conector: conector?.nome, modo, idempotency_key: key },
            saida: { status: "duplicata_bloqueada", execucao_original_id: execucaoExistente.id },
            status: "sucesso",
          });
          return true;
        }
        // Armazena a chave para futuras verificações
        await registrarIdempotencyKey(exec.id, key);
      }

      let resultadoFinal: Record<string, unknown>;

      if (modo === "HOMOLOGACAO") {
        resultadoFinal = {
          status: "simulado",
          mensagem: "EXECUÇÃO SIMULADA — Conector em modo HOMOLOGAÇÃO. Nenhuma API externa foi chamada.",
          conector: conector?.nome || "",
          acao: exec.acao,
          timestamp: nowISO(),
          ambiente: "simulado",
          simulado: true,
          observacao: "Ative PRODUCAO_ASSISTIDA ou PRODUCAO_AUTONOMA para chamadas reais.",
        };
      } else {
        const provider = getProviderForConector(conector);
        if (!provider) {
          resultadoFinal = {
            status: "sem_provider",
            mensagem: `Nenhum driver implementado para ${conector?.tipo}:${conector?.provedor}. Ação não pôde ser executada.`,
            acao: exec.acao,
            timestamp: nowISO(),
          };
        } else {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            try {
              const result = await provider.execute({
                acao: acaoKey,
                payload: exec.payload || {},
                config: { ...conector?.config_default, url_base: conector?.url_base },
                signal: controller.signal,
                timeoutMs: 30000,
                credentials: conector?.credenciais || {},
                roboId: exec.robo_id,
              });

              if (result.sucesso) {
                resultadoFinal = {
                  ...result.data,
                  status: "executado",
                  provider: provider.nome,
                  acao: exec.acao,
                  timestamp: nowISO(),
                  ambiente: modo,
                };
              } else {
                resultadoFinal = {
                  status: "falhou",
                  provider: provider.nome,
                  erro: result.erro,
                  acao: exec.acao,
                  timestamp: nowISO(),
                };
              }
            } finally {
              clearTimeout(timeoutId);
            }
          } catch (providerErr) {
            resultadoFinal = {
              status: "falhou",
              erro: providerErr instanceof Error ? providerErr.message : "Erro no provider",
              acao: exec.acao,
              timestamp: nowISO(),
            };
          }
        }
      }

      const duracao = Date.now() - inicio;

      const updateData: Record<string, unknown> = {
        resultado: resultadoFinal,
        response_log: resultadoFinal,
        duracao_ms: duracao,
        fim_execucao: nowISO(),
        updated_at: nowISO(),
      };

      const isProducaoAutonoma = modo === "PRODUCAO" || modo === "PRODUCAO_AUTONOMA";
      const pendente = isProducaoAutonoma ? false : resultadoFinal.pendente === true;
      if (resultadoFinal.status === "falhou" || resultadoFinal.status === "erro") {
        updateData.status = "FALHOU";
        updateData.erro = pendente
          ? `${resultadoFinal.erro as string || "Falha temporária"} [PENDENTE]`
          : (resultadoFinal.erro as string) || "Erro na execução";
        if (pendente) {
          resultadoFinal.pendente = true;
        }
      } else {
        updateData.status = "CONCLUIDA";
      }

      await supabase.from("ia_execucoes_conectores").update(updateData).eq("id", execucaoId);

      void centralIaService.registrarLog({
        robo_id: exec.robo_id,
        acao: `conector_${updateData.status === "CONCLUIDA" ? "concluido" : "falhou"}`,
        entrada: { execucao_id: execucaoId, conector: conector?.nome, modo },
        saida: resultadoFinal,
        status: updateData.status === "CONCLUIDA" ? "sucesso" : "erro",
      });

      return updateData.status === "CONCLUIDA";
    } catch (err) {
      const duracao = Date.now() - inicio;
      const erroMsg = err instanceof Error ? err.message : "Erro desconhecido na execução do conector";

      await supabase.from("ia_execucoes_conectores").update({
        status: "FALHOU",
        erro: erroMsg,
        duracao_ms: duracao,
        fim_execucao: nowISO(),
        updated_at: nowISO(),
      }).eq("id", execucaoId);
      return false;
    }
  },

  async executarComProvider(conectorId: string, acao: string, payload: Record<string, unknown>): Promise<{
    sucesso: boolean;
    data?: Record<string, unknown>;
    erro?: string;
  }> {
    const { data: conector } = await supabase
      .from("ia_conectores")
      .select("*")
      .eq("id", conectorId)
      .single();

    if (!conector) return { sucesso: false, erro: "Conector não encontrado" };

    if (!conector.ativo) return { sucesso: false, erro: "Conector inativo" };

    const provider = getProviderForConector(conector as IaConector);
    if (!provider) {
      return { sucesso: false, erro: `Nenhum provider para ${conector.tipo}:${conector.provedor}` };
    }

    const timeoutMs = conector.timeout_segundos ? conector.timeout_segundos * 1000 : 30000;

    try {
      const result = await Promise.race([
        provider.execute({
          acao,
          payload,
          config: { ...conector.config_default, url_base: conector.url_base },
          credentials: conector.credenciais || {},
          roboId: payload.robo_id as string | undefined,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms excedido`)), timeoutMs)
        ),
      ]);
      return result;
    } catch (err) {
      return { sucesso: false, erro: err instanceof Error ? err.message : "Erro no provider" };
    }
  },

  async finalizarExecucao(execucaoId: string, resultado: Record<string, unknown>): Promise<void> {
    await supabase.from("ia_execucoes_conectores").update({
      status: "CONCLUIDA",
      resultado,
      fim_execucao: nowISO(),
      updated_at: nowISO(),
    }).eq("id", execucaoId);
  },

  async registrarErro(execucaoId: string, erro: string): Promise<void> {
    await supabase.from("ia_execucoes_conectores").update({
      status: "FALHOU",
      erro,
      fim_execucao: nowISO(),
      updated_at: nowISO(),
    }).eq("id", execucaoId);
  },

  // ==================== HISTÓRICO E ESTATÍSTICAS ====================
  async listarHistorico(params?: {
    robo_id?: string;
    conector_id?: string;
    status?: StatusExecucaoConector;
    limite?: number;
  }): Promise<IaExecucaoConector[]> {
    let query = supabase
      .from("ia_execucoes_conectores")
      .select("*, ia_conectores!left(nome, tipo), automacoes_robos!left(nome)")
      .order("created_at", { ascending: false });
    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.conector_id) query = query.eq("conector_id", params.conector_id);
    if (params?.status) query = query.eq("status", params.status);
    if (params?.limite) query = query.limit(params.limite);
    const { data } = await query;
    return ((data as Record<string, unknown>[]) || []).map((e) => ({
      ...e,
      robo_nome: (e as { automacoes_robos?: { nome: string } }).automacoes_robos?.nome,
      conector_nome: (e as { ia_conectores?: { nome: string } }).ia_conectores?.nome,
      conector_tipo: (e as { ia_conectores?: { tipo: string } }).ia_conectores?.tipo,
    })) as IaExecucaoConector[];
  },

  async obterEstatisticas(): Promise<{
    total_conectores: number;
    total_vinculos: number;
    total_execucoes: number;
    concluidas: number;
    falhas: number;
    pendentes: number;
    conectores_por_tipo: Record<string, number>;
  }> {
    const { data: conectores } = await supabase.from("ia_conectores").select("tipo");
    const { count: totalVinculos } = await supabase
      .from("ia_conector_robo")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true);
    const { data: execs } = await supabase.from("ia_execucoes_conectores").select("status");

    const tipos: Record<string, number> = {};
    for (const c of (conectores || []) as { tipo: string }[]) {
      tipos[c.tipo] = (tipos[c.tipo] || 0) + 1;
    }

    const execsList = (execs || []) as { status: string }[];
    return {
      total_conectores: (conectores || []).length,
      total_vinculos: totalVinculos || 0,
      total_execucoes: execsList.length,
      concluidas: execsList.filter((e) => e.status === "CONCLUIDA").length,
      falhas: execsList.filter((e) => e.status === "FALHOU").length,
      pendentes: execsList.filter((e) => ["SOLICITADA", "EM_EXECUCAO"].includes(e.status)).length,
      conectores_por_tipo: tipos,
    };
  },

  // ==================== DASHBOARD ====================

  async obterDashboard(): Promise<{
    conectores: (IaConector & { saudacao: "online" | "falhando" | "pendente" | "simulado"; ultima_execucao: string | null })[],
    execucoes_hoje: { total: number; concluidas: number; falhas: number; pendentes: number },
    taxa_sucesso: number,
    ultimas_execucoes: IaExecucaoConector[],
    fila_pendentes: number,
    duplicatas_hoje: number,
    tempo_medio_ms: number,
    disponibilidade_percentual: number,
  }> {
    const conectores = await this.listarConectores();
    const todosAtivos = conectores.filter(c => c.ativo);

    const hojeInicio = new Date();
    hojeInicio.setHours(0, 0, 0, 0);
    const hojeStr = hojeInicio.toISOString();

    const { data: execsHoje } = await supabase
      .from("ia_execucoes_conectores")
      .select("*")
      .gte("created_at", hojeStr)
      .order("created_at", { ascending: false });

    const { data: ultimasRaw } = await supabase
      .from("ia_execucoes_conectores")
      .select("*, ia_conectores!left(nome, tipo), automacoes_robos!left(nome)")
      .order("created_at", { ascending: false })
      .limit(50);

    const ultimas = ((ultimasRaw as Record<string, unknown>[]) || []).map(e => ({
      ...e,
      robo_nome: (e as { automacoes_robos?: { nome: string } }).automacoes_robos?.nome,
      conector_nome: (e as { ia_conectores?: { nome: string } }).ia_conectores?.nome,
      conector_tipo: (e as { ia_conectores?: { tipo: string } }).ia_conectores?.tipo,
    })) as IaExecucaoConector[];

    const hoje = (execsHoje || []) as IaExecucaoConector[];
    const concluidas = hoje.filter(e => e.status === "CONCLUIDA").length;
    const falhas = hoje.filter(e => e.status === "FALHOU").length;
    const pendentes = hoje.filter(e => ["SOLICITADA", "EM_EXECUCAO"].includes(e.status)).length;
    const duplicatas = hoje.filter(e => {
      const r = e.resultado as Record<string, unknown> | null;
      return r?.status === "duplicata_bloqueada";
    }).length;
    const taxa_sucesso = hoje.length > 0 ? Math.round((concluidas / hoje.length) * 100) : 100;
    const duracaoTotal = hoje.reduce((acc, e) => acc + (e.duracao_ms || 0), 0);
    const tempoMedioMs = hoje.length > 0 ? Math.round(duracaoTotal / hoje.length) : 0;
    const totalValidas = concluidas + falhas;
    const dispPercentual = totalValidas > 0 ? Math.round((concluidas / totalValidas) * 100) : 100;

    const conectoresComSaude = await Promise.all(todosAtivos.map(async (c) => {
      const { data: ultima } = await supabase
        .from("ia_execucoes_conectores")
        .select("status, resultado, created_at")
        .eq("conector_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const ultimoStatus = (ultima && ultima.length > 0 ? ultima[0] : null) as { status: string; resultado?: Record<string, unknown>; created_at: string } | null;
      const ultimaData = ultimoStatus?.created_at || null;

      let saudacao: "online" | "falhando" | "pendente" | "simulado";
      if (!ultimoStatus) {
        saudacao = "pendente";
      } else if (ultimoStatus.status === "CONCLUIDA") {
        const resultado = ultimoStatus.resultado || {};
        if (resultado.ambiente === "simulado" || resultado.simulado === true || resultado.status === "simulado") {
          saudacao = "simulado";
        } else {
          saudacao = "online";
        }
      } else if (ultimoStatus.status === "FALHOU") {
        saudacao = "falhando";
      } else {
        saudacao = "pendente";
      }

      return { ...c, saudacao, ultima_execucao: ultimaData };
    }));

    const { count: filaPendentes } = await supabase
      .from("ia_execucoes_conectores")
      .select("id", { count: "exact", head: true })
      .eq("status", "SOLICITADA");

    return {
      conectores: conectoresComSaude,
      execucoes_hoje: { total: hoje.length, concluidas, falhas, pendentes },
      taxa_sucesso,
      ultimas_execucoes: ultimas,
      fila_pendentes: filaPendentes ?? 0,
      duplicatas_hoje: duplicatas,
      tempo_medio_ms: tempoMedioMs,
      disponibilidade_percentual: dispPercentual,
    };
  },

  async reprocessarExecucao(execucaoId: string): Promise<{ sucesso: boolean; mensagem: string }> {
    const { data: exec } = await supabase
      .from("ia_execucoes_conectores")
      .select("*")
      .eq("id", execucaoId)
      .single();

    if (!exec) {
      return { sucesso: false, mensagem: "Execução não encontrada" };
    }

    if (exec.status === "CONCLUIDA") {
      return { sucesso: false, mensagem: "Execução já foi concluída com sucesso. Não é necessário reprocessar." };
    }

    const { data: conector } = await supabase
      .from("ia_conectores")
      .select("*")
      .eq("id", exec.conector_id)
      .single();

    if (!conector) {
      return { sucesso: false, mensagem: "Conector não encontrado" };
    }

    const provider = getProviderForConector(conector as IaConector);
    if (!provider) {
      return { sucesso: false, mensagem: `Nenhum provider para ${conector.tipo}:${conector.provedor}` };
    }

    const acaoKey = exec.acao.split(":")[0]?.trim()?.toLowerCase()?.replace(/\s+/g, "_") || exec.acao;

    try {
      const result = await provider.execute({
        acao: acaoKey,
        payload: exec.payload || {},
        config: { ...conector.config_default, url_base: conector.url_base },
        credentials: conector.credenciais || {},
        roboId: exec.robo_id,
      });

      const updateData: Record<string, unknown> = {
        tentativa: (exec.tentativa || 0) + 1,
        resultado: result.data || {},
        response_log: result.data || {},
        fim_execucao: nowISO(),
        updated_at: nowISO(),
      };

      if (result.sucesso) {
        updateData.status = "CONCLUIDA";
        updateData.erro = null;
        await supabase.from("ia_execucoes_conectores").update(updateData).eq("id", execucaoId);
        void centralIaService.registrarLog({
          robo_id: exec.robo_id,
          acao: "conector_reprocessado",
          entrada: { execucao_id: execucaoId, conector: conector.nome },
          saida: result.data,
          status: "sucesso",
        });
        return { sucesso: true, mensagem: `Conector ${conector.nome} executado com sucesso na retentativa.` };
      } else {
        updateData.erro = result.erro || "Erro no reprocessamento";
        await supabase.from("ia_execucoes_conectores").update(updateData).eq("id", execucaoId);
        void centralIaService.registrarLog({
          robo_id: exec.robo_id,
          acao: "conector_reprocessado",
          entrada: { execucao_id: execucaoId, conector: conector.nome },
          saida: result.data || {},
          status: "erro",
        });
        return { sucesso: false, mensagem: `Falha no reprocessamento: ${result.erro}` };
      }
    } catch (err) {
      const erroMsg = err instanceof Error ? err.message : "Erro desconhecido no reprocessamento";
      return { sucesso: false, mensagem: erroMsg };
    }
  },
};
