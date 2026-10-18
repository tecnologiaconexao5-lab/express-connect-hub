import { supabase } from "@/lib/supabase";

export interface AnalyticsDashboard {
  slaGeral: number;
  produtividade: number;
  custoPorEntrega: number;
  tendencia7dias: number;
  tendencia30dias: number;
  comparativoMensal: { mes: string; atual: number; anterior: number }[];
  rankingUnidades: { unidade: string; posicao: number; score: number; tendencia: string }[];
}

export interface EconomiaData {
  economiaVsFrotaPropria: number;
  reducaoCusto: number;
  kmOtimizados: number;
  ocupacaoMedia: number;
  economiaCombustivel: number;
  entregasConsolidadas: number;
}

export interface NotificacaoData {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  canal: string;
  prioridade: string;
  lida: boolean;
  created_at: string;
}

export interface ExecutiveInsight {
  id: string;
  tipo: "mensagem" | "insight" | "alerta";
  titulo: string;
  descricao: string;
  prioridade: "alta" | "media" | "baixa";
}

export async function buscarAnalyticsDashboard(clienteId?: string): Promise<AnalyticsDashboard> {
  if (!clienteId) return getEmptyAnalytics();

  try {
    const { data: entregasData } = await supabase
      .from("ordens_servico")
      .select("status, sla, created_at, valor_frete")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!entregasData || entregasData.length === 0) {
      return getEmptyAnalytics();
    }

    const slaMedio = Math.round(entregasData.reduce((acc, e) => acc + (e.sla || 0), 0) / entregasData.length);
    const custoMedio = entregasData.reduce((acc, e) => acc + (e.valor_frete || 0), 0) / entregasData.length;
    const concluidas = entregasData.filter(e => e.status === "finalizada" || e.status === "entregue").length;
    const produtividade = entregasData.length > 0 ? Math.round((concluidas / entregasData.length) * 100) : 0;

    return {
      slaGeral: slaMedio || 0,
      produtividade: produtividade || 0,
      custoPorEntrega: Number(custoMedio.toFixed(2)) || 0,
      tendencia7dias: 0,
      tendencia30dias: 0,
      comparativoMensal: [],
      rankingUnidades: [],
    };
  } catch (error) {
    console.warn("[AnalyticsService] Erro ao buscar dashboard:", error);
    return getEmptyAnalytics();
  }
}

export async function buscarEconomia(clienteId?: string): Promise<EconomiaData> {
  if (!clienteId) return getEmptyEconomia();

  try {
    const { data: entregasData } = await supabase
      .from("ordens_servico")
      .select("valor_frete, peso, volumes")
      .eq("cliente_id", clienteId)
      .limit(100);

    if (!entregasData || entregasData.length === 0) return getEmptyEconomia();

    const count = entregasData.length;
    const custoMedio = entregasData.reduce((acc, e) => acc + (e.valor_frete || 0), 0) / count;

    return {
      economiaVsFrotaPropria: Math.round(custoMedio * count * 0.4),
      reducaoCusto: 0,
      kmOtimizados: 0,
      ocupacaoMedia: 0,
      economiaCombustivel: Math.round(custoMedio * count * 0.08),
      entregasConsolidadas: count,
    };
  } catch (error) {
    console.warn("[AnalyticsService] Erro ao buscar economia:", error);
    return getEmptyEconomia();
  }
}

export async function buscarNotificacoes(clienteId?: string): Promise<NotificacaoData[]> {
  if (!clienteId) return [];

  try {
    const { data, error } = await supabase
      .from("portal_notificacoes")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data || data.length === 0) return [];

    return data.map(n => ({
      id: n.id,
      titulo: n.titulo || "Notificação",
      mensagem: n.mensagem || "",
      tipo: n.tipo || "aviso",
      canal: n.canal || "portal",
      prioridade: n.prioridade || "media",
      lida: n.lida || false,
      created_at: n.created_at || new Date().toISOString(),
    }));
  } catch (error) {
    console.warn("[AnalyticsService] Exceção ao buscar notificações:", error);
    return [];
  }
}

export async function buscarExecutiveInsights(clienteId?: string): Promise<ExecutiveInsight[]> {
  if (!clienteId) return [];

  try {
    const [entregasData, ocorrenciasData] = await Promise.all([
      supabase.from("ordens_servico").select("status, sla").eq("cliente_id", clienteId).limit(50),
      supabase.from("portal_ocorrencias").select("id").eq("cliente_id", clienteId).limit(20),
    ]);

    const entregas = entregasData.data || [];
    const ocorrencias = ocorrenciasData.data || [];
    if (entregas.length === 0) return [];

    const slaMedio = Math.round(entregas.reduce((acc, e) => acc + (e.sla || 0), 0) / entregas.length);
    const atrasadas = entregas.filter(e => e.status === "atrasada").length;
    const insights: ExecutiveInsight[] = [];

    if (slaMedio >= 95) {
      insights.push({ id: "1", tipo: "mensagem", titulo: "SLA excepcional",
        descricao: `Sua operação atingiu ${slaMedio}% SLA.`, prioridade: "baixa" });
    }
    if (atrasadas > 0) {
      insights.push({ id: "2", tipo: "alerta", titulo: "Atenção: Atrasos",
        descricao: `${atrasadas} entrega(s) com atraso.`, prioridade: "alta" });
    }
    if (ocorrencias.length > 0) {
      insights.push({ id: "4", tipo: "alerta", titulo: "Ocorrências",
        descricao: `${ocorrencias.length} ocorrências registradas.`, prioridade: "media" });
    }

    return insights;
  } catch (error) {
    console.warn("[AnalyticsService] Exceção ao buscar insights:", error);
    return [];
  }
}

function getEmptyAnalytics(): AnalyticsDashboard {
  return { slaGeral: 0, produtividade: 0, custoPorEntrega: 0, tendencia7dias: 0, tendencia30dias: 0, comparativoMensal: [], rankingUnidades: [] };
}

function getEmptyEconomia(): EconomiaData {
  return { economiaVsFrotaPropria: 0, reducaoCusto: 0, kmOtimizados: 0, ocupacaoMedia: 0, economiaCombustivel: 0, entregasConsolidadas: 0 };
}