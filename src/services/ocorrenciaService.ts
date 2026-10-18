import { supabase } from "@/lib/supabase";
import { atualizarAlocacao } from "@/services/escala/escalaService";

export interface OcorrenciaTMS {
  id: string;
  cliente_id: string | null;
  os_id: string | null;
  tipo: string;
  descricao: string | null;
  prioridade: string;
  status: string;
  created_at: string;
  updated_at: string;
  cliente_nome?: string;
  os_numero?: string;
}

export interface OcorrenciaFiltros {
  busca?: string;
  tipo?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}

export async function listarOcorrencias(filtros?: OcorrenciaFiltros): Promise<OcorrenciaTMS[]> {
  try {
    let query = supabase
      .from("portal_ocorrencias")
      .select(`
        *,
        clientes:cliente_id (nome_fantasia, razao_social),
        ordens_servico!os_id (numero_os)
      `)
      .order("created_at", { ascending: false });

    if (filtros?.busca) {
      query = query.or(`descricao.ilike.%${filtros.busca}%,os_id.ilike.%${filtros.busca}%`);
    }
    if (filtros?.tipo && filtros.tipo !== "todos") {
      query = query.eq("tipo", filtros.tipo);
    }
    if (filtros?.status && filtros.status !== "todos") {
      query = query.eq("status", filtros.status);
    }

    const { data, error } = await query.limit(100);
    if (error) {
      console.warn("[OcorrenciaService] Erro ao listar:", error.message);
      return [];
    }
    if (!data) return [];

    return data.map((o: any) => ({
      id: o.id,
      cliente_id: o.cliente_id,
      os_id: o.os_id,
      tipo: o.tipo || "outro",
      descricao: o.descricao || "",
      prioridade: o.prioridade || "media",
      status: o.status || "aberta",
      created_at: o.created_at,
      updated_at: o.updated_at,
      cliente_nome: o.clientes?.nome_fantasia || o.clientes?.razao_social || "",
      os_numero: o.ordens_servico?.numero_os || "",
    }));
  } catch (err) {
    console.warn("[OcorrenciaService] Exceção ao listar:", err);
    return [];
  }
}

export async function criarOcorrencia(
  dados: {
    tipo: string;
    descricao: string;
    prioridade?: string;
    os_id?: string;
    cliente_id?: string;
  }
): Promise<{ sucesso: boolean; id?: string; erro?: string }> {
  try {
    if (!dados.tipo || !dados.descricao) {
      return { sucesso: false, erro: "Tipo e descrição são obrigatórios" };
    }

    const { data, error } = await supabase
      .from("portal_ocorrencias")
      .insert([{
        tipo: dados.tipo,
        descricao: dados.descricao,
        prioridade: dados.prioridade || "media",
        os_id: dados.os_id || null,
        cliente_id: dados.cliente_id || null,
        status: "aberta",
      }])
      .select("id")
      .single();

    if (error) {
      return { sucesso: false, erro: error.message };
    }
    if (!data) {
      return { sucesso: false, erro: "Erro ao criar ocorrência" };
    }

    const ocorrenciaId = data.id;

    if (dados.os_id) {
      sincronizarAlocacaoPorOS(dados.os_id, "ocorrencia", dados.descricao).catch(() => {});
    }

    return { sucesso: true, id: ocorrenciaId };
  } catch (err: any) {
    return { sucesso: false, erro: err.message || "Erro desconhecido" };
  }
}

export async function atualizarStatusOcorrencia(
  id: string,
  novoStatus: string,
  observacao?: string
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { data: ocorrencia, error: buscaErr } = await supabase
      .from("portal_ocorrencias")
      .select("os_id, status")
      .eq("id", id)
      .single();

    if (buscaErr || !ocorrencia) {
      return { sucesso: false, erro: "Ocorrência não encontrada" };
    }

    const { error } = await supabase
      .from("portal_ocorrencias")
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return { sucesso: false, erro: error.message };
    }

    if (ocorrencia.os_id && novoStatus === "resolvida") {
      const temAbertas = await verificarOcorrenciasAbertasPorOS(ocorrencia.os_id, id);
      if (!temAbertas) {
        sincronizarAlocacaoPorOS(ocorrencia.os_id, "concluida").catch(() => {});
      }
    }

    return { sucesso: true };
  } catch (err: any) {
    return { sucesso: false, erro: err.message || "Erro desconhecido" };
  }
}

async function verificarOcorrenciasAbertasPorOS(osId: string, excluirId?: string): Promise<boolean> {
  try {
    let query = supabase
      .from("portal_ocorrencias")
      .select("id", { count: "exact", head: true })
      .eq("os_id", osId)
      .in("status", ["aberta", "pendente", "em_analise"]);

    if (excluirId) {
      query = query.neq("id", excluirId);
    }

    const { count } = await query;
    return (count || 0) > 0;
  } catch {
    return false;
  }
}

async function sincronizarAlocacaoPorOS(
  osId: string,
  status: "ocorrencia" | "concluida",
  descricao?: string
): Promise<void> {
  try {
    const { data: alocacoes } = await supabase
      .from("alocacoes_escala")
      .select("id, status")
      .eq("ordem_servico_id", osId)
      .not("status", "in", '("concluida","cancelada")');

    if (!alocacoes || alocacoes.length === 0) return;

    for (const aloc of alocacoes) {
      if (status === "ocorrencia") {
        await supabase
          .from("alocacoes_escala")
          .update({
            status: "ocorrencia",
            ocorrencias_descricao: descricao || "",
            updated_at: new Date().toISOString(),
          })
          .eq("id", aloc.id);
      } else if (status === "concluida" && aloc.status === "ocorrencia") {
        await supabase
          .from("alocacoes_escala")
          .update({
            status: "concluida",
            finalizada: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", aloc.id);
      }
    }
  } catch (err) {
    console.warn("[OcorrenciaService] Erro ao sincronizar alocação:", err);
  }
}
