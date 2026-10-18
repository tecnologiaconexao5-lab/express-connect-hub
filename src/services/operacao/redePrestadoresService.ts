import { supabase } from "@/lib/supabase";
import { sincronizarComEscala } from "@/services/ordemServicoService";
import { gerarLinkRastreio } from "@/services/rastreamento/trackingService";
import { veiculoCompativel, tiposVeiculoDoPrestador } from "@/services/operacao/redeVeiculoFiltro";

// ============================================================
// Tipos
// ============================================================
export type RedeOportunidadeStatus =
  | "publicada"
  | "visualizada"
  | "interessada"
  | "aceita"
  | "expirada"
  | "cancelada";

export interface RedeOportunidade {
  id: string;
  os_id: string;
  status: RedeOportunidadeStatus;
  prestador_aceite_id: string | null;
  valor_prestador: number;
  veiculo_necessario: Record<string, any>;
  regiao: string | null;
  requisitos: string[];
  prazo_expiracao: string | null;
  aceite_em: string | null;
  expirada_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface RedeVisualizacao {
  id: string;
  oportunidade_id: string;
  prestador_id: string;
  status: "visualizada" | "interessada";
  created_at: string;
}

export interface PrestadorCompativel {
  prestador_id: string;
  nome_completo: string;
  telefone: string | null;
  whatsapp: string | null;
  score_interno: number;
  tipo_veiculo: string | null;
  placa: string | null;
  capacidade_kg: number | null;
  regiao_principal: string | null;
  aceita_refrigerada: boolean;
  status: string;
  score_match: number;
}

export interface CriarOportunidadeInput {
  os_id: string;
  valor_prestador: number;
  veiculo_necessario?: Record<string, any>;
  regiao?: string;
  requisitos?: string[];
  prazo_expiracao?: string;
}

// ============================================================
// 1. Publicar Oportunidade
// ============================================================
export async function publicarOportunidade(
  input: CriarOportunidadeInput
): Promise<{ sucesso: boolean; oportunidade?: RedeOportunidade; erro?: string }> {
  try {
    // Verificar se já existe oportunidade ativa para esta OS
    const { data: existente } = await supabase
      .from("rede_oportunidades")
      .select("id, status")
      .eq("os_id", input.os_id)
      .in("status", ["publicada", "visualizada", "interessada"])
      .maybeSingle();

    if (existente) {
      return { sucesso: false, erro: "Já existe uma oportunidade ativa para esta OS" };
    }

    // Buscar dados da OS para preencher automaticamente
    const { data: os } = await supabase
      .from("ordens_servico")
      .select("veiculo_tipo, veiculo_carroceria, veiculo_termica, carga_refrigerada, distancia_km, peso")
      .eq("id", input.os_id)
      .single();

    const veiculo = input.veiculo_necessario || {};
    if (os && Object.keys(veiculo).length === 0) {
      veiculo.tipo = os.veiculo_tipo || "";
      veiculo.carroceria = os.veiculo_carroceria || "";
      veiculo.termica = os.carga_refrigerada ? "refrigerado" : (os.veiculo_termica || "seco");
      veiculo.capacidade_kg = os.peso || 0;
    }

    // Buscar região da OS (primeiro endereco de coleta)
    let regiao = input.regiao || "";
    if (!regiao && os) {
      const { data: enderecos } = await supabase
        .from("ordens_servico")
        .select("enderecos")
        .eq("id", input.os_id)
        .single();

      if (enderecos?.enderecos?.length > 0) {
        const coleta = enderecos.enderecos.find((e: any) => e.tipo === "coleta");
        if (coleta?.cidade) regiao = coleta.cidade;
      }
    }

    const prazo = input.prazo_expiracao || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("rede_oportunidades")
      .insert([{
        os_id: input.os_id,
        valor_prestador: input.valor_prestador,
        veiculo_necessario: veiculo,
        regiao: regiao || null,
        requisitos: input.requisitos || [],
        prazo_expiracao: prazo,
      }])
      .select()
      .single();

    if (error) throw error;

    // Atualizar status da OS para pendente (se estava rascunho)
    await supabase
      .from("ordens_servico")
      .update({ status: "pendente" })
      .eq("id", input.os_id)
      .eq("status", "rascunho");

    // Registrar evento na timeline da OS
    await supabase.from("os_historico").insert([{
      os_id: input.os_id,
      acao: "OS enviada para Rede de Prestadores",
      usuario: "Sistema Rede",
    }]);

    return { sucesso: true, oportunidade: data };
  } catch (err: any) {
    console.error("[RedePrestadores] Erro ao publicar oportunidade:", err);
    return { sucesso: false, erro: err.message };
  }
}

// ============================================================
// 2. Buscar Prestadores Compatíveis (usa RPC do banco)
// ============================================================
export async function buscarPrestadoresCompativeis(
  oportunidadeId: string
): Promise<{ sucesso: boolean; prestadores?: PrestadorCompativel[]; erro?: string }> {
  try {
    // ETAPA-2: tipo de veículo exigido pela OS (fonte: veiculo_necessario)
    const { data: oportunidade } = await supabase
      .from("rede_oportunidades")
      .select("veiculo_necessario")
      .eq("id", oportunidadeId)
      .maybeSingle();
    const tipoNecessario = (oportunidade?.veiculo_necessario as any)?.tipo || "";

    const { data, error } = await supabase
      .rpc("f_buscar_prestadores_compativeis", {
        p_oportunidade_id: oportunidadeId,
      });

    if (error) throw error;

    // ETAPA-2: filtro RIGOROSO por tipo de veículo (defesa em profundidade
    // sobre o resultado da RPC). OS de moto só lista prestador de moto.
    const lista = (data || []) as PrestadorCompativel[];
    const filtrados = tipoNecessario
      ? lista.filter((p) => veiculoCompativel(tipoNecessario, [p.tipo_veiculo || ""]))
      : lista;

    return { sucesso: true, prestadores: filtrados };
  } catch (err: any) {
    console.error("[RedePrestadores] Erro ao buscar prestadores compatíveis:", err);
    return { sucesso: false, erro: err.message };
  }
}

// ============================================================
// 3. Registrar Visualização (App Motorista → Rede)
// ============================================================
export async function registrarVisualizacao(
  oportunidadeId: string,
  prestadorId: string
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { error } = await supabase.from("rede_visualizacoes").upsert(
      [{
        oportunidade_id: oportunidadeId,
        prestador_id: prestadorId,
        status: "visualizada",
      }],
      { onConflict: "oportunidade_id, prestador_id", ignoreDuplicates: false }
    );

    if (error) throw error;

    // Atualizar status da oportunidade
    await supabase
      .from("rede_oportunidades")
      .update({ status: "visualizada" })
      .eq("id", oportunidadeId)
      .eq("status", "publicada");

    return { sucesso: true };
  } catch (err: any) {
    console.error("[RedePrestadores] Erro ao registrar visualização:", err);
    return { sucesso: false, erro: err.message };
  }
}

