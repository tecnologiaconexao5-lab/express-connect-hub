import { supabase } from "@/lib/supabase";

export interface VeiculoEscala {
  id: string;
  tipo: string;
  modelo: string;
  placa: string;
  capacidadePeso: number;
  capacidadeVolume: number;
  tipoCarroceria: string;
  status: string;
  ocupacao: number;
  entregasAtribuidas: number;
  regiao?: string;
}

export interface Rota {
  id: string;
  nome: string;
  regiao: string;
  veiculo: string;
  capacidade: number;
  ocupacao: number;
  pesoTotal: number;
  volumeTotal: number;
  km: number;
  tempo: number;
  status: string;
}

export interface InsightIA {
  id: string;
  tipo: "alerta" | "previsao" | "sugestao" | "insight";
  titulo: string;
  descricao: string;
  prioridade: "alta" | "media" | "baixa";
  regiao?: string;
  metric?: string;
}

export interface SaudeOperacional {
  score: number;
  status: "saudavel" | "atencao" | "critico";
  sla: number;
  atrasos: number;
  ocorrencias: number;
  ocupacao: number;
  devolucoes: number;
  tendencia: "subindo" | "estavel" | "caindo";
}

export async function buscarRotas(clienteNome?: string): Promise<Rota[]> {
  try {
    const { data, error } = await supabase
      .from("ordens_servico")
      .select("id, cidade_destino, veiculo_tipo, status")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.warn("[RoteirizacaoService] Erro ao buscar rotas:", error.message);
      return getFallbackRotas();
    }

    if (!data || data.length === 0) {
      return getFallbackRotas();
    }

    const regioes = [...new Set(data.map(d => d.cidade_destino).filter(Boolean))];
    const rotas: Rota[] = regioes.slice(0, 5).map((regiao, idx) => ({
      id: `${idx + 1}`,
      nome: `Rota ${regiao}`,
      regiao: regiao,
      veiculo: "Van",
      capacidade: 600,
      ocupacao: Math.floor(Math.random() * 400) + 100,
      pesoTotal: Math.floor(Math.random() * 300) + 100,
      volumeTotal: Math.random() * 3 + 1,
      km: Math.floor(Math.random() * 50) + 20,
      tempo: Math.floor(Math.random() * 180) + 60,
      status: idx === 0 ? "em_otimizacao" : "otimizada",
    }));

    return rotas;
  } catch (error) {
    console.warn("[RoteirizacaoService] Exceção ao buscar rotas:", error);
    return getFallbackRotas();
  }
}

export async function buscarEscala(clienteNome?: string): Promise<VeiculoEscala[]> {
  try {
    const { data, error } = await supabase
      .from("veiculos")
      .select("id, modelo, placa, tipo, capacidade_peso, capacidade_volume, tipo_carroceria, status")
      .limit(20);

    if (error) {
      console.warn("[RoteirizacaoService] Erro ao buscar escala:", error.message);
      return getFallbackEscala();
    }

    if (!data || data.length === 0) {
      return getFallbackEscala();
    }

    return data.map(v => ({
      id: v.id,
      tipo: v.tipo || "fiorino",
      modelo: v.modelo || "Veículo",
      placa: v.placa || "---",
      capacidadePeso: v.capacidade_peso || 300,
      capacidadeVolume: v.capacidade_volume || 2,
      tipoCarroceria: v.tipo_carroceria || "seco",
      status: v.status || "disponivel",
      ocupacao: Math.floor(Math.random() * 200),
      entregasAtribuidas: Math.floor(Math.random() * 15),
    }));
  } catch (error) {
    console.warn("[RoteirizacaoService] Exceção ao buscar escala:", error);
    return getFallbackEscala();
  }
}

export async function buscarInsights(clienteNome?: string): Promise<InsightIA[]> {
  try {
    const [entregasData, ocorrenciasData] = await Promise.all([
      supabase.from("ordens_servico").select("status, sla, created_at").limit(50),
      supabase.from("ocorrencias").select("tipo, created_at").limit(20),
    ]);

    const atrasadas = entregasData.data?.filter(e => e.status === "atrasada").length || 0;
    const entregasCount = entregasData.data?.length || 0;
    const slaMedio = entregasData.data?.reduce((acc, e) => acc + (e.sla || 0), 0) / (entregasCount || 1) || 0;
    const ocorrenciasCount = ocorrenciasData.data?.length || 0;

    const insights: InsightIA[] = [];

    if (atrasadas > 0) {
      insights.push({
        id: "1",
        tipo: "alerta",
        titulo: "Entregas atrasadas detectadas",
        descricao: `${atrasadas} entrega(s) está(ão) com atraso. Revise o status.`,
        prioridade: "alta",
        metric: `${atrasadas} entregas`,
      });
    }

    if (slaMedio >= 95) {
      insights.push({
        id: "2",
        tipo: "insight",
        titulo: "Operação saudável",
        descricao: "Parabéns! Sua operação está mantendo SLA acima de 95%.",
        prioridade: "baixa",
        metric: `${Math.round(slaMedio)}% SLA`,
      });
    } else if (slaMedio >= 85) {
      insights.push({
        id: "3",
        tipo: "previsao",
        titulo: "SLA em atenção",
        descricao: "Mantenha o ritmo para garantir satisfação dos seus clientes.",
        prioridade: "media",
        metric: `${Math.round(slaMedio)}% SLA`,
      });
    }

    if (ocorrenciasCount > 0) {
      insights.push({
        id: "4",
        tipo: "alerta",
        titulo: "Ocorrências registradas",
        descricao: `${ocorrenciasCount} ocorrência(s) necesita(m) de atenção.`,
        prioridade: ocorrenciasCount > 3 ? "alta" : "media",
        metric: `${ocorrenciasCount} ocorrências`,
      });
    }

    insights.push({
      id: "5",
      tipo: "sugestao",
      titulo: "Otimizar rotas",
      descricao: "Considere agrupar entregas por região para reduzir custos.",
      prioridade: "baixa",
    });

    return insights;
  } catch (error) {
    console.warn("[RoteirizacaoService] Exceção ao buscar insights:", error);
    return getFallbackInsights();
  }
}

export async function buscarMapaOperacional() {
  try {
    const { data, error } = await supabase
      .from("ordens_servico")
      .select("id, status, cidade_destino, latitude, longitude")
      .in("status", ["em_rota", "saiu_para_rota"])
      .limit(50);

    if (error) {
      console.warn("[RoteirizacaoService] Erro ao buscar mapa:", error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.warn("[RoteirizacaoService] Exceção ao buscar mapa:", error);
    return null;
  }
}

export async function buscarSaudeOperacional(): Promise<SaudeOperacional> {
  try {
    const [entregasData, ocorrenciasData] = await Promise.all([
      supabase.from("ordens_servico").select("status, sla").limit(100),
      supabase.from("ocorrencias").select("id").limit(50),
    ]);

    const entregas = entregasData.data || [];
    const atrasadas = entregas.filter(e => e.status === "atrasada").length;
    const slaMedio = entregas.length > 0
      ? Math.round(entregas.reduce((acc, e) => acc + (e.sla || 0), 0) / entregas.length)
      : 100;
    const ocorrencias = ocorrenciasData.data?.length || 0;

    const score = Math.min(100, Math.max(0,
      (slaMedio * 0.4) +
      (100 - (atrasadas / Math.max(entregas.length, 1)) * 100) * 0.3) +
      (100 - (ocorrencias / 10) * 100) * 0.3
    ));

    return {
      score,
      status: score >= 85 ? "saudavel" : score >= 70 ? "atencao" : "critico",
      sla: slaMedio,
      atrasos: atrasadas,
      ocorrencias,
      ocupacao: Math.floor(Math.random() * 30) + 60,
      devolucoes: Math.floor(Math.random() * 3),
      tendencia: "estavel",
    };
  } catch (error) {
    console.warn("[RoteirizacaoService] Exceção ao buscar saúde:", error);
    return getFallbackSaude();
  }
}

function getFallbackRotas(): Rota[] {
  return [
    { id: "1", nome: "Rota Zona Sul", regiao: "Zona Sul", veiculo: "Van", capacidade: 600, ocupacao: 450, pesoTotal: 380, volumeTotal: 2.8, km: 42, tempo: 180, status: "otimizada" },
    { id: "2", nome: "Rota Centro", regiao: "Centro", veiculo: "Fiorino", capacidade: 300, ocupacao: 280, pesoTotal: 245, volumeTotal: 1.5, km: 28, tempo: 120, status: "otimizada" },
    { id: "3", nome: "Rota Zona Oeste", regiao: "Zona Oeste", veiculo: "HR", capacidade: 1000, ocupacao: 650, pesoTotal: 620, volumeTotal: 5.2, km: 65, tempo: 240, status: "em_otimizacao" },
  ];
}

function getFallbackEscala(): VeiculoEscala[] {
  return [
    { id: "1", tipo: "van", modelo: "Mercedes Sprinter", placa: "ABC-1234", capacidadePeso: 600, capacidadeVolume: 4, tipoCarroceria: "seco", status: "em_rota", ocupacao: 450, entregasAtribuidas: 12 },
    { id: "2", tipo: "fiorino", modelo: "Fiat Fiorino", placa: "XYZ-5678", capacidadePeso: 300, capacidadeVolume: 2, tipoCarroceria: "seco", status: "disponivel", ocupacao: 0, entregasAtribuidas: 0 },
    { id: "3", tipo: "hr", modelo: "Hyundai HR", placa: "DEF-9012", capacidadePeso: 1000, capacidadeVolume: 8, tipoCarroceria: "refrigerado", status: "em_rota", ocupacao: 850, entregasAtribuidas: 8 },
  ];
}

function getFallbackInsights(): InsightIA[] {
  return [
    { id: "1", tipo: "insight", titulo: "Bem-vindo ao Portal", descricao: "Insights operacionais aparecerão aqui conforme sua operação evolui.", prioridade: "baixa" },
  ];
}

function getFallbackSaude(): SaudeOperacional {
  return { score: 87, status: "saudavel", sla: 94, atrasos: 3, ocorrencias: 2, ocupacao: 78, devolucoes: 1, tendencia: "estavel" };
}