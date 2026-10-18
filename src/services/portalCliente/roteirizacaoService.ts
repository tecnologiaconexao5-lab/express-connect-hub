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

export interface Parada {
  id: string;
  rota_id: string;
  sequencia: number;
  cliente_nome: string;
  destinatario?: string;
  endereco: string;
  numero?: string;
  bairro?: string;
  cidade: string;
  uf?: string;
  cep?: string;
  latitude?: number;
  longitude?: number;
  peso?: number;
  volumes?: number;
  cubagem?: number;
  temperatura?: string;
  prioridade?: string;
  janela_entrega?: string;
  instrucoes?: string;
  status: string;
  recebedor?: string;
  assinatura_url?: string;
  pod_url?: string;
  fotos?: string[];
  ocorrencia?: string;
  data_hora?: string;
  data_entrega?: string;
  volumes_entregues?: number;
  observacoes?: string;
  pedido?: string;
  nota_fiscal?: string;
  contato?: string;
  tipo_carga?: string;
  os_id?: string;
  alocacao_id?: string;
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
  motoristaNome?: string;
  motoristaTelefone?: string;
  placa?: string;
  tipoVeiculo?: string;
  dataEscala?: string;
  horarioInicio?: string;
  horarioFim?: string;
  origem?: string;
  destino?: string;
  prestadorId?: string;
  veiculoId?: string;
  ordemServicoId?: string;
  aceitePrestador?: boolean;
  finalizada?: boolean;
  temComprovante?: boolean;
  trackingLat?: number;
  trackingLng?: number;
  numeroParadas?: number;
  paradasPendentes?: number;
  paradas?: Parada[];
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

function getPeriodoISO(periodo: string): { inicio: string; fim: string } {
  const now = new Date();
  let inicio: Date;
  switch (periodo) {
    case "7dias":
      inicio = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30dias":
      inicio = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90dias":
      inicio = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "mes_atual":
      inicio = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      inicio = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return {
    inicio: inicio.toISOString(),
    fim: now.toISOString(),
  };
}

function estimarKm(distanciaTexto: string | null, kmRealizados: number | null): number {
  if (kmRealizados && kmRealizados > 0) return kmRealizados;
  return 0;
}

export async function buscarRotas(clienteId?: string, periodo?: string): Promise<Rota[]> {
  if (!clienteId) return [];

  const { inicio, fim } = getPeriodoISO(periodo || "30dias");

  try {
    const { data: rotasData, error } = await supabase
      .from("rotas")
      .select(`
        id, nome, status, data_rota, tipo_rota,
        distancia_km, duracao_min, peso_total, volumes_total,
        veiculo_sugerido, prestador_id, motorista, veiculo,
        os_id, cliente_id, numero_paradas, paradas_pendentes,
        operation_mode, horario_previsto, horario_realizado,
        origem, destino_final, created_at
      `)
      .eq("cliente_id", clienteId)
      .gte("created_at", inicio)
      .lte("created_at", fim)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.warn("[RoteirizacaoService] Erro ao buscar rotas:", error.message);
      return [];
    }

    if (!rotasData || rotasData.length === 0) return [];

    const prestadorIds = [...new Set(rotasData.map(r => r.prestador_id).filter(Boolean))];
    let prestadoresMap: Record<string, { nome: string; telefone: string }> = {};
    if (prestadorIds.length > 0) {
      const { data: prestadores } = await supabase
        .from("prestadores")
        .select("id, nome_completo, telefone")
        .in("id", prestadorIds);
      if (prestadores) {
        prestadoresMap = Object.fromEntries(
          prestadores.map(p => [p.id, { nome: p.nome_completo || "N/I", telefone: p.telefone || "" }])
        );
      }
    }

    const rotas: Rota[] = rotasData.map((r) => {
      const prestadorInfo = r.prestador_id ? prestadoresMap[r.prestador_id] : undefined;
      return {
        id: r.id,
        nome: r.nome || `Rota ${r.id?.slice(0, 8) || ""}`,
        regiao: r.origem?.split(",")[0]?.trim() || "N/I",
        veiculo: r.veiculo_sugerido || r.veiculo || "N/I",
        capacidade: obterCapacidadePadrao(r.veiculo_sugerido || ""),
        ocupacao: r.numero_paradas && r.paradas_pendentes != null
          ? Math.round(((r.numero_paradas - r.paradas_pendentes) / r.numero_paradas) * 100) : 0,
        pesoTotal: r.peso_total || 0,
        volumeTotal: r.volumes_total || 0,
        km: r.distancia_km || 0,
        tempo: r.duracao_min || 0,
        status: r.status || "programacao",
        motoristaNome: r.motorista || prestadorInfo?.nome,
        motoristaTelefone: prestadorInfo?.telefone,
        placa: r.veiculo || "",
        tipoVeiculo: r.veiculo_sugerido || "",
        dataEscala: r.data_rota,
        horarioInicio: r.horario_previsto || "",
        horarioFim: r.horario_realizado || "",
        origem: r.origem || "",
        destino: r.destino_final || "",
        prestadorId: r.prestador_id,
        ordemServicoId: r.os_id,
        aceitePrestador: r.status !== "pendente",
        finalizada: r.status === "concluida",
        temComprovante: false,
        numeroParadas: r.numero_paradas || 0,
        paradasPendentes: r.paradas_pendentes || 0,
      };
    });

    return rotas;
  } catch (error) {
    console.warn("[RoteirizacaoService] Exceção ao buscar rotas:", error);
    return [];
  }
}

export async function buscarParadasDaRota(rotaId: string): Promise<Parada[]> {
  if (!rotaId) return [];
  try {
    const { data, error } = await supabase
      .from("rota_paradas")
      .select("*")
      .eq("rota_id", rotaId)
      .order("sequencia", { ascending: true });

    if (error || !data) return [];
    return data as Parada[];
  } catch (e) {
    console.warn("[RoteirizacaoService] Erro ao buscar paradas:", e);
    return [];
  }
}

function obterCapacidadePadrao(tipo: string): number {
  const mapa: Record<string, number> = {
    moto: 30, fiorino: 300, van: 600, hr: 1000,
    vuc: 2000, truck: 10000, carreta: 15000, bitrem: 25000,
  };
  return mapa[tipo.toLowerCase()] || 600;
}

export async function buscarEscala(clienteId?: string, periodo?: string): Promise<VeiculoEscala[]> {
  if (!clienteId) return [];

  const { inicio, fim } = getPeriodoISO(periodo || "30dias");

  try {
    const { data: veiculosUsados, error } = await supabase
      .from("alocacoes_escala")
      .select("tipo_veiculo, placa, prestador_id")
      .eq("cliente_id", clienteId)
      .gte("created_at", inicio)
      .lte("created_at", fim)
      .not("tipo_veiculo", "is", null)
      .limit(100);

    if (error) {
      console.warn("[RoteirizacaoService] Erro ao buscar escala:", error.message);
      return [];
    }

    if (!veiculosUsados || veiculosUsados.length === 0) return [];

    const veiculoMap = new Map<string, { tipo: string; placa: string; count: number }>();
    for (const v of veiculosUsados) {
      const key = `${v.tipo_veiculo}-${v.placa || v.prestador_id}`;
      const existing = veiculoMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        veiculoMap.set(key, { tipo: v.tipo_veiculo || "van", placa: v.placa || "---", count: 1 });
      }
    }

    return Array.from(veiculoMap.entries()).map(([key, v], idx) => ({
      id: key,
      tipo: v.tipo,
      modelo: v.tipo,
      placa: v.placa,
      capacidadePeso: obterCapacidadePadrao(v.tipo),
      capacidadeVolume: 4,
      tipoCarroceria: "seco",
      status: "em_operacao",
      ocupacao: 0,
      entregasAtribuidas: v.count,
    }));
  } catch (error) {
    console.warn("[RoteirizacaoService] Exceção ao buscar escala:", error);
    return [];
  }
}

export async function buscarInsights(clienteId?: string, clienteNome?: string): Promise<InsightIA[]> {
  if (!clienteId) return [];

  try {
    const { data: alocacoes } = await supabase
      .from("alocacoes_escala")
      .select("status, finalizada, aceite_prestador")
      .eq("cliente_id", clienteId)
      .limit(100);

    const { data: ocorrencias } = await supabase
      .from("portal_ocorrencias")
      .select("id, tipo")
      .eq("cliente_id", clienteId)
      .limit(20);

    const alocs = alocacoes || [];
    const total = alocs.length;
    const pendentes = alocs.filter(a => a.status === "pendente" || a.status === "programacao").length;
    const emAndamento = alocs.filter(a => a.status === "em_rota" || a.status === "saiu_para_rota").length;
    const concluidas = alocs.filter(a => a.finalizada || a.status === "entrega_concluida").length;
    const semAceite = alocs.filter(a => !a.aceite_prestador && !a.finalizada).length;
    const ocorrenciasCount = ocorrencias?.length || 0;

    const insights: InsightIA[] = [];

    if (pendentes > 0) {
      insights.push({
        id: "1", tipo: "alerta",
        titulo: "Rotas pendentes de execução",
        descricao: `${pendentes} rota(s) aguardando início. Verifique o status.`,
        prioridade: pendentes > 5 ? "alta" : "media",
        metric: `${pendentes} pendentes`,
      });
    }

    if (emAndamento > 0) {
      insights.push({
        id: "2", tipo: "insight",
        titulo: "Operação em andamento",
        descricao: `${emAndamento} rota(s) ativa(s) no momento.`,
        prioridade: "baixa",
        metric: `${emAndamento} ativas`,
      });
    }

    if (semAceite > 0) {
      insights.push({
        id: "3", tipo: "alerta",
        titulo: "Rotas sem aceite do motorista",
        descricao: `${semAceite} rota(s) ainda não foram aceitas pelo motorista.`,
        prioridade: semAceite > 3 ? "alta" : "media",
        metric: `${semAceite} sem aceite`,
      });
    }

    if (concluidas >= 10) {
      insights.push({
        id: "4", tipo: "insight",
        titulo: "Volume de entregas concluídas",
        descricao: `${concluidas} entrega(s) finalizada(s) no período.`,
        prioridade: "baixa",
        metric: `${concluidas} concluídas`,
      });
    }

    if (ocorrenciasCount > 0) {
      insights.push({
        id: "5", tipo: "alerta",
        titulo: "Ocorrências registradas",
        descricao: `${ocorrenciasCount} ocorrência(s) no período.`,
        prioridade: ocorrenciasCount > 3 ? "alta" : "media",
        metric: `${ocorrenciasCount} ocorrências`,
      });
    }

    if (total === 0) {
      insights.push({
        id: "6", tipo: "sugestao",
        titulo: "Nenhuma rota encontrada",
        descricao: "Ainda não há rotas para este período. Tente ampliar o filtro.",
        prioridade: "baixa",
      });
    }

    return insights;
  } catch (error) {
    console.warn("[RoteirizacaoService] Exceção ao buscar insights:", error);
    return [];
  }
}

export async function buscarMapaOperacional(clienteId?: string) {
  if (!clienteId) return null;

  try {
    const { data, error } = await supabase
      .from("alocacoes_escala")
      .select("id, status, origem, destino, prestador_id, tipo_veiculo, placa")
      .eq("cliente_id", clienteId)
      .in("status", ["em_rota", "saiu_para_rota", "coleta"])
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

export async function buscarSaudeOperacional(clienteId?: string, periodo?: string): Promise<SaudeOperacional> {
  if (!clienteId) return { score: 0, status: "critico", sla: 0, atrasos: 0, ocorrencias: 0, ocupacao: 0, devolucoes: 0, tendencia: "estavel" };

  const { inicio, fim } = getPeriodoISO(periodo || "30dias");

  try {
    const [alocacoesData, ocorrenciasData] = await Promise.all([
      supabase
        .from("alocacoes_escala")
        .select("status, finalizada, aceite_prestador")
        .eq("cliente_id", clienteId)
        .gte("created_at", inicio)
        .lte("created_at", fim)
        .limit(200),
      supabase
        .from("portal_ocorrencias")
        .select("id")
        .eq("cliente_id", clienteId)
        .gte("created_at", inicio)
        .lte("created_at", fim)
        .limit(50),
    ]);

    const alocs = alocacoesData.data || [];
    const totalAlocs = alocs.length;
    const concluidas = alocs.filter(a => a.finalizada || a.status === "entrega_concluida").length;
    const atrasadas = alocs.filter(a => a.status === "atrasada").length;
    const aceitas = alocs.filter(a => a.aceite_prestador).length;
    const ocorrencias = ocorrenciasData.data?.length || 0;

    const sla = totalAlocs > 0 ? Math.round((concluidas / totalAlocs) * 100) : 100;
    const ocupacao = totalAlocs > 0 ? Math.round((aceitas / totalAlocs) * 100) : 0;

    const score = Math.min(100, Math.max(0,
      (sla * 0.4) +
      (100 - (atrasadas / Math.max(totalAlocs, 1)) * 100) * 0.3 +
      (100 - (ocorrencias / Math.max(totalAlocs, 1)) * 100) * 0.3
    ));

    return {
      score,
      status: score >= 85 ? "saudavel" : score >= 70 ? "atencao" : "critico",
      sla,
      atrasos: atrasadas,
      ocorrencias,
      ocupacao,
      devolucoes: 0,
      tendencia: score >= 80 ? "subindo" : score >= 60 ? "estavel" : "caindo",
    };
  } catch (error) {
    console.warn("[RoteirizacaoService] Exceção ao buscar saúde:", error);
    return { score: 0, status: "critico", sla: 0, atrasos: 0, ocorrencias: 0, ocupacao: 0, devolucoes: 0, tendencia: "estavel" };
  }
}