// ============================================================
// 4. Demonstrar Interesse
// ============================================================
export async function demonstrarInteresse(
  oportunidadeId: string,
  prestadorId: string
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { error } = await supabase.from("rede_visualizacoes").upsert(
      [{
        oportunidade_id: oportunidadeId,
        prestador_id: prestadorId,
        status: "interessada",
      }],
      { onConflict: "oportunidade_id, prestador_id", ignoreDuplicates: false }
    );

    if (error) throw error;

    return { sucesso: true };
  } catch (err: any) {
    console.error("[RedePrestadores] Erro ao registrar interesse:", err);
    return { sucesso: false, erro: err.message };
  }
}

// ============================================================
// 5. Aceitar Oportunidade (ponto único de aceite)
// ============================================================
export async function aceitarOportunidade(
  oportunidadeId: string,
  prestadorId: string
): Promise<{
  sucesso: boolean;
  os_id?: string;
  erro?: string;
}> {
  try {
    // Chamar a RPC do banco para garantir atomicidade
    const { data, error } = await supabase
      .rpc("f_aceitar_oportunidade_rede", {
        p_oportunidade_id: oportunidadeId,
        p_prestador_id: prestadorId,
      });

    if (error) throw error;

    if (!data.sucesso) {
      return { sucesso: false, erro: data.erro };
    }

    const osId = data.os_id;
    const prestadorNome = data.prestador_nome || "";

    // Sincronizar com Escala (cria/atualiza alocação)
    try {
      const { data: osData } = await supabase
        .from("ordens_servico")
        .select("*")
        .eq("id", osId)
        .single();

      if (osData) {
        await sincronizarComEscala({
          ...osData,
          id: osData.id,
          prestador_id: prestadorId,
          status: osData.status || "agendada",
        });
      }
    } catch (syncErr: any) {
      console.warn("[RedePrestadores] Escala sync warning:", syncErr.message);
    }

    // Gerar link de rastreio
    try {
      await gerarLinkRastreio(osId);
    } catch {
      // Não crítico
    }

    return {
      sucesso: true,
      os_id: osId,
    };
  } catch (err: any) {
    console.error("[RedePrestadores] Erro ao aceitar oportunidade:", err);
    return { sucesso: false, erro: err.message };
  }
}

// ============================================================
// 6. Cancelar Oportunidade
// ============================================================
export async function cancelarOportunidade(
  oportunidadeId: string
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { data: op } = await supabase
      .from("rede_oportunidades")
      .select("os_id, status")
      .eq("id", oportunidadeId)
      .single();

    if (!op) return { sucesso: false, erro: "Oportunidade não encontrada" };

    if (op.status === "aceita") {
      return { sucesso: false, erro: "Oportunidade já aceita não pode ser cancelada" };
    }

    await supabase
      .from("rede_oportunidades")
      .update({ status: "cancelada" })
      .eq("id", oportunidadeId);

    await supabase.from("os_historico").insert([{
      os_id: op.os_id,
      acao: "Oportunidade da Rede cancelada",
      usuario: "Sistema Rede",
    }]);

    return { sucesso: true };
  } catch (err: any) {
    console.error("[RedePrestadores] Erro ao cancelar oportunidade:", err);
    return { sucesso: false, erro: err.message };
  }
}

// ============================================================
// 7. Listar Oportunidades (TMS)
// ============================================================
export async function listarOportunidades(
  filtros: {
    status?: RedeOportunidadeStatus | RedeOportunidadeStatus[];
    os_id?: string;
    prestador_id?: string;
  } = {}
): Promise<{ sucesso: boolean; oportunidades?: RedeOportunidade[]; erro?: string }> {
  try {
    let query = supabase
      .from("rede_oportunidades")
      .select(`
        *,
        ordens_servico:os_id (
          numero,
          cliente,
          status,
          tipo_operacao,
          data_programada
        )
      `)
      .order("created_at", { ascending: false });

    if (filtros.status) {
      const statuses = Array.isArray(filtros.status) ? filtros.status : [filtros.status];
      query = query.in("status", statuses);
    }
    if (filtros.os_id) {
      query = query.eq("os_id", filtros.os_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { sucesso: true, oportunidades: data || [] };
  } catch (err: any) {
    console.error("[RedePrestadores] Erro ao listar oportunidades:", err);
    return { sucesso: false, erro: err.message };
  }
}

// ============================================================
// 8. Listar Oportunidades para Prestador (App Motorista)
// ============================================================
export async function listarOportunidadesParaPrestador(
  prestadorId: string
): Promise<{
  sucesso: boolean;
  oportunidades?: (RedeOportunidade & { os?: Record<string, any> })[];
  erro?: string;
}> {
  try {
    // Buscar dados do prestador para filtrar (inclui status/liberado_app para gate)
    const { data: prestador } = await supabase
      .from("prestadores")
      .select("status, liberado_app, regiao_principal, regioes_secundarias, aceita_refrigerada, veiculo_tipo, veiculos")
      .eq("id", prestadorId)
      .single();

    if (!prestador) {
      return { sucesso: false, erro: "Prestador não encontrado" };
    }

    // AG-07J.14.2 — GATE DE ELEGIBILIDADE OPERACIONAL NA LISTAGEM
    // Reusa a função pura homologada (sem duplicar lógica).
    // O aceite/backend continua sendo a autoridade final.
    const { prestadorOperacionalmenteElegivelDados } = await import(
      "@/services/escala/eligibilidadeOperacionalService"
    );
    const gateBase = prestadorOperacionalmenteElegivelDados({
      status: prestador.status,
      liberado_app: prestador.liberado_app,
    });
    if (!gateBase.elegivel) {
      return { sucesso: true, oportunidades: [] };
    }

    // Gate documental best-effort (fail-open se schema indisponível).
    const { verificarElegibilidadeDocumental } = await import(
      "@/services/escala/eligibilidadeOperacionalService"
    );
    const gateDoc = await verificarElegibilidadeDocumental(prestadorId);
    if (!gateDoc.elegivel) {
      return { sucesso: true, oportunidades: [] };
    }

    // Buscar oportunidades publicadas com dados da OS
    const { data, error } = await supabase
      .from("rede_oportunidades")
      .select(`
        id,
        os_id,
        status,
        valor_prestador,
        veiculo_necessario,
        regiao,
        prazo_expiracao,
        created_at,
        ordens_servico:os_id (
          numero,
          tipo_operacao,
          data_programada,
          carga_tipo,
          peso,
          volumes,
          enderecos
        )
      `)
      .eq("status", "publicada")
      .gte("prazo_expiracao", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Filtrar por compatibilidade no frontend (além do filtro do banco)
    const oportunidadesFiltradas = (data || []).filter((op: any) => {
      const veiculo = op.veiculo_necessario || {};

      // Verificar região
      if (op.regiao && prestador.regiao_principal) {
        const regiaoOp = op.regiao.toLowerCase();
        const regiaoPrest = prestador.regiao_principal.toLowerCase();
        const regioesSec = (prestador.regioes_secundarias || []) as string[];

        if (!regiaoPrest.includes(regiaoOp) &&
            !regioesSec.some((r: string) => r.toLowerCase().includes(regiaoOp))) {
          return false;
        }
      }

      // Verificar refrigerado
      if (veiculo.termica === "refrigerado" && !prestador.aceita_refrigerada) {
        return false;
      }

      // ETAPA-2: compatibilidade RIGOROSA por tipo de veículo.
      // OS de moto aparece APENAS para prestadores com moto, e assim por diante.
      // Prestador sem veículo declarado não recebe a oportunidade.
      const tiposPrestador = tiposVeiculoDoPrestador(prestador);
      if (!veiculoCompativel(veiculo.tipo, tiposPrestador)) return false;

      return true;
    });

    return { sucesso: true, oportunidades: oportunidadesFiltradas };
  } catch (err: any) {
    console.error("[RedePrestadores] Erro ao listar para prestador:", err);
    return { sucesso: false, erro: err.message };
  }
}

// ============================================================
// 9. Obter Oportunidade por ID
// ============================================================
export async function obterOportunidade(
  oportunidadeId: string
): Promise<{ sucesso: boolean; oportunidade?: RedeOportunidade; erro?: string }> {
  try {
    const { data, error } = await supabase
      .from("rede_oportunidades")
      .select("*")
      .eq("id", oportunidadeId)
      .single();

    if (error) throw error;
    return { sucesso: true, oportunidade: data };
  } catch (err: any) {
    return { sucesso: false, erro: err.message };
  }
}

// ============================================================
// 10. Verificar Status da Oportunidade para uma OS
// ============================================================
export async function obterOportunidadePorOS(
  osId: string
): Promise<{ sucesso: boolean; oportunidade?: RedeOportunidade; erro?: string }> {
  try {
    const { data, error } = await supabase
      .from("rede_oportunidades")
      .select("*")
      .eq("os_id", osId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return { sucesso: true, oportunidade: data || undefined };
  } catch (err: any) {
    return { sucesso: false, erro: err.message };
  }
}

// ============================================================
// Helpers de UI — Mapa de status para exibição
// ============================================================
export const REDE_STATUS_INFO: Record<RedeOportunidadeStatus, { label: string; twClass: string }> = {
  publicada: { label: "Na Rede", twClass: "bg-blue-500 text-white" },
  visualizada: { label: "Visualizada", twClass: "bg-indigo-500 text-white" },
  interessada: { label: "Interessados", twClass: "bg-purple-500 text-white" },
  aceita: { label: "Aceita", twClass: "bg-green-600 text-white" },
  expirada: { label: "Expirada", twClass: "bg-slate-400 text-white" },
  cancelada: { label: "Cancelada", twClass: "bg-red-400 text-white" },
};

export function obterStatusRedeInfo(status: string) {
  return REDE_STATUS_INFO[status as RedeOportunidadeStatus] || {
    label: status,
    twClass: "bg-slate-400 text-white",
  };
}
