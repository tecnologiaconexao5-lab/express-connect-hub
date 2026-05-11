import { supabase } from "@/lib/supabase";

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
}

export interface FaturaPortalResumo {
  id: string;
  numero: string;
  competencia: string;
  valor: number;
  vencimento: string | null;
  status: string;
  url_boleto: string | null;
  os_ids: string[];
  created_at: string;
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

export async function buscarResumoCliente(clienteNome?: string): Promise<ClienteInfo | null> {
  try {
    if (!clienteNome) {
      console.warn("[PortalClienteService] clienteNome não fornecido");
      return null;
    }

    const clienteFiltro = clienteNome.replace(/@.+$/, "").trim();

    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .ilike("nome_fantasia", `%${clienteFiltro}%`)
      .limit(1)
      .single();

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
  clienteNome?: string,
  limit: number = 50
): Promise<EntregaResumo[]> {
  try {
    const { data, error } = await supabase
      .from("ordens_servico")
      .select("*")
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

export async function buscarFinanceiroCliente(): Promise<FinanceiroResumo[]> {
  try {
    const { data, error } = await supabase
      .from("financeiro_receber")
      .select("*")
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

export async function buscarOcorrenciasCliente(limit: number = 20): Promise<OcorrenciaResumo[]> {
  try {
    // Usar nova tabela portal_ocorrencias
    const { data, error } = await supabase
      .from("portal_ocorrencias")
      .select("*")
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

  try {
    const [entregas, financeiro, ocorrencias] = await Promise.all([
      buscarEntregasCliente(clienteNome, 100),
      buscarFinanceiroCliente(),
      buscarOcorrenciasCliente(),
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

export async function buscarNotificacoesPortal(limit: number = 20): Promise<NotificacaoResumo[]> {
  try {
    const { data, error } = await supabase
      .from("portal_notificacoes")
      .select("*")
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

export async function buscarAvaliacoesPortal(limit: number = 20): Promise<AvaliacaoResumo[]> {
  try {
    const { data, error } = await supabase
      .from("portal_avaliacoes")
      .select("*")
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

export async function buscarComprovantesPortal(limit: number = 20): Promise<ComprovanteResumo[]> {
  try {
    const { data, error } = await supabase
      .from("portal_comprovantes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("[PortalClienteService] Erro ao buscar portal_comprovantes:", error.message);
      return [];
    }

    return data?.map((c) => ({
      id: c.id,
      tipo: c.tipo || "entrega",
      titulo: c.titulo || "",
      url: c.url,
      nome_recebedor: c.nome_recebedor,
      documento_recebedor: c.documento_recebedor,
      data_entrega: c.data_entrega,
      created_at: c.created_at,
    })) || [];
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao buscar portal_comprovantes:", error);
    return [];
  }
}

export async function buscarFaturasPortal(limit: number = 20): Promise<FaturaPortalResumo[]> {
  try {
    const { data, error } = await supabase
      .from("portal_faturas")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("[PortalClienteService] Erro ao buscar portal_faturas:", error.message);
      return [];
    }

    return data?.map((f) => ({
      id: f.id,
      numero: f.numero || "",
      competencia: f.competencia || "",
      valor: f.valor || 0,
      vencimento: f.vencimento,
      status: f.status || "aberta",
      url_boleto: f.url_boleto,
      os_ids: f.os_ids || [],
      created_at: f.created_at,
    })) || [];
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao buscar portal_faturas:", error);
    return [];
  }
}

export async function buscarProtocolosPortal(limit: number = 20): Promise<ProtocoloResumo[]> {
  try {
    const { data, error } = await supabase
      .from("portal_protocolos")
      .select("*")
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

export async function buscarRotasPortal(limit: number = 20): Promise<RotaResumo[]> {
  try {
    const { data, error } = await supabase
      .from("portal_rotas")
      .select("*")
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

export async function criarNotificacaoPortal(notificacao: Partial<NotificacaoResumo>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("portal_notificacoes")
      .insert([{
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

export async function criarOcorrenciaPortal(ocorrencia: Partial<OcorrenciaResumo>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("portal_ocorrencias")
      .insert([{
        tipo: ocorrencia.tipo || "outro",
        descricao: ocorrencia.descricao || "",
        prioridade: ocorrencia.prioridade || "media",
        status: "aberta",
      }]);

    if (error) {
      console.warn("[PortalClienteService] Erro ao criar portal_ocorrencias:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[PortalClienteService] Exceção ao criar portal_ocorrencias:", error);
    return false;
  }
}

export async function criarAvaliacaoPortal(avaliacao: Partial<AvaliacaoResumo>): Promise<boolean> {
  try {
    if (!avaliacao.nota || avaliacao.nota < 1 || avaliacao.nota > 5) {
      console.warn("[PortalClienteService] Nota inválida para avaliação");
      return false;
    }

    const { error } = await supabase
      .from("portal_avaliacoes")
      .insert([{
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