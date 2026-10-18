import { supabase } from "@/lib/supabase";
import * as podMedia from "@/services/comprovantes/podMediaService";

export interface ClienteInfo {
  id: string;
  nome_fantasia?: string;
  razao_social?: string;
  email?: string;
  telefone?: string;
}

export interface EntregaResumo {
  id: string;
  numero: string;
  status: string;
  status_label: string;
  origem_cidade?: string;
  destino_cidade?: string;
  previsao: string;
  created_at: string;
  valor_frete: number;
  peso: number;
  volumes: number;
  mercadoria: string;
  cliente: string;
  sla?: number;
}

export interface FinanceiroResumo {
  id: string;
  fatura: string;
  competencia: string;
  vencimento: string;
  valor: number;
  status: "paga" | "a_vencer" | "vencida";
  os_vinculadas: string[];
}

export interface OcorrenciaResumo {
  id: string;
  tipo: string;
  descricao: string;
  status: string;
  prioridade: string;
  created_at: string;
}

export interface NotificacaoResumo {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  canal: string;
  lida: boolean;
  prioridade: string;
  created_at: string;
}

export interface AvaliacaoResumo {
  id: string;
  nota: number;
  nps: number | null;
  comentario: string;
  canal: string;
  os_id: string | null;
  created_at: string;
}

export interface ComprovanteResumo {
  id: string;
  tipo: string;
  titulo: string;
  url: string | null;
  nome_recebedor: string | null;
  documento_recebedor: string | null;
  data_entrega: string | null;
  created_at: string;
  foto_entrega_url?: string | null;
  foto_canhoto_url?: string | null;
  assinatura_url?: string | null;
  observacao?: string | null;
  prestador_id?: string | null;
  alocacao_id?: string | null;
}

export interface DetalhesEntregaCompleto {
  pod: ComprovanteResumo;
  alocacao: {
    id: string;
    status: string;
    aceite_prestador: boolean;
    data_aceite: string | null;
    finalizada: boolean;
    data_finalizacao: string | null;
    horario_inicio_real: string | null;
    horario_fim_real: string | null;
    comprovante_url: string | null;
    assinatura_url: string | null;
    fotos_entrega: string[] | null;
    observacoes: string | null;
    km_realizados: number | null;
    prestador_nome: string | null;
    origem: string | null;
    destino: string | null;
  } | null;
  ordemServico: {
    id: string;
    numero: string;
    status: string;
    cliente: string | null;
    cliente_id: string | null;
    carga_descricao: string | null;
    valor_cliente: number | null;
    peso: number | null;
    volumes: number | null;
    created_at: string;
    ref_cliente: string | null;
    veiculo_alocado: string | null;
    veiculo_placa: string | null;
    prestador: string | null;
  } | null;
  prestador: {
    id: string;
    nome_completo: string;
    cpf_cnpj: string | null;
    telefone: string | null;
    foto: string | null;
    veiculo_tipo: string | null;
    veiculo_placa: string | null;
  } | null;
  gps: {
    latitude: number | null;
    longitude: number | null;
  };
}



export interface ProtocoloResumo {
  id: string;
  protocolo: string;
  status: string;
  recebedor: string | null;
  horario: string | null;
  created_at: string;
}

export interface RotaResumo {
  id: string;
  nome: string;
  status: string;
  destinos: any[];
  km_estimado: number;
  tempo_estimado_min: number;
  custo_estimado: number;
  created_at: string;
}

export interface EconomiaMetrics {
  totalFaturado: number;
  totalCustos: number;
  economiaLiquida: number;
  economiaVsFrotaPropria: number;
  produtividade: number;
  reducaoCusto: number;
  kmOtimizados: number;
  ocupacaoMedia: number;
  economiaCombustivel: number;
  entregasConsolidadas: number;
  totalEntregas: number;
  metaEconomia: number;
  detalhamento: { label: string; valor: number; descricao?: string }[];
}

export interface DashboardMetrics {
  totalEntregas: number;
  entregasHoje: number;
  emAndamento: number;
  concluidasMes: number;
  atrasadas: number;
  slaMedio: number;
  totalOcorrencias: number;
  totalFaturado: number;
  totalAVencer: number;
  valorMedioEntrega: number;
}

const formatStatus = (s: string | undefined): string => {
  const map: Record<string, string> = {
    programacao: "Programado",
    coleta: "Em Coleta",
    saiu_para_rota: "Saiu para Rota",
    em_rota: "Em Rota",
    entregue: "Entregue",
    atrasada: "Atrasado",
    problema: "Com Problema",
  };
  return map[s || ""] || s || "Pendente";
};

export async function buscarResumoCliente(clienteId?: string, clienteNome?: string): Promise<ClienteInfo | null> {
  try {
    // Prioridade: buscar por ID direto (seguro)
    if (clienteId) {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, razao_social, email, telefone")
        .eq("id", clienteId)
        .maybeSingle();
      if (!error && data) return data;
    }

    // Fallback: busca por nome (legado)
    if (!clienteNome) {
      console.warn("[PortalClienteService] clienteNome não fornecido");
      return null;
    }

    const clienteFiltro = clienteNome.replace(/@.+$/, "").trim();

    const { data, error } = await supabase
      .from("clientes")
      .select("id, nome_fantasia, razao_social, email, telefone")
      .ilike("nome_fantasia", `%${clienteFiltro}%`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[PortalClienteService] Erro ao buscar cliente:", error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao buscar cliente:", error);
    return null;
  }
}

export async function buscarEntregasCliente(
  clienteId?: string,
  clienteNome?: string,
  limit: number = 50
): Promise<EntregaResumo[]> {
  if (!clienteId) return [];
  try {
    const { data, error } = await supabase
      .from("ordens_servico")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("[PortalClienteService] Erro ao buscar entregas:", error.message);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((os) => ({
      id: os.id,
      numero: os.numero || `OS-${os.id.slice(0, 8)}`,
      status: os.status || "programacao",
      status_label: formatStatus(os.status),
      origem_cidade: os.filial_origem || "N/A",
      destino_cidade: os.cidade_destino || os.cliente || "N/A",
      previsao: os.data_previsao || new Date().toISOString(),
      created_at: os.created_at,
      valor_frete: os.valor_cliente || os.valor_frete || 0,
      peso: os.peso || 0,
      volumes: os.volumes || 1,
      mercadoria: os.carga_descricao || os.mercadoria || "Mercadoria",
      cliente: os.cliente || "Cliente",
      sla: 100,
    }));
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao buscar entregas:", error);
    return [];
  }
}

export async function buscarFinanceiroCliente(clienteId?: string): Promise<FinanceiroResumo[]> {
  if (!clienteId) return [];
  try {
    const { data, error } = await supabase
      .from("financeiro_receber")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("data_vencimento", { ascending: false })
      .limit(20);

    if (error) {
      console.warn("[PortalClienteService] Erro ao buscar financeiro:", error.message);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((f) => ({
      id: f.id,
      fatura: f.fatura || `FAT-${f.id.slice(0, 4)}`,
      competencia: f.competencia || new Date().toLocaleString("pt-BR", { month: "2-digit", year: "numeric" }),
      vencimento: f.data_vencimento || f.vencimento,
      valor: f.valor || 0,
      status:
        f.status === "pago" || f.status === "recebido"
          ? "paga"
          : f.status === "vencida"
            ? "vencida"
            : "a_vencer",
      os_vinculadas: [f.os_id?.slice(0, 8) || ""],
    }));
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao buscar financeiro:", error);
    return [];
  }
}

export async function buscarOcorrenciasCliente(clienteId?: string, limit: number = 20): Promise<OcorrenciaResumo[]> {
  if (!clienteId) return [];
  try {
    const { data, error } = await supabase
      .from("portal_ocorrencias")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("[PortalClienteService] Erro ao buscar portal_ocorrencias:", error.message);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((o) => ({
      id: o.id,
      tipo: o.tipo || "outro",
      descricao: o.descricao || "",
      status: o.status || "aberta",
      prioridade: o.prioridade || "media",
      created_at: o.created_at,
    }));
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao buscar portal_ocorrencias:", error);
    return [];
  }
}

export async function buscarDashboardMetrics(
  clienteId?: string,
  clienteNome?: string
): Promise<DashboardMetrics> {
  const defaultMetrics: DashboardMetrics = {
    totalEntregas: 0,
    entregasHoje: 0,
    emAndamento: 0,
    concluidasMes: 0,
    atrasadas: 0,
    slaMedio: 100,
    totalOcorrencias: 0,
    totalFaturado: 0,
    totalAVencer: 0,
    valorMedioEntrega: 0,
  };

  if (!clienteId) return defaultMetrics;

  try {
    const [entregas, financeiro, ocorrencias] = await Promise.all([
      buscarEntregasCliente(clienteId, clienteNome, 100),
      buscarFinanceiroCliente(clienteId),
      buscarOcorrenciasCliente(clienteId),
    ]);

    const hoje = new Date().toDateString();
    const primeiroDiaMes = new Date();
    primeiroDiaMes.setDate(1);

    const entregasHoje = entregas.filter(
      (e) => new Date(e.created_at).toDateString() === hoje
    ).length;

    const emAndamento = entregas.filter(
      (e) => e.status !== "entregue"
    ).length;

    const concluidasMes = entregas.filter(
      (e) =>
        e.status === "entregue" &&
        new Date(e.created_at) >= primeiroDiaMes
    ).length;

    const atrasadas = entregas.filter(
      (e) => e.status === "atrasada"
    ).length;

    const slaMedio =
      entregas.length > 0
        ? Math.round(
            entregas.reduce((acc, e) => acc + (e.sla || 0), 0) / entregas.length
          )
        : 100;

    const totalFaturado = financeiro
      .filter((f) => f.status === "paga")
      .reduce((acc, f) => acc + f.valor, 0);

    const totalAVencer = financeiro
      .filter((f) => f.status === "a_vencer")
      .reduce((acc, f) => acc + f.valor, 0);

    const valorMedioEntrega =
      entregas.length > 0
        ? Math.round(
            entregas.reduce((acc, e) => acc + e.valor_frete, 0) / entregas.length
          )
        : 0;

    return {
      totalEntregas: entregas.length,
      entregasHoje,
      emAndamento,
      concluidasMes,
      atrasadas,
      slaMedio,
      totalOcorrencias: ocorrencias.length,
      totalFaturado,
      totalAVencer,
      valorMedioEntrega,
    };
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao buscar métricas:", error);
    return defaultMetrics;
  }
}

export function gerarInsights(metrics: DashboardMetrics) {
  const insights: Array<{
    type: "economia" | "atraso" | "sla" | "volume" | "alerta";
    title: string;
    description: string;
    priority: "alta" | "media" | "baixa";
    metric?: string;
    suggestion?: string;
  }> = [];

  if (metrics.slaMedio >= 95) {
    insights.push({
      type: "sla",
      title: "SLA Excelente",
      description: "Sua operação está mantendo um nível de serviço acima de 95%.",
      priority: "baixa",
      metric: `${metrics.slaMedio}%`,
    });
  } else if (metrics.slaMedio >= 85) {
    insights.push({
      type: "sla",
      title: "SLA Bom",
      description: "Mantenha o ritmo para garantir satisfação dos seus clientes.",
      priority: "media",
      metric: `${metrics.slaMedio}%`,
    });
  }

  if (metrics.atrasadas > 0) {
    insights.push({
      type: "atraso",
      title: "Atenção: Entregas Atrasadas",
      description: `${metrics.atrasadas} entrega(s) está(ão) com atraso. Revise o status.`,
      priority: "alta",
      suggestion: "Clique em 'Ver detalhes' para acompanhar",
    });
  }

  if (metrics.concluidasMes > 0) {
    insights.push({
      type: "volume",
      title: "Volume do Mês",
      description: `${metrics.concluidasMes} entregas concluídas neste mês.`,
      priority: "baixa",
      metric: `${metrics.concluidasMes}`,
    });
  }

  if (metrics.valorMedioEntrega > 0) {
    insights.push({
      type: "economia",
      title: "Valor Médio por Entrega",
      description: "Média de faturamento por entrega deste cliente.",
      priority: "baixa",
      metric: `R$ ${metrics.valorMedioEntrega.toLocaleString("pt-BR")}`,
    });
  }

  if (metrics.totalOcorrencias > 0) {
    insights.push({
      type: "alerta",
      title: "Ocorrências Registradas",
      description: `${metrics.totalOcorrencias} ocorrência(s) necesita(m) de atenção.`,
      priority: metrics.totalOcorrencias > 3 ? "alta" : "media",
    });
  }

  return insights;
}

// =====================================================
// Novas funções para Portal Cliente Enterprise
// =====================================================

export async function buscarNotificacoesPortal(clienteId?: string, limit: number = 20): Promise<NotificacaoResumo[]> {
  if (!clienteId) return [];
  try {
    const { data, error } = await supabase
      .from("portal_notificacoes")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("[PortalClienteService] Erro ao buscar portal_notificacoes:", error.message);
      return [];
    }

    return data?.map((n) => ({
      id: n.id,
      tipo: n.tipo || "sistema",
      titulo: n.titulo || "",
      mensagem: n.mensagem || "",
      canal: n.canal || "portal",
      lida: n.lida || false,
      prioridade: n.prioridade || "normal",
      created_at: n.created_at,
    })) || [];
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao buscar portal_notificacoes:", error);
    return [];
  }
}

export async function buscarAvaliacoesPortal(clienteId?: string, limit: number = 20): Promise<AvaliacaoResumo[]> {
  if (!clienteId) return [];
  try {
    const { data, error } = await supabase
      .from("portal_avaliacoes")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("[PortalClienteService] Erro ao buscar portal_avaliacoes:", error.message);
      return [];
    }

    return data?.map((a) => ({
      id: a.id,
      nota: a.nota || 0,
      nps: a.nps,
      comentario: a.comentario || "",
      canal: a.canal || "portal",
      os_id: a.os_id,
      created_at: a.created_at,
    })) || [];
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao buscar portal_avaliacoes:", error);
    return [];
  }
}

export async function buscarComprovantesPortal(clienteId?: string, limit: number = 20): Promise<ComprovanteResumo[]> {
  return buscarPODsPorCliente(clienteId, limit);
}

export async function buscarPODsPorCliente(clienteId?: string, limit: number = 20): Promise<ComprovanteResumo[]> {
  try {
    let alocacaoIds: string[] = [];

    if (clienteId) {
      const { data: osData } = await supabase
        .from("ordens_servico")
        .select("id")
        .eq("cliente_id", clienteId)
        .limit(200);

      const osIds = (osData || []).map((o: any) => o.id).filter(Boolean);
      if (osIds.length > 0) {
        const { data: alocData } = await supabase
          .from("alocacoes_escala")
          .select("id")
          .in("ordem_servico_id", osIds);

        alocacaoIds = (alocData || []).map((a: any) => a.id).filter(Boolean);
      }
    }

    let query = supabase
      .from("entregas_protocolo")
      .select("*")
      .order("data_hora_entrega", { ascending: false })
      .limit(limit);

    if (alocacaoIds.length > 0) {
      query = query.in("alocacao_id", alocacaoIds);
    }

    const { data, error } = await query;

    if (error) {
      console.warn("[PortalClienteService] Erro ao buscar entregas_protocolo:", error.message);
      return [];
    }

    const mapped = (data || []).map((ep: any) => ({
      id: ep.id,
      tipo: "entrega",
      titulo: `OS ${ep.alocacao_id?.slice(0, 8) || ""}`,
      url: ep.foto_entrega_url || ep.foto_canhoto_url || null,
      nome_recebedor: ep.nome_recebedor || null,
      documento_recebedor: ep.documento_recebedor || null,
      data_entrega: ep.data_hora_entrega || null,
      created_at: ep.created_at,
      foto_entrega_url: ep.foto_entrega_url,
      foto_canhoto_url: ep.foto_canhoto_url,
      assinatura_url: ep.assinatura_url,
      observacao: ep.observacao,
      prestador_id: ep.prestador_id,
      alocacao_id: ep.alocacao_id,
    }));

    // APP-E2E-11D — resolve mídia privada (driver-evidence) em signed URL.
    return podMedia.resolverMidiasPods(mapped);
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao buscar entregas_protocolo:", error);
    return [];
  }
}

export async function buscarDetalhesEntregaCompleto(podId: string): Promise<DetalhesEntregaCompleto | null> {
  try {
    const { data: pod, error: podErr } = await supabase
      .from("entregas_protocolo")
      .select("*")
      .eq("id", podId)
      .maybeSingle();
    if (podErr || !pod) return null;

    // APP-E2E-11D — resolve mídia privada (driver-evidence) em signed URL.
    const podData: ComprovanteResumo = await podMedia.resolverMidiasPod({
      id: pod.id, tipo: "entrega", titulo: `OS ${pod.alocacao_id?.slice(0, 8) || ""}`,
      url: pod.foto_entrega_url || pod.foto_canhoto_url || null,
      nome_recebedor: pod.nome_recebedor, documento_recebedor: pod.documento_recebedor,
      data_entrega: pod.data_hora_entrega, created_at: pod.created_at,
      foto_entrega_url: pod.foto_entrega_url, foto_canhoto_url: pod.foto_canhoto_url,
      assinatura_url: pod.assinatura_url, observacao: pod.observacao,
      prestador_id: pod.prestador_id, alocacao_id: pod.alocacao_id,
    });

    let alocacao: DetalhesEntregaCompleto["alocacao"] = null;
    let ordemServico: DetalhesEntregaCompleto["ordemServico"] = null;
    let prestador: DetalhesEntregaCompleto["prestador"] = null;
    const gps: DetalhesEntregaCompleto["gps"] = { latitude: pod.latitude || null, longitude: pod.longitude || null };

    if (pod.alocacao_id) {
      const { data: aloc } = await supabase
        .from("alocacoes_escala")
        .select("*")
        .eq("id", pod.alocacao_id)
        .maybeSingle();
      if (aloc) {
        alocacao = {
          id: aloc.id, status: aloc.status, aceite_prestador: aloc.aceite_prestador,
          data_aceite: aloc.data_aceite, finalizada: aloc.finalizada,
          data_finalizacao: aloc.data_finalizacao,
          horario_inicio_real: aloc.horario_inicio_real,
          horario_fim_real: aloc.horario_fim_real,
          comprovante_url: aloc.comprovante_url, assinatura_url: aloc.assinatura_url,
          fotos_entrega: aloc.fotos_entrega, observacoes: aloc.observacoes,
          km_realizados: aloc.km_realizados, prestador_nome: aloc.prestador_nome,
          origem: aloc.origem, destino: aloc.destino,
        };

        if (aloc.ordem_servico_id) {
          const { data: os } = await supabase
            .from("ordens_servico")
            .select("*")
            .eq("id", aloc.ordem_servico_id)
            .maybeSingle();
          if (os) {
            ordemServico = {
              id: os.id, numero: os.numero, status: os.status,
              cliente: os.cliente, cliente_id: os.cliente_id,
              carga_descricao: os.carga_descricao, valor_cliente: os.valor_cliente,
              peso: os.peso, volumes: os.volumes, created_at: os.created_at,
              ref_cliente: os.ref_cliente, veiculo_alocado: os.veiculo_alocado,
              veiculo_placa: os.veiculo_placa, prestador: os.prestador,
            };
          }
        }

        if (aloc.prestador_id) {
          const { data: prov } = await supabase
            .from("prestadores")
            .select("id, nome_completo, cpf_cnpj, telefone, foto")
            .eq("id", aloc.prestador_id)
            .maybeSingle();
          if (prov) {
            let veiculo_tipo: string | null = null;
            let veiculo_placa: string | null = null;
            const { data: veic } = await supabase
              .from("veiculos")
              .select("placa, tipo")
              .eq("prestadorVinculado", prov.id)
              .limit(1)
              .maybeSingle();
            if (veic) {
              veiculo_tipo = veic.tipo;
              veiculo_placa = veic.placa;
            }
            prestador = {
              id: prov.id, nome_completo: prov.nome_completo,
              cpf_cnpj: prov.cpf_cnpj, telefone: prov.telefone, foto: prov.foto,
              veiculo_tipo, veiculo_placa,
            };
          }
        }
      }
    }

    // APP-E2E-11D — resolve também mídias da alocação (mesmo bucket privado).
    const alocacaoResolvida = alocacao
      ? {
          ...alocacao,
          comprovante_url: await podMedia.resolverMidiaPod(alocacao.comprovante_url),
          assinatura_url: await podMedia.resolverMidiaPod(alocacao.assinatura_url),
          fotos_entrega: alocacao.fotos_entrega
            ? (await Promise.all(alocacao.fotos_entrega.map((u) => podMedia.resolverMidiaPod(u))))
                .filter((u): u is string => !!u)
            : alocacao.fotos_entrega,
        }
      : null;

    return { pod: podData, alocacao: alocacaoResolvida, ordemServico, prestador, gps };
  } catch (e) {
    console.warn("[PortalCliente] buscarDetalhesEntregaCompleto erro:", e);
    return null;
  }
}



export async function buscarProtocolosPortal(clienteId?: string, limit: number = 20): Promise<ProtocoloResumo[]> {
  if (!clienteId) return [];
  try {
    const { data, error } = await supabase
      .from("portal_protocolos")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("[PortalClienteService] Erro ao buscar portal_protocolos:", error.message);
      return [];
    }

    return data?.map((p) => ({
      id: p.id,
      protocolo: p.protocolo || "",
      status: p.status || "pendente",
      recebedor: p.recebedor,
      horario: p.horario,
      created_at: p.created_at,
    })) || [];
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao buscar portal_protocolos:", error);
    return [];
  }
}

export async function buscarRotasPortal(clienteId?: string, limit: number = 20): Promise<RotaResumo[]> {
  if (!clienteId) return [];
  try {
    const { data, error } = await supabase
      .from("portal_rotas")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("[PortalClienteService] Erro ao buscar portal_rotas:", error.message);
      return [];
    }

    return data?.map((r) => ({
      id: r.id,
      nome: r.nome || "",
      status: r.status || "rascunho",
      destinos: r.destinos || [],
      km_estimado: r.km_estimado || 0,
      tempo_estimado_min: r.tempo_estimado_min || 0,
      custo_estimado: r.custo_estimado || 0,
      created_at: r.created_at,
    })) || [];
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao buscar portal_rotas:", error);
    return [];
  }
}

export async function criarNotificacaoPortal(notificacao: Partial<NotificacaoResumo>, clienteId?: string): Promise<boolean> {
  if (!clienteId) return false;
  try {
    const { error } = await supabase
      .from("portal_notificacoes")
      .insert([{
        cliente_id: clienteId,
        tipo: notificacao.tipo || "sistema",
        titulo: notificacao.titulo || "",
        mensagem: notificacao.mensagem || "",
        canal: notificacao.canal || "portal",
        lida: false,
        prioridade: notificacao.prioridade || "normal",
      }]);

    if (error) {
      console.warn("[PortalClienteService] Erro ao criar portal_notificacoes:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao criar portal_notificacoes:", error);
    return false;
  }
}

export async function criarOcorrenciaPortal(ocorrencia: Partial<OcorrenciaResumo>, clienteId?: string): Promise<{ sucesso: boolean; id?: string }> {
  if (!clienteId) return { sucesso: false };
  try {
    const { data, error } = await supabase
      .from("portal_ocorrencias")
      .insert([{
        cliente_id: clienteId,
        tipo: ocorrencia.tipo || "outro",
        descricao: ocorrencia.descricao || "",
        prioridade: ocorrencia.prioridade || "media",
        status: "aberta",
      }])
      .select("id")
      .single();

    if (error) {
      console.warn("[PortalClienteService] Erro ao criar portal_ocorrencias:", error.message);
      return { sucesso: false };
    }
    return { sucesso: true, id: data?.id };
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao criar portal_ocorrencias:", error);
    return { sucesso: false };
  }
}

export async function criarAvaliacaoPortal(avaliacao: Partial<AvaliacaoResumo>, clienteId?: string): Promise<boolean> {
  if (!clienteId) return false;
  if (!avaliacao.nota || avaliacao.nota < 1 || avaliacao.nota > 5) {
    console.warn("[PortalClienteService] Nota inválida para avaliação");
    return false;
  }
  try {
    const { error } = await supabase
      .from("portal_avaliacoes")
      .insert([{
        cliente_id: clienteId,
        nota: avaliacao.nota,
        comentario: avaliacao.comentario || "",
        canal: avaliacao.canal || "portal",
        os_id: avaliacao.os_id,
        nps: avaliacao.nota >= 4 ? 1 : avaliacao.nota <= 2 ? -1 : 0,
      }]);

    if (error) {
      console.warn("[PortalClienteService] Erro ao criar portal_avaliacoes:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao criar portal_avaliacoes:", error);
    return false;
  }
}

function getPeriodoFilter(periodo: string): { inicio: string; fim: string } {
  const agora = new Date();
  const fim = agora.toISOString();
  let inicio: string;
  switch (periodo) {
    case "hoje":
      inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();
      break;
    case "7dias":
      inicio = new Date(agora.getTime() - 7 * 86400000).toISOString();
      break;
    case "30dias":
      inicio = new Date(agora.getTime() - 30 * 86400000).toISOString();
      break;
    case "mes_atual":
      inicio = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
      break;
    default:
      inicio = new Date(agora.getTime() - 30 * 86400000).toISOString();
  }
  return { inicio, fim };
}

export async function buscarEconomiaCliente(
  clienteId?: string,
  periodo: string = "30dias"
): Promise<EconomiaMetrics | null> {
  if (!clienteId) return null;
  try {
    const { inicio, fim } = getPeriodoFilter(periodo);

    const [financeiroData, custosData, osData, alocacoesData] = await Promise.all([
      supabase
        .from("financeiro_receber")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("data_vencimento", { ascending: false })
        .limit(200),
      supabase
        .from("pagamentos_prestadores")
        .select("id, valor_servicos, valor_liquido, valor, valor_adicionais, valor_combustivel, os_id, created_at, cliente_id")
        .eq("cliente_id", clienteId)
        .gte("created_at", inicio)
        .lte("created_at", fim)
        .limit(200),
      supabase
        .from("ordens_servico")
        .select("id, status, valor_cliente, peso, volumes, created_at, cliente_id")
        .eq("cliente_id", clienteId)
        .gte("created_at", inicio)
        .lte("created_at", fim)
        .limit(200),
      supabase
        .from("alocacoes_escala")
        .select("id, ordem_servico_id, km_realizados, valor_frete, valor_repasse, status, created_at")
        .eq("cliente_id", clienteId)
        .gte("created_at", inicio)
        .lte("created_at", fim)
        .limit(200),
    ]);

    const faturas = financeiroData.data || [];
    const custos = custosData.data || [];
    const ordens = osData.data || [];
    const alocacoes = alocacoesData.data || [];

    const totalFaturado = faturas
      .filter((f: any) => f.status === "pago" || f.status === "recebido")
      .reduce((acc: number, f: any) => acc + (f.valor || 0), 0);

    const totalFaturarPendente = faturas
      .filter((f: any) => f.status === "a_vencer" || f.status === "aberto" || f.status === "pendente")
      .reduce((acc: number, f: any) => acc + (f.valor || 0), 0);

    const totalCustos = custos.reduce((acc: number, c: any) => {
      return acc + (c.valor_servicos || c.valor_liquido || c.valor || 0);
    }, 0);

    const custosExtras = custos.reduce((acc: number, c: any) => {
      return acc + (c.valor_adicionais || 0) + (c.valor_combustivel || 0);
    }, 0);

    const totalEntregas = ordens.length;
    const entregasConsolidadas = ordens.filter(
      (o: any) => o.status === "entregue" || o.status === "finalizada" || o.status === "concluida"
    ).length;

    const kmOtimizados = alocacoes.reduce((acc: number, a: any) => acc + (a.km_realizados || 0), 0);

    const totalPeso = ordens.reduce((acc: number, o: any) => acc + (o.peso || 0), 0);
    const totalVolumes = ordens.reduce((acc: number, o: any) => acc + (o.volumes || 0), 0);
    const ocupacaoMedia = totalEntregas > 0 && totalVolumes > 0
      ? Math.min(Math.round((totalPeso / (totalVolumes * 500)) * 100), 100)
      : 0;

    const produtividade = totalEntregas > 0
      ? Math.round((entregasConsolidadas / totalEntregas) * 100)
      : 0;

    const frotaPropriaEstimativa = totalFaturado > 0
      ? totalFaturado * 1.30
      : totalCustos * 1.30;

    const economiaVsFrotaPropria = frotaPropriaEstimativa - (totalFaturado > 0 ? totalFaturado : totalCustos);

    const reducaoCusto = frotaPropriaEstimativa > 0
      ? Math.round((economiaVsFrotaPropria / frotaPropriaEstimativa) * 100 * 10) / 10
      : 0;

    const economiaCombustivel = Math.round(kmOtimizados * 0.45);

    const economiaLiquida = (totalFaturado > 0 ? totalFaturado : totalFaturarPendente) - (totalCustos > 0 ? totalCustos : 0);

    const metaEconomia = totalFaturado > 0
      ? Math.round(totalFaturado * 0.25)
      : totalFaturarPendente > 0
        ? Math.round(totalFaturarPendente * 0.25)
        : 15000;

    const detalhamento = [
      { label: "Custos operacionais (frete)", valor: Math.round(totalCustos), descricao: "Valor pago aos transportadores" },
      { label: "Economia vs frota própria", valor: Math.round(economiaVsFrotaPropria), descricao: "Comparativo com operação própria" },
      { label: "Otimização de rotas", valor: Math.round(kmOtimizados * 1.5), descricao: `${kmOtimizados} km otimizados` },
      { label: "Economia combustível", valor: Math.round(economiaCombustivel), descricao: "Redução no consumo de diesel" },
    ];

    return {
      totalFaturado,
      totalCustos: Math.round(totalCustos),
      economiaLiquida: Math.round(economiaLiquida),
      economiaVsFrotaPropria: Math.round(economiaVsFrotaPropria),
      produtividade,
      reducaoCusto,
      kmOtimizados: Math.round(kmOtimizados),
      ocupacaoMedia,
      economiaCombustivel,
      entregasConsolidadas,
      totalEntregas,
      metaEconomia,
      detalhamento,
    };
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao buscar economia:", error);
    return null;
  }
}

export interface ExecutiveDashboardData {
  slaGeral: number;
  slaMeta: number;
  produtividade: number;
  economiaOperacional: number;
  volumeTransportado: number;
  totalEntregas: number;
  entregasConcluidas: number;
  entregasAtrasadas: number;
  entregasHoje: number;
  emAndamento: number;
  devolucoes: number;
  devolucoesMeta: number;
  urgencias: number;
  valorMedioEntrega: number;
  tendencia7dias: number;
  tendencia30dias: number;
  previsaoProxSemana: number;
  comparativoMensal: { mes: string; atual: number; anterior: number }[];
  performanceFiliais: { filial: string; entregas: number; concluidas: number; sla: number }[];
  custoPorRegiao: { regiao: string; custo: number; entregas: number }[];
  distribuicaoStatus: { status: string; quantidade: number }[];
  tendenciaOperacional: "crescendo" | "estavel" | "declinando";
}

export async function buscarExecutiveDashboard(clienteId?: string): Promise<ExecutiveDashboardData | null> {
  if (!clienteId) return null;
  try {
    const agora = new Date();
    const fim = agora.toISOString();
    const inicio60dias = new Date(agora.getTime() - 60 * 86400000).toISOString();
    const inicio30dias = new Date(agora.getTime() - 30 * 86400000).toISOString();
    const inicio7dias = new Date(agora.getTime() - 7 * 86400000).toISOString();

    const [osData, alocData, finData, ocorrData] = await Promise.all([
      supabase
        .from("ordens_servico")
        .select("id, status, valor_cliente, peso, volumes, created_at, cliente_id, origem, cliente")
        .eq("cliente_id", clienteId)
        .gte("data", inicio60dias)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("alocacoes_escala")
        .select("id, ordem_servico_id, km_realizados, valor_repasse, status, origem, destino, created_at")
        .eq("cliente_id", clienteId)
        .gte("created_at", inicio60dias)
        .limit(500),
      supabase
        .from("financeiro_receber")
        .select("valor, status, data_vencimento")
        .eq("cliente_id", clienteId)
        .gte("data_vencimento", inicio60dias)
        .limit(200),
      supabase
        .from("portal_ocorrencias")
        .select("id, tipo, status")
        .eq("cliente_id", clienteId)
        .eq("status", "aberta")
        .limit(100),
    ]);

    const ordens = osData.data || [];
    const alocacoes = alocData.data || [];
    const financeiro = finData.data || [];
    const ocorrencias = ocorrData.data || [];

    const totalEntregas = ordens.length;
    const entregasConcluidas = ordens.filter(
      (o: any) => o.status === "entregue" || o.status === "finalizada" || o.status === "concluida"
    ).length;
    const entregasAtrasadas = ordens.filter((o: any) => o.status === "atrasada").length;
    const emAndamento = ordens.filter(
      (o: any) => o.status !== "entregue" && o.status !== "finalizada" && o.status !== "concluida" && o.status !== "cancelada"
    ).length;

    const entregasHoje = ordens.filter(
      (o: any) => new Date(o.created_at).toDateString() === agora.toDateString()
    ).length;

    const slaGeral = totalEntregas > 0
      ? Math.round(((totalEntregas - entregasAtrasadas) / totalEntregas) * 100 * 10) / 10
      : 0;
    const slaMeta = 95;
    const produtividade = totalEntregas > 0
      ? Math.round((entregasConcluidas / totalEntregas) * 100 * 10) / 10
      : 0;

    const totalFaturado = financeiro
      .filter((f: any) => f.status === "pago" || f.status === "recebido")
      .reduce((acc: number, f: any) => acc + (f.valor || 0), 0);
    const totalAVencer = financeiro
      .filter((f: any) => f.status === "a_vencer" || f.status === "aberto")
      .reduce((acc: number, f: any) => acc + (f.valor || 0), 0);

    const custoTotal = alocacoes.reduce((acc: number, a: any) => acc + (a.valor_repasse || 0), 0);
    const economiaOperacional = totalFaturado > 0 ? totalFaturado - custoTotal : totalAVencer;

    const volumeTransportado = ordens.reduce((acc: number, o: any) => acc + (o.peso || 0), 0);
    const valorMedioEntrega = totalEntregas > 0
      ? Math.round((totalFaturado > 0 ? totalFaturado : totalAVencer) / totalEntregas)
      : 0;

    const devolucoes = totalEntregas > 0
      ? Math.round((entregasAtrasadas / totalEntregas) * 100 * 10) / 10
      : 0;
    const devolucoesMeta = 5;
    const urgencias = ocorrencias.length;

    // Monthly comparison
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();
    const ordensPorMes: Record<string, { atual: number; anterior: number }> = {};

    for (const os of ordens) {
      const d = new Date(os.created_at);
      const chave = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "").toLowerCase();
      if (!ordensPorMes[chave]) ordensPorMes[chave] = { atual: 0, anterior: 0 };
      if (d.getMonth() === mesAtual && d.getFullYear() === anoAtual) {
        ordensPorMes[chave].atual++;
      } else {
        ordensPorMes[chave].anterior++;
      }
    }

    const meses = Object.keys(ordensPorMes).slice(-6);
    const comparativoMensal = meses.map((mes) => ({
      mes: mes.charAt(0).toUpperCase() + mes.slice(1),
      atual: ordensPorMes[mes].atual,
      anterior: ordensPorMes[mes].anterior,
    }));

    // Filial performance (group by origem)
    const filialMap: Record<string, { entregas: number; concluidas: number }> = {};
    for (const os of ordens) {
      const filial = (os as any).origem || "Sem origem";
      if (!filialMap[filial]) filialMap[filial] = { entregas: 0, concluidas: 0 };
      filialMap[filial].entregas++;
      if (os.status === "entregue" || os.status === "finalizada" || os.status === "concluida") {
        filialMap[filial].concluidas++;
      }
    }
    const performanceFiliais = Object.entries(filialMap).map(([filial, dados]) => ({
      filial,
      entregas: dados.entregas,
      concluidas: dados.concluidas,
      sla: dados.entregas > 0 ? Math.round((dados.concluidas / dados.entregas) * 100) : 0,
    }));

    // Cost by region
    const regiaoMap: Record<string, { custo: number; entregas: number }> = {};
    for (const a of alocacoes) {
      const regiao = (a as any).destino || "Sem região";
      if (!regiaoMap[regiao]) regiaoMap[regiao] = { custo: 0, entregas: 0 };
      regiaoMap[regiao].custo += (a as any).valor_repasse || 0;
      regiaoMap[regiao].entregas++;
    }
    const custoPorRegiao = Object.entries(regiaoMap).map(([regiao, dados]) => ({
      regiao,
      custo: Math.round(dados.custo),
      entregas: dados.entregas,
    }));

    // Status distribution
    const statusMap: Record<string, number> = {};
    for (const os of ordens) {
      const st = os.status || "indefinido";
      statusMap[st] = (statusMap[st] || 0) + 1;
    }
    const distribuicaoStatus = Object.entries(statusMap).map(([status, quantidade]) => ({
      status,
      quantidade,
    }));

    const ordens30dias = ordens.filter((o: any) => new Date(o.created_at) >= new Date(inicio30dias)).length;
    const ordens7dias = ordens.filter((o: any) => new Date(o.created_at) >= new Date(inicio7dias)).length;
    const ordens30diasAnterior = ordens.filter(
      (o: any) => new Date(o.created_at) >= new Date(agora.getTime() - 60 * 86400000)
        && new Date(o.created_at) < new Date(inicio30dias)
    ).length;

    const tendencia30dias = ordens30diasAnterior > 0
      ? Math.round(((ordens30dias - ordens30diasAnterior) / ordens30diasAnterior) * 100 * 10) / 10
      : 0;

    const mediaDiaria7dias = ordens7dias / 7;
    const previsaoProxSemana = Math.round(mediaDiaria7dias * 7);

    const tendenciaOperacional = tendencia30dias > 5 ? "crescendo" : tendencia30dias < -5 ? "declinando" : "estavel";

    return {
      slaGeral,
      slaMeta,
      produtividade,
      economiaOperacional: Math.round(economiaOperacional),
      volumeTransportado: Math.round(volumeTransportado),
      totalEntregas,
      entregasConcluidas,
      entregasAtrasadas,
      entregasHoje,
      emAndamento,
      devolucoes,
      devolucoesMeta,
      urgencias,
      valorMedioEntrega,
      tendencia7dias: Math.round(((ordens7dias - ordens30diasAnterior / 4.28) / (ordens30diasAnterior / 4.28)) * 100) / 100 || 0,
      tendencia30dias,
      previsaoProxSemana,
      comparativoMensal,
      performanceFiliais,
      custoPorRegiao,
      distribuicaoStatus,
      tendenciaOperacional,
    };
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao buscar executive dashboard:", error);
    return null;
  }
}

export async function marcarNotificacaoLida(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("portal_notificacoes")
      .update({ lida: true })
      .eq("id", id);

    if (error) {
      console.warn("[PortalClienteService] Erro ao marcar notificação como lida:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao marcar notificação como lida:", error);
    return false;
  }
}

// =====================================================
// MISSÃO 108-L3 — IA Operacional Real
// =====================================================

export interface InsightOperacional {
  id: string;
  tipo: "alerta" | "previsao" | "sugestao" | "insight";
  titulo: string;
  descricao: string;
  prioridade: "critica" | "alta" | "media" | "informativa";
  origem: string;
  motivo: string;
  impacto: string;
  operacao_id?: string;
  data_hora: string;
  acao?: string;
  metric?: string;
  regiao?: string;
}

export interface SaudeOperacionalReal {
  score: number;
  status: "saudavel" | "atencao" | "critico";
  sla: number;
  totalEntregas: number;
  atrasos: number;
  ocorrencias: number;
  devolucoes: number;
  tendencia: "subindo" | "estavel" | "caindo";
  ocupacao: number;
}

interface FiltrosInsight {
  periodo?: string;
  contrato?: string;
  filial?: string;
  operacao?: string;
  regiao?: string;
}

function getPeriodoISO(periodo: string): { inicio: string; fim: string } {
  const agora = new Date();
  const fim = agora.toISOString();
  let inicio: Date;
  switch (periodo) {
    case "7dias": inicio = new Date(agora.getTime() - 7 * 86400000); break;
    case "30dias": inicio = new Date(agora.getTime() - 30 * 86400000); break;
    case "mes_atual": inicio = new Date(agora.getFullYear(), agora.getMonth(), 1); break;
    default: inicio = new Date(agora.getTime() - 30 * 86400000);
  }
  return { inicio: inicio.toISOString(), fim };
}

export async function gerarInsightsOperacionais(
  clienteId: string,
  filtros?: FiltrosInsight
): Promise<{ saude: SaudeOperacionalReal; insights: InsightOperacional[] }> {
  const { inicio, fim } = getPeriodoISO(filtros?.periodo || "30dias");
  const insights: InsightOperacional[] = [];
  const agora = new Date();

  const [osResponse, alocResponse, ocorrResponse, protocoloResponse, vwResponse, contratoResponse] = await Promise.all([
    supabase
      .from("ordens_servico")
      .select("id, numero, status, created_at, data, cliente_id, filial_origem, origem, destino, cidade_destino")
      .eq("cliente_id", clienteId)
      .gte("created_at", inicio)
      .lte("created_at", fim)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("alocacoes_escala")
      .select("id, ordem_servico_id, status, km_realizados, destino, origem, created_at, comprovante_url, assinatura_url, tipo_reversa, reversa_status, finalizada")
      .eq("cliente_id", clienteId)
      .gte("created_at", inicio)
      .lte("created_at", fim)
      .limit(300),
    supabase
      .from("portal_ocorrencias")
      .select("id, tipo, descricao, status, prioridade, created_at, os_id")
      .eq("cliente_id", clienteId)
      .gte("created_at", inicio)
      .lte("created_at", fim)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("entregas_protocolo")
      .select("id, alocacao_id, data_hora_entrega, nome_recebedor, foto_entrega_url, assinatura_url, foto_canhoto_url")
      .gte("created_at", inicio)
      .lte("created_at", fim)
      .limit(300),
    supabase
      .from("vw_noc_operacional")
      .select("alocacao_id, status_operacao, sla_status, alerta, tem_pod, reversa_status, motorista_nome, tracking_velocidade, tracking_ultima_atualizacao, destino, origem")
      .eq("cliente_id", clienteId)
      .limit(200),
    supabase
      .from("contratos_operacao")
      .select("id, numero, cliente_id, data_inicio, data_fim, ativo, frequencia")
      .eq("cliente_id", clienteId)
      .eq("ativo", true)
      .limit(50),
  ]);

  const ordens = osResponse.data || [];
  const alocacoes = alocResponse.data || [];
  const ocorrencias = ocorrResponse.data || [];
  const protocolos = protocoloResponse.data || [];
  const vwData = vwResponse.data || [];
  const contratos = contratoResponse.data || [];

  // Apply additional filters
  let filteredOrdens = ordens;
  let filteredAlocacoes = alocacoes;
  if (filtros?.operacao) {
    filteredOrdens = ordens.filter((o: any) => o.id === filtros.operacao || o.numero === filtros.operacao);
  }
  if (filtros?.filial) {
    filteredOrdens = filteredOrdens.filter((o: any) => (o.filial_origem || "").toLowerCase() === filtros!.filial!.toLowerCase());
  }
  if (filtros?.regiao) {
    filteredAlocacoes = alocacoes.filter((a: any) => (a.destino || "").toLowerCase().includes(filtros!.regiao!.toLowerCase()));
  }

  // Apply filter to vwData by regiao
  let filteredVw = vwData;
  if (filtros?.regiao) {
    filteredVw = vwData.filter((v: any) => (v.destino || "").toLowerCase().includes(filtros!.regiao!.toLowerCase()));
  }

  // Build OS ID set
  const osIdsSet = new Set(filteredOrdens.map((o: any) => o.id));
  const alocOsMap = new Map<string, any>();
  for (const a of filteredAlocacoes) {
    if (a.ordem_servico_id) alocOsMap.set(a.ordem_servico_id, a);
  }

  // ============================================================
  // INSIGHT 1 — Operações Atrasadas (CRÍTICA)
  // ============================================================
  const atrasadas = (filteredOrdens as any[]).filter((o: any) => o.status === "atrasada");
  if (atrasadas.length > 0) {
    const ids = atrasadas.slice(0, 5).map((o: any) => o.id);
    insights.push({
      id: `atrasadas-${agora.getTime()}`,
      tipo: "alerta",
      titulo: `${atrasadas.length} operação(ões) em atraso`,
      descricao: `Total de ${atrasadas.length} OS com status "atrasada" no período.${atrasadas.length > 5 ? ` As 5 primeiras: ${atrasadas.slice(0, 5).map((o: any) => o.numero || o.id.slice(0, 8)).join(", ")}.` : ""}`,
      prioridade: "critica",
      origem: "ordens_servico",
      motivo: `${atrasadas.length} OS com status = atrasada`,
      impacto: `Risco de multa contratual e insatisfação do cliente. ${atrasadas.length > 10 ? "Volume elevado de atrasos requer ação imediata." : "Revisar rota e prestador para cada operação."}`,
      operacao_id: ids[0] || undefined,
      data_hora: agora.toISOString(),
      acao: "Ver operações atrasadas",
      metric: `${atrasadas.length} OS`,
    });
  }

  // ============================================================
  // INSIGHT 2 — SLA em Risco (CRÍTICA)
  // ============================================================
  const slaRisco = (filteredVw as any[]).filter((v: any) => v.sla_status === "urgente");
  if (slaRisco.length > 0) {
    insights.push({
      id: `sla-risco-${agora.getTime()}`,
      tipo: "alerta",
      titulo: `${slaRisco.length} operação(ões) com SLA em risco`,
      descricao: `${slaRisco.length} alocações estão com SLA status "urgente". Requer acompanhamento imediato para evitar atraso.`,
      prioridade: "critica",
      origem: "vw_noc_operacional",
      motivo: `${slaRisco.length} alocações com sla_status = urgente`,
      impacto: "Risco de violação de SLA contratual. Pode gerar multas e penalidades.",
      data_hora: agora.toISOString(),
      acao: "Acompanhar operações críticas",
      metric: `${slaRisco.length} alocações`,
    });
  }

  // ============================================================
  // INSIGHT 3 — POD Pendentes (ALTA)
  // ============================================================
  const semPOD = (filteredAlocacoes as any[]).filter(
    (a: any) => a.finalizada && !a.comprovante_url && !a.assinatura_url
  );
  if (semPOD.length > 0) {
    insights.push({
      id: `pod-pendente-${agora.getTime()}`,
      tipo: "alerta",
      titulo: `${semPOD.length} POD(s) pendente(s) de registro`,
      descricao: `${semPOD.length} alocações finalizadas sem comprovante ou assinatura. Necessário solicitar o registro junto ao prestador.`,
      prioridade: "alta",
      origem: "alocacoes_escala",
      motivo: `${semPOD.length} alocações finalizadas sem comprovante_url e assinatura_url`,
      impacto: "Impossibilidade de comprovar entrega ao cliente. Risco de glosa no faturamento.",
      data_hora: agora.toISOString(),
      acao: "Solicitar POD ao prestador",
      metric: `${semPOD.length} pendentes`,
    });
  }

  // Check vw_noc_operacional for alerta = 'pod_pendente'
  const podPendentesVw = (filteredVw as any[]).filter((v: any) => v.alerta === "pod_pendente" || v.alerta === "reversa_pendente");
  if (podPendentesVw.length > 0) {
    insights.push({
      id: `pod-reversa-${agora.getTime()}`,
      tipo: "alerta",
      titulo: `Alertas de POD/Reversa pendentes`,
      descricao: `${podPendentesVw.length} ocorrência(s) de POD ou reversa pendente identificada(s) na view NOC.`,
      prioridade: "alta",
      origem: "vw_noc_operacional",
      motivo: `${podPendentesVw.length} registros com alerta = pod_pendente ou reversa_pendente`,
      impacto: "Reversas não registradas podem gerar custos não faturados ao cliente.",
      data_hora: agora.toISOString(),
      acao: "Verificar pendências",
      metric: `${podPendentesVw.length} alertas`,
    });
  }

  // ============================================================
  // INSIGHT 4 — Reversas Pendentes (ALTA)
  // ============================================================
  const reversasPendentes = (filteredAlocacoes as any[]).filter(
    (a: any) => a.tipo_reversa && a.tipo_reversa !== "sem_reversa" && (!a.reversa_status || a.reversa_status === "pendente")
  );
  if (reversasPendentes.length > 0) {
    insights.push({
      id: `reversa-${agora.getTime()}`,
      tipo: "sugestao",
      titulo: `${reversasPendentes.length} reversa(s) pendente(s) de conclusão`,
      descricao: `${reversasPendentes.length} operações com tipo_reversa configurado mas sem conclusão. Verificar status e finalizar.`,
      prioridade: "alta",
      origem: "alocacoes_escala",
      motivo: `${reversasPendentes.length} alocações com tipo_reversa configurado e reversa_status = pendente`,
      impacto: "Reversas não concluídas podem gerar custos extras de logística reversa não faturados.",
      data_hora: agora.toISOString(),
      acao: "Finalizar reversas",
      metric: `${reversasPendentes.length} reversas`,
    });
  }

  // ============================================================
  // INSIGHT 5 — Excesso de Ocorrências (MÉDIA)
  // ============================================================
  const ocorrenciasAbertas = (ocorrencias as any[]).filter((o: any) => o.status === "aberta");
  if (ocorrenciasAbertas.length > 2) {
    insights.push({
      id: `ocorrencias-${agora.getTime()}`,
      tipo: "insight",
      titulo: `${ocorrenciasAbertas.length} ocorrências em aberto`,
      descricao: `Há ${ocorrenciasAbertas.length} ocorrências em aberto registradas no período. ${ocorrenciasAbertas.length > 5 ? "Volume elevado requer análise de causa raiz." : "Acompanhar e fechar as pendências."}`,
      prioridade: ocorrenciasAbertas.length > 5 ? "alta" : "media",
      origem: "portal_ocorrencias",
      motivo: `${ocorrenciasAbertas.length} ocorrências com status = aberta`,
      impacto: "Ocorrências acumuladas indicam problemas operacionais recorrentes que afetam a satisfação do cliente.",
      data_hora: agora.toISOString(),
      acao: "Ver ocorrências",
      metric: `${ocorrenciasAbertas.length} abertas`,
    });
  }

  // ============================================================
  // INSIGHT 6 — Operações sem Movimentação (MÉDIA)
  // ============================================================
  const semMov = (filteredOrdens as any[]).filter((o: any) => {
    if (!o.created_at) return false;
    const dias = (agora.getTime() - new Date(o.created_at).getTime()) / 86400000;
    return dias > 2 && o.status !== "entregue" && o.status !== "finalizada" && o.status !== "concluida" && o.status !== "cancelada";
  });
  if (semMov.length > 0) {
    insights.push({
      id: `sem-mov-${agora.getTime()}`,
      tipo: "alerta",
      titulo: `${semMov.length} operação(ões) sem movimentação há +2 dias`,
      descricao: `${semMov.length} OS estão paradas há mais de 2 dias sem conclusão. Verificar motivo e retomar ou cancelar.`,
      prioridade: "media",
      origem: "ordens_servico",
      motivo: `${semMov.length} OS com status não finalizado e criadas há mais de 2 dias`,
      impacto: "Operações paradas geram custo de estoque e insatisfação do cliente final.",
      operacao_id: semMov[0]?.id || undefined,
      data_hora: agora.toISOString(),
      acao: "Revisar operações paradas",
      metric: `${semMov.length} paradas`,
    });
  }

  // ============================================================
  // INSIGHT 7 — Contratos com Maior Volume (MÉDIA)
  // ============================================================
  if (contratos.length > 0) {
    const osPorCliente = ordens.length;
    insights.push({
      id: `volume-contrato-${agora.getTime()}`,
      tipo: "insight",
      titulo: `${contratos.length} contrato(s) ativo(s) — ${osPorCliente} OS no período`,
      descricao: `Total de ${contratos.length} contratos de operação ativos para este cliente. ${osPorCliente} ordens de serviço geradas no período.`,
      prioridade: "media",
      origem: "contratos_operacao / ordens_servico",
      motivo: `${contratos.length} contratos ativos com ${osPorCliente} OS no período`,
      impacto: "Clientes com contratos recorrentes têm prioridade operacional e demandam atenção contínua.",
      data_hora: agora.toISOString(),
      acao: "Ver contratos",
      metric: `${contratos.length} contratos`,
    });
  }

  // ============================================================
  // INSIGHT 8 — Concentração por Região (MÉDIA)
  // ============================================================
  const regiaoCount: Record<string, number> = {};
  for (const a of filteredAlocacoes as any[]) {
    const reg = a.destino || "Sem região";
    regiaoCount[reg] = (regiaoCount[reg] || 0) + 1;
  }
  const regioesOrdenadas = Object.entries(regiaoCount).sort((a, b) => b[1] - a[1]);
  if (regioesOrdenadas.length > 0) {
    const topRegiao = regioesOrdenadas[0];
    const pct = Math.round((topRegiao[1] / Math.max(1, filteredAlocacoes.length)) * 100);
    insights.push({
      id: `regiao-${agora.getTime()}`,
      tipo: "insight",
      titulo: `Concentração em "${topRegiao[0]}"`,
      descricao: `A região "${topRegiao[0]}" concentra ${topRegiao[1]} operações (${pct}% do total).${regioesOrdenadas.length > 1 ? ` Segunda região: "${regioesOrdenadas[1][0]}" com ${regioesOrdenadas[1][1]} operações.` : ""}`,
      prioridade: "media",
      origem: "alocacoes_escala",
      motivo: `${topRegiao[1]} operações concentradas em "${topRegiao[0]}" (${pct}%)`,
      impacto: "Permite otimizar rotas, agrupar entregas e reduzir custos operacionais na região de maior volume.",
      regiao: topRegiao[0],
      data_hora: agora.toISOString(),
      acao: "Analisar região",
      metric: `${pct}%`,
    });
  }

  // ============================================================
  // INSIGHT 9 — GPS sem Sinal (ALTA)
  // ============================================================
  const semGPS = (filteredVw as any[]).filter((v: any) => v.alerta === "sem_sinal_gps");
  if (semGPS.length > 0) {
    insights.push({
      id: `sem-gps-${agora.getTime()}`,
      tipo: "alerta",
      titulo: `${semGPS.length} motorista(s) sem sinal GPS`,
      descricao: `${semGPS.length} alocações estão com alerta "sem_sinal_gps". Motoristas podem estar offline ou com problemas de conectividade.`,
      prioridade: "alta",
      origem: "vw_noc_operacional",
      motivo: `${semGPS.length} registros com alerta = sem_sinal_gps`,
      impacto: "Impossibilidade de rastrear a carga em tempo real. Risco de segurança e perda de visibilidade para o cliente.",
      data_hora: agora.toISOString(),
      acao: "Contatar motoristas",
      metric: `${semGPS.length} sem sinal`,
    });
  }

  // ============================================================
  // INSIGHT 10 — Tendência Operacional (INFORMATIVA)
  // ============================================================
  const metadeAnterior = Math.ceil(filteredOrdens.length / 2);
  const metadeAtual = Math.floor(filteredOrdens.length / 2);
  const recentes = filteredOrdens.slice(0, metadeAtual).length;
  const antigos = filteredOrdens.slice(metadeAtual, filteredOrdens.length).length;
  const tendenciaPct = antigos > 0 ? Math.round(((recentes - antigos) / antigos) * 100 * 10) / 10 : 0;

  const tendenciaOperacional: "subindo" | "estavel" | "caindo" =
    tendenciaPct > 20 ? "subindo" : tendenciaPct < -20 ? "caindo" : "estavel";

  insights.push({
    id: `tendencia-${agora.getTime()}`,
    tipo: "previsao",
    titulo: `Tendência operacional: ${tendenciaOperacional === "subindo" ? "crescendo" : tendenciaOperacional === "caindo" ? "declinando" : "estável"}`,
    descricao: `Comparativo entre as duas metades do período: ${tendenciaPct >= 0 ? "+" : ""}${tendenciaPct}% de variação. ${tendenciaOperacional === "subindo" ? "Volume crescente — planejar capacidade." : tendenciaOperacional === "caindo" ? "Volume decrescente — revisar operação." : "Volume estável — operação consistente."}`,
    prioridade: "informativa",
    origem: "ordens_servico",
    motivo: `Variação de ${tendenciaPct}% entre metades do período (${recentes} vs ${antigos} registros)`,
    impacto: tendenciaOperacional === "subindo" ? "Necessário planejar aumento de capacidade operacional." : tendenciaOperacional === "caindo" ? "Pode indicar redução de demanda ou problemas operacionais." : "Operação previsível e estável.",
    data_hora: agora.toISOString(),
    metric: `${tendenciaPct >= 0 ? "+" : ""}${tendenciaPct}%`,
  });

  // ============================================================
  // INSIGHT 11 — Velocidade Média (INFORMATIVA)
  // ============================================================
  const comVelocidade = (filteredVw as any[]).filter((v: any) => v.tracking_velocidade != null && v.tracking_velocidade > 0);
  if (comVelocidade.length > 0) {
    const velMedia = Math.round(comVelocidade.reduce((acc: number, v: any) => acc + (v.tracking_velocidade || 0), 0) / comVelocidade.length);
    insights.push({
      id: `vel-media-${agora.getTime()}`,
      tipo: "insight",
      titulo: `Velocidade média em rota: ${velMedia} km/h`,
      descricao: `${comVelocidade.length} motoristas com tracking ativo. Velocidade média calculada: ${velMedia} km/h.`,
      prioridade: "informativa",
      origem: "vw_noc_operacional / operacao_localizacao",
      motivo: `${comVelocidade.length} motoristas com velocidade registrada, média de ${velMedia} km/h`,
      impacto: "Monitorar velocidades acima da média pode indicar riscos de acidentes ou multas.",
      data_hora: agora.toISOString(),
      metric: `${velMedia} km/h`,
    });
  }

  // ============================================================
  // INSIGHT 12 — Devoluções/Atrasos (MÉDIA)
  // ============================================================
  if (atrasadas.length > 0) {
    const pctAtraso = Math.round((atrasadas.length / Math.max(1, filteredOrdens.length)) * 100 * 10) / 10;
    if (pctAtraso > 10) {
      insights.push({
        id: `pct-atraso-${agora.getTime()}`,
        tipo: "alerta",
        titulo: `Taxa de atraso: ${pctAtraso}%`,
        descricao: `${pctAtraso}% das operações do período estão com status "atrasada". ${pctAtraso > 20 ? "Índice crítico que requer revisão urgente dos processos operacionais." : "Acima da meta. Investigar causas e implementar ações corretivas."}`,
        prioridade: pctAtraso > 20 ? "critica" : "alta",
        origem: "ordens_servico",
        motivo: `${pctAtraso}% das OS do período estão atrasadas (${atrasadas.length} de ${filteredOrdens.length})`,
        impacto: "Taxa elevada de atrasos compromete a confiança do cliente e pode gerar penalidades contratuais.",
        data_hora: agora.toISOString(),
        acao: "Revisar processos",
        metric: `${pctAtraso}%`,
      });
    }
  }

  // ============================================================
  // Calcular Saúde Operacional
  // ============================================================
  const totalEntregas = filteredOrdens.length;
  const entregasConcluidas = (filteredOrdens as any[]).filter(
    (o: any) => o.status === "entregue" || o.status === "finalizada" || o.status === "concluida"
  ).length;
  const sla = totalEntregas > 0 ? Math.round(((totalEntregas - atrasadas.length) / totalEntregas) * 100 * 10) / 10 : 100;
  const ocorrenciasTotal = (ocorrencias as any[]).filter((o: any) => o.status === "aberta").length;

  const scoreSla = Math.min(Math.round(sla * 0.30), 30);
  const scoreAtrasos = atrasadas.length === 0 ? 20 : atrasadas.length <= 3 ? 15 : atrasadas.length <= 5 ? 10 : 5;
  const scoreOcorrencias = ocorrenciasTotal <= 2 ? 15 : ocorrenciasTotal <= 4 ? 10 : 5;
  const scoreTendencia =
    tendenciaOperacional === "subindo" ? 15 :
    tendenciaOperacional === "estavel" ? 10 : 5;
  const scoreDevolucoes = atrasadas.length === 0 ? 10 : atrasadas.length <= 3 ? 7 : 3;
  const scoreOcupacao = totalEntregas > 0 && contratos.length > 0 ? 10 : 5;

  const score = Math.min(scoreSla + scoreAtrasos + scoreOcorrencias + scoreTendencia + scoreDevolucoes + scoreOcupacao, 100);
  const status: "saudavel" | "atencao" | "critico" = score >= 80 ? "saudavel" : score >= 50 ? "atencao" : "critico";

  const devolucoesPct = totalEntregas > 0 ? Math.round((atrasadas.length / totalEntregas) * 100 * 10) / 10 : 0;

  // Sort insights by priority: critica > alta > media > informativa
  const priorityOrder: Record<string, number> = { critica: 0, alta: 1, media: 2, informativa: 3 };
  insights.sort((a, b) => (priorityOrder[a.prioridade] ?? 99) - (priorityOrder[b.prioridade] ?? 99));

  return {
    saude: {
      score,
      status,
      sla,
      totalEntregas,
      atrasos: atrasadas.length,
      ocorrencias: ocorrenciasTotal,
      devolucoes: devolucoesPct,
      tendencia: tendenciaOperacional,
      ocupacao: totalEntregas > 0 ? Math.round((entregasConcluidas / totalEntregas) * 100) : 0,
    },
    insights,
  };
}

// =====================================================
// MISSÃO 108-L4 — Portal Escala Operacional Real
// =====================================================

export interface AlocacaoClienteResumo {
  id: string;
  data_escala: string;
  status: string;
  aceite_prestador: boolean;
  finalizada: boolean;
  origem: string;
  destino: string;
  motorista_nome?: string;
  motorista_telefone?: string;
  veiculo_tipo?: string;
  veiculo_placa?: string;
  janela_inicio?: string;
  janela_fim?: string;
  sla_status?: string;
  tem_pod: boolean;
  tem_tracking: boolean;
  tracking_lat?: number;
  tracking_lng?: number;
  previsao_conclusao?: string;
  ordem_servico_id?: string;
  os_numero?: string;
  os_status?: string;
  carga_descricao?: string;
  tipo_reversa?: string;
  reversa_status?: string;
  created_at: string;
}

export interface DetalheAlocacaoCliente {
  alocacao: AlocacaoClienteResumo;
  os: {
    id: string;
    numero: string;
    status: string;
    carga_descricao?: string;
    valor_cliente?: number;
    peso?: number;
    volumes?: number;
    ref_cliente?: string;
    created_at: string;
  } | null;
  pod: {
    nome_recebedor?: string;
    documento_recebedor?: string;
    data_hora_entrega?: string;
    foto_entrega_url?: string;
    foto_canhoto_url?: string;
    assinatura_url?: string;
    observacao?: string;
  } | null;
  ocorrencias: Array<{
    id: string;
    tipo: string;
    descricao: string;
    status: string;
    prioridade: string;
    created_at: string;
  }>;
}

export async function buscarEscalaCliente(
  clienteId: string,
  filtros?: {
    periodo?: string;
    dataInicio?: string;
    dataFim?: string;
    status?: string;
    veiculo?: string;
    motorista?: string;
  }
): Promise<AlocacaoClienteResumo[]> {
  if (!clienteId) return [];

  try {
    const { inicio, fim } = filtros?.periodo
      ? getPeriodoISO(filtros.periodo)
      : { inicio: new Date(Date.now() - 30 * 86400000).toISOString(), fim: new Date().toISOString() };

    const dataInicio = filtros?.dataInicio || inicio;
    const dataFim = filtros?.dataFim || fim;

    let query = supabase
      .from("alocacoes_escala")
      .select("id, data_escala, status, aceite_prestador, finalizada, origem, destino, prestador_id, tipo_veiculo, placa, horario_inicio_real, horario_fim_real, ordem_servico_id, tipo_reversa, reversa_status, comprovante_url, assinatura_url, created_at")
      .eq("cliente_id", clienteId)
      .gte("created_at", dataInicio)
      .lte("created_at", dataFim)
      .order("created_at", { ascending: false })
      .limit(200);

    if (filtros?.status) {
      query = query.eq("status", filtros.status);
    }

    const { data: alocacoes, error } = await query;
    if (error || !alocacoes) return [];

    const prestadorIds = new Set(alocacoes.map((a: any) => a.prestador_id).filter(Boolean));
    const osIds = new Set(alocacoes.map((a: any) => a.ordem_servico_id).filter(Boolean));
    const alocIds = alocacoes.map((a: any) => a.id);

    const [vwResponse, prestadoresResponse, osResponse, protocolosResponse] = await Promise.all([
      supabase
        .from("vw_noc_operacional")
        .select("alocacao_id, sla_status, tem_pod, tracking_lat, tracking_lng, tracking_ultima_atualizacao, motorista_nome, motorista_telefone, data_escala, finalizada")
        .in("alocacao_id", alocIds)
        .limit(200),
      prestadorIds.size > 0
        ? supabase.from("prestadores").select("id, nome_completo, telefone").in("id", [...prestadorIds]).limit(50)
        : Promise.resolve({ data: [] }),
      osIds.size > 0
        ? supabase.from("ordens_servico").select("id, numero, status, carga_descricao, valor_cliente, peso, volumes, ref_cliente, created_at").in("id", [...osIds]).limit(50)
        : Promise.resolve({ data: [] }),
      supabase
        .from("entregas_protocolo")
        .select("alocacao_id, data_hora_entrega, nome_recebedor, foto_entrega_url, assinatura_url")
        .in("alocacao_id", alocIds)
        .limit(200),
    ]);

    const vwMap = new Map((vwResponse.data || []).map((v: any) => [v.alocacao_id, v]));
    const prestadorMap = new Map((prestadoresResponse.data || []).map((p: any) => [p.id, p]));
    const osMap = new Map((osResponse.data || []).map((o: any) => [o.id, o]));
    const protocoloMap = new Map<string, any>();
    for (const ep of (protocolosResponse.data || [])) {
      if (!protocoloMap.has(ep.alocacao_id)) protocoloMap.set(ep.alocacao_id, ep);
    }

    const result: AlocacaoClienteResumo[] = alocacoes.map((a: any) => {
      const vw = vwMap.get(a.id);
      const prest = prestadorMap.get(a.prestador_id);
      const os = osMap.get(a.ordem_servico_id);
      const protocolo = protocoloMap.get(a.id);

      return {
        id: a.id,
        data_escala: a.data_escala || a.created_at,
        status: a.status || "pendente",
        aceite_prestador: a.aceite_prestador || false,
        finalizada: a.finalizada || false,
        origem: a.origem || "",
        destino: a.destino || "",
        motorista_nome: vw?.motorista_nome || prest?.nome_completo || "",
        motorista_telefone: vw?.motorista_telefone || prest?.telefone || "",
        veiculo_tipo: a.tipo_veiculo || "",
        veiculo_placa: a.placa || "",
        janela_inicio: a.horario_inicio_real || "",
        janela_fim: a.horario_fim_real || "",
        sla_status: vw?.sla_status || "",
        tem_pod: !!(protocolo || vw?.tem_pod || a.comprovante_url || a.assinatura_url),
        tem_tracking: !!(vw?.tracking_lat && vw?.tracking_lng),
        tracking_lat: vw?.tracking_lat || undefined,
        tracking_lng: vw?.tracking_lng || undefined,
        previsao_conclusao: vw?.tracking_ultima_atualizacao || "",
        ordem_servico_id: a.ordem_servico_id || "",
        os_numero: os?.numero || "",
        os_status: os?.status || "",
        carga_descricao: os?.carga_descricao || "",
        tipo_reversa: a.tipo_reversa || "",
        reversa_status: a.reversa_status || "",
        created_at: a.created_at,
      };
    });

    if (filtros?.veiculo) {
      return result.filter((r) =>
        r.veiculo_tipo?.toLowerCase().includes(filtros.veiculo!.toLowerCase()) ||
        r.veiculo_placa?.toLowerCase().includes(filtros.veiculo!.toLowerCase())
      );
    }
    if (filtros?.motorista) {
      return result.filter((r) =>
        r.motorista_nome?.toLowerCase().includes(filtros.motorista!.toLowerCase())
      );
    }

    return result;
  } catch (e) {
    console.warn("[PortalCliente] buscarEscalaCliente erro:", e);
    return [];
  }
}

export async function buscarDetalheAlocacaoCliente(
  alocacaoId: string
): Promise<DetalheAlocacaoCliente | null> {
  try {
    const { data: aloc, error } = await supabase
      .from("alocacoes_escala")
      .select("id, data_escala, status, aceite_prestador, finalizada, origem, destino, prestador_id, tipo_veiculo, placa, horario_inicio_real, horario_fim_real, ordem_servico_id, tipo_reversa, reversa_status, comprovante_url, assinatura_url, created_at, observacoes")
      .eq("id", alocacaoId)
      .maybeSingle();

    if (error || !aloc) return null;

    const prest = aloc.prestador_id
      ? (await supabase.from("prestadores").select("nome_completo, telefone").eq("id", aloc.prestador_id).maybeSingle()).data
      : null;

    let osData: DetalheAlocacaoCliente["os"] = null;
    if (aloc.ordem_servico_id) {
      const { data: os } = await supabase
        .from("ordens_servico")
        .select("id, numero, status, carga_descricao, valor_cliente, peso, volumes, ref_cliente, created_at")
        .eq("id", aloc.ordem_servico_id)
        .maybeSingle();
      if (os) {
        osData = os;
      }
    }

    let podData: DetalheAlocacaoCliente["pod"] = null;
    const { data: protocolo } = await supabase
      .from("entregas_protocolo")
      .select("nome_recebedor, documento_recebedor, data_hora_entrega, foto_entrega_url, foto_canhoto_url, assinatura_url, observacao")
      .eq("alocacao_id", alocacaoId)
      .maybeSingle();
    if (protocolo) {
      // APP-E2E-11D — resolve mídia privada (driver-evidence) em signed URL.
      podData = await podMedia.resolverMidiasPod(protocolo);
    }

    const { data: ocorr } = await supabase
      .from("portal_ocorrencias")
      .select("id, tipo, descricao, status, prioridade, created_at")
      .eq("os_id", aloc.ordem_servico_id || "")
      .order("created_at", { ascending: false })
      .limit(20);
    const ocorrencias = (ocorr || []).map((o: any) => ({
      id: o.id,
      tipo: o.tipo || "outro",
      descricao: o.descricao || "",
      status: o.status || "aberta",
      prioridade: o.prioridade || "media",
      created_at: o.created_at,
    }));

    const vw = aloc.ordem_servico_id
      ? (await supabase.from("vw_noc_operacional").select("*").eq("alocacao_id", alocacaoId).maybeSingle()).data
      : null;

    const alocResumo: AlocacaoClienteResumo = {
      id: aloc.id,
      data_escala: aloc.data_escala || aloc.created_at,
      status: aloc.status,
      aceite_prestador: aloc.aceite_prestador || false,
      finalizada: aloc.finalizada || false,
      origem: aloc.origem || "",
      destino: aloc.destino || "",
      motorista_nome: prest?.nome_completo || "",
      motorista_telefone: prest?.telefone || "",
      veiculo_tipo: aloc.tipo_veiculo || "",
      veiculo_placa: aloc.placa || "",
      janela_inicio: aloc.horario_inicio_real || "",
      janela_fim: aloc.horario_fim_real || "",
      sla_status: vw?.sla_status || "",
      tem_pod: !!(protocolo || aloc.comprovante_url || aloc.assinatura_url),
      tem_tracking: !!(vw?.tracking_lat && vw?.tracking_lng),
      tracking_lat: vw?.tracking_lat || undefined,
      tracking_lng: vw?.tracking_lng || undefined,
      previsao_conclusao: vw?.tracking_ultima_atualizacao || "",
      ordem_servico_id: aloc.ordem_servico_id || "",
      os_numero: osData?.numero || "",
      os_status: osData?.status || "",
      carga_descricao: osData?.carga_descricao || "",
      tipo_reversa: aloc.tipo_reversa || "",
      reversa_status: aloc.reversa_status || "",
      created_at: aloc.created_at,
    };

    return {
      alocacao: alocResumo,
      os: osData,
      pod: podData,
      ocorrencias,
    };
  } catch (e) {
    console.warn("[PortalCliente] buscarDetalheAlocacaoCliente erro:", e);
    return null;
  }
}

// =====================================================
// MISSÃO 108-L5 — Portal MultiFilial Real
// =====================================================

export interface FilialClienteResumo {
  nome: string;
  cidade: string;
  uf: string;
  total_os: number;
  abertas: number;
  concluidas: number;
  faturamento: number;
  pendentes_financeiro: number;
  ocorrencias: number;
  sla: number;
  contratos_ativos: number;
  ultima_atualizacao: string;
  tem_pod: number;
  reversas: number;
}

export interface FilialComparativo extends FilialClienteResumo {
  entregas_no_prazo: number;
  atrasos: number;
  evolucao_periodo: number;
}

export interface FilialDetalhe {
  resumo: FilialClienteResumo;
  operacoes: Array<{
    id: string;
    numero: string;
    status: string;
    data: string;
    carga: string;
    valor: number;
    origem: string;
    destino: string;
  }>;
  financeiro: {
    faturado: number;
    recebido: number;
    pendente: number;
    vencido: number;
    a_receber: number;
    ultima_atualizacao: string;
  };
  ocorrencias: Array<{
    id: string;
    tipo: string;
    descricao: string;
    status: string;
    data: string;
  }>;
  pods: number;
  contratos: number;
}

export async function buscarFiliaisCliente(
  clienteId: string,
  filtros?: {
    periodo?: string;
    dataInicio?: string;
    dataFim?: string;
    filial?: string;
    uf?: string;
    status?: string;
  }
): Promise<{ filiais: FilialClienteResumo[]; comparativo: FilialComparativo[] }> {
  if (!clienteId) return { filiais: [], comparativo: [] };

  const { inicio, fim } = filtros?.periodo
    ? getPeriodoISO(filtros.periodo)
    : { inicio: new Date(Date.now() - 30 * 86400000).toISOString(), fim: new Date().toISOString() };
  const dataInicio = filtros?.dataInicio || inicio;
  const dataFim = filtros?.dataFim || fim;

  try {
    const { data: osData, error: osError } = await supabase
      .from("ordens_servico")
      .select("id, numero, status, unidade, origem, destino, carga_descricao, valor_cliente, created_at, cliente")
      .eq("cliente", clienteId)
      .gte("created_at", dataInicio)
      .lte("created_at", dataFim)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (osError || !osData || osData.length === 0) return { filiais: [], comparativo: [] };

    const osPorFilial: Record<string, any[]> = {};
    for (const os of osData) {
      const filialNome = (os as any).unidade || (os as any).origem || "Sem Filial";
      if (!osPorFilial[filialNome]) osPorFilial[filialNome] = [];
      osPorFilial[filialNome].push(os);
    }

    const osIds = osData.map((o: any) => o.id);

    const [finResponse, alocResponse, portalOcorrResponse, contratosResponse] = await Promise.all([
      supabase
        .from("financeiro_receber")
        .select("id, os_id, valor, valor_pago, data_vencimento, status")
        .in("os_id", osIds)
        .limit(osIds.length),
      supabase
        .from("alocacoes_escala")
        .select("id, ordem_servico_id, status, origem, destino")
        .eq("cliente_id", clienteId)
        .gte("created_at", dataInicio)
        .lte("created_at", dataFim)
        .limit(osIds.length),
      supabase
        .from("portal_ocorrencias")
        .select("id, tipo, descricao, status, created_at, os_id")
        .in("os_id", osIds)
        .limit(osIds.length * 2),
      supabase
        .from("contratos_operacao")
        .select("id, status, cliente_id")
        .eq("cliente_id", clienteId)
        .eq("status", "ativo")
        .limit(50),
    ]);

    const finPorOS: Record<string, any[]> = {};
    for (const f of (finResponse.data || [])) {
      const osId = (f as any).os_id;
      if (!finPorOS[osId]) finPorOS[osId] = [];
      finPorOS[osId].push(f);
    }

    const alocPorOS: Record<string, any[]> = {};
    for (const a of (alocResponse.data || [])) {
      const osId = (a as any).ordem_servico_id;
      if (!alocPorOS[osId]) alocPorOS[osId] = [];
      alocPorOS[osId].push(a);
    }

    const ocorrPorOS: Record<string, any[]> = {};
    for (const o of (portalOcorrResponse.data || [])) {
      const osId = (o as any).os_id;
      if (!ocorrPorOS[osId]) ocorrPorOS[osId] = [];
      ocorrPorOS[osId].push(o);
    }

    const contratosAtivos = (contratosResponse.data || []).length;

    const filiais: FilialClienteResumo[] = [];
    const comparativo: FilialComparativo[] = [];
    const periodoAnteriorInicio = new Date(new Date(dataInicio).getTime() - 30 * 86400000).toISOString();
    const periodoAnterior: Record<string, number> = {};

    for (const [nome, oss] of Object.entries(osPorFilial)) {
      if (filtros?.filial && !nome.toLowerCase().includes(filtros.filial.toLowerCase())) continue;
      if (filtros?.uf && !nome.toUpperCase().includes(filtros.uf.toUpperCase())) continue;

      const total_os = oss.length;
      const abertas = oss.filter((o: any) => o.status !== "entregue" && o.status !== "cancelada" && o.status !== "finalizada").length;
      const concluidas = oss.filter((o: any) => o.status === "entregue" || o.status === "finalizada").length;

      const allFin = oss.flatMap((o: any) => finPorOS[o.id] || []);
      const faturamento = allFin.reduce((acc: number, f: any) => acc + (Number(f.valor) || 0), 0);
      const pendentes_financeiro = allFin.filter((f: any) => f.status !== "pago" && f.status !== "recebido").length;

      const ossIds = oss.map((o: any) => o.id);
      const ocorrCount = ossIds.reduce((acc: number, osId: string) => acc + (ocorrPorOS[osId]?.length || 0), 0);

      const allAloc = oss.flatMap((o: any) => alocPorOS[o.id] || []);
      const comPOD = allAloc.filter((a: any) => a.comprovante_url || a.assinatura_url || a.status === "concluida").length;
      const reversas = allAloc.filter((a: any) => a.tipo_reversa).length;

      const noPrazo = allAloc.filter((a: any) => a.status === "concluida").length;
      const atrasos = allAloc.filter((a: any) => a.status === "em_andamento" && new Date(a.created_at) < new Date(dataInicio)).length;
      const sla = total_os > 0 ? Math.round((noPrazo / Math.max(total_os, 1)) * 100) : 0;

      const { data: osAnteriores } = await supabase
        .from("ordens_servico")
        .select("id")
        .eq("cliente", clienteId)
        .gte("created_at", periodoAnteriorInicio)
        .lt("created_at", dataInicio)
        .limit(500);
      periodoAnterior[nome] = osAnteriores?.length || 0;

      const primeiroOS = oss.reduce((earliest: any, o: any) =>
        !earliest || new Date(o.created_at) < new Date(earliest.created_at) ? o : earliest, null);

      const filial: FilialClienteResumo = {
        nome,
        cidade: "",
        uf: "",
        total_os,
        abertas,
        concluidas,
        faturamento: Math.round(faturamento * 100) / 100,
        pendentes_financeiro,
        ocorrencias: ocorrCount,
        sla,
        contratos_ativos: contratosAtivos,
        ultima_atualizacao: primeiroOS?.created_at || new Date().toISOString(),
        tem_pod: comPOD,
        reversas,
      };
      filiais.push(filial);

      const evolucao = periodoAnterior[nome] > 0
        ? Math.round(((total_os - periodoAnterior[nome]) / periodoAnterior[nome]) * 100)
        : total_os > 0 ? 100 : 0;

      comparativo.push({ ...filial, entregas_no_prazo: noPrazo, atrasos, evolucao_periodo: evolucao });
    }

    filiais.sort((a, b) => b.total_os - a.total_os);
    comparativo.sort((a, b) => b.total_os - a.total_os);

    return { filiais, comparativo };
  } catch (e) {
    console.warn("[PortalCliente] buscarFiliaisCliente erro:", e);
    return { filiais: [], comparativo: [] };
  }
}

export async function buscarDetalheFilial(
  clienteId: string,
  filialNome: string,
  filtros?: { periodo?: string }
): Promise<FilialDetalhe | null> {
  if (!clienteId || !filialNome) return null;

  const { inicio, fim } = filtros?.periodo
    ? getPeriodoISO(filtros.periodo)
    : { inicio: new Date(Date.now() - 30 * 86400000).toISOString(), fim: new Date().toISOString() };

  try {
    const { data: osData } = await supabase
      .from("ordens_servico")
      .select("id, numero, status, unidade, origem, destino, carga_descricao, valor_cliente, created_at, cliente")
      .eq("cliente", clienteId)
      .eq("unidade", filialNome)
      .gte("created_at", inicio)
      .lte("created_at", fim)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!osData || osData.length === 0) return null;

    const osIds = osData.map((o: any) => o.id);

    const [finResponse, ocorrResponse] = await Promise.all([
      supabase
        .from("financeiro_receber")
        .select("id, os_id, valor, valor_pago, data_vencimento, status")
        .in("os_id", osIds)
        .limit(osIds.length),
      supabase
        .from("portal_ocorrencias")
        .select("id, tipo, descricao, status, created_at, os_id")
        .in("os_id", osIds)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const totalFaturado = (finResponse.data || []).reduce((acc: number, f: any) => acc + (Number(f.valor) || 0), 0);
    const recebido = (finResponse.data || []).reduce((acc: number, f: any) => acc + (Number(f.valor_pago) || 0), 0);
    const pendente = (finResponse.data || []).filter((f: any) => f.status !== "pago" && f.status !== "recebido").length;
    const vencido = (finResponse.data || []).filter((f: any) =>
      (f.status !== "pago" && f.status !== "recebido") &&
      new Date(f.data_vencimento) < new Date()
    ).length;
    const aReceber = totalFaturado - recebido;

    const { data: contratos } = await supabase
      .from("contratos_operacao")
      .select("id")
      .eq("cliente_id", clienteId)
      .eq("status", "ativo")
      .limit(50);

    const totalOs = osData.length;
    const concluidas = osData.filter((o: any) => o.status === "entregue" || o.status === "finalizada").length;
    const abertas = totalOs - concluidas;

    const sla = totalOs > 0 ? Math.round((concluidas / totalOs) * 100) : 0;

    const primeiroOS = osData.reduce((earliest: any, o: any) =>
      !earliest || new Date(o.created_at) < new Date(earliest.created_at) ? o : earliest, null);

    const resumo: FilialClienteResumo = {
      nome: filialNome,
      cidade: "",
      uf: "",
      total_os: totalOs,
      abertas,
      concluidas,
      faturamento: Math.round(totalFaturado * 100) / 100,
      pendentes_financeiro: pendente,
      ocorrencias: (ocorrResponse.data || []).length,
      sla,
      contratos_ativos: contratos?.length || 0,
      ultima_atualizacao: primeiroOS?.created_at || new Date().toISOString(),
      tem_pod: 0,
      reversas: 0,
    };

    return {
      resumo,
      operacoes: osData.map((o: any) => ({
        id: o.id,
        numero: o.numero || "",
        status: o.status || "pendente",
        data: o.created_at,
        carga: o.carga_descricao || "",
        valor: Number(o.valor_cliente) || 0,
        origem: o.origem || "",
        destino: o.destino || "",
      })),
      financeiro: {
        faturado: Math.round(totalFaturado * 100) / 100,
        recebido: Math.round(recebido * 100) / 100,
        pendente,
        vencido,
        a_receber: Math.round(aReceber * 100) / 100,
        ultima_atualizacao: new Date().toISOString(),
      },
      ocorrencias: (ocorrResponse.data || []).map((o: any) => ({
        id: o.id,
        tipo: o.tipo || "outro",
        descricao: o.descricao || "",
        status: o.status || "aberta",
        data: o.created_at,
      })),
      pods: concluidas,
      contratos: contratos?.length || 0,
    };
  } catch (e) {
    console.warn("[PortalCliente] buscarDetalheFilial erro:", e);
    return null;
  }
}