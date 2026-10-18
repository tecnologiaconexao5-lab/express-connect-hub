import { supabase } from "@/lib/supabase";

export interface VeiculoFrota {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  tipo: string;
  status: string;
  seguro_apolice: string | null;
  validade_documental: string | null;
  custo_km: number | null;
  custo_diaria: number | null;
  rastreador: string | null;
  observacoes: string | null;
  prestador_vinculado: string | null;
}

export interface DespesaOperacional {
  id: string;
  categoria: string;
  subcategoria: string | null;
  descricao: string;
  valor: number;
  veiculo_id: string | null;
  data_competencia: string;
  status: string;
  comprovante_url: string | null;
  placa?: string;
}

export async function listarVeiculos(): Promise<VeiculoFrota[]> {
  const { data, error } = await supabase
    .from("veiculos")
    .select("id, placa, marca, modelo, ano_fabricacao, tipo, status, seguro_apolice, validade_documental, custo_km, custo_diaria, rastreador, observacoes, prestador_vinculado")
    .order("placa");

  if (error) throw error;
  return (data || []).map((v: any) => ({
    id: v.id,
    placa: v.placa || "",
    marca: v.marca || "",
    modelo: v.modelo || "",
    ano: v.ano_fabricacao || 0,
    tipo: v.tipo || "",
    status: v.status || "ativo",
    seguro_apolice: v.seguro_apolice || null,
    validade_documental: v.validade_documental || null,
    custo_km: v.custo_km ? Number(v.custo_km) : null,
    custo_diaria: v.custo_diaria ? Number(v.custo_diaria) : null,
    rastreador: v.rastreador || null,
    observacoes: v.observacoes || null,
    prestador_vinculado: v.prestador_vinculado || null,
  }));
}

export async function listarDespesas(
  categoria?: string,
  limite = 50
): Promise<DespesaOperacional[]> {
  let query = supabase
    .from("despesas_operacionais")
    .select("*, veiculos!inner(placa)")
    .order("data_competencia", { ascending: false })
    .limit(limite);

  if (categoria) {
    query = query.eq("categoria", categoria);
  }

  const { data, error } = await query;
  if (error) {
    const { data: fallback, error: err2 } = await supabase
      .from("despesas_operacionais")
      .select("*")
      .order("data_competencia", { ascending: false })
      .limit(limite);
    if (err2) throw err2;
    return (fallback || []).map((d: any) => ({
      id: d.id,
      categoria: d.categoria,
      subcategoria: d.subcategoria,
      descricao: d.descricao,
      valor: Number(d.valor),
      veiculo_id: d.veiculo_id,
      data_competencia: d.data_competencia,
      status: d.status || "pendente",
      comprovante_url: d.comprovante_url || null,
      placa: undefined,
    }));
  }

  return (data || []).map((d: any) => ({
    id: d.id,
    categoria: d.categoria,
    subcategoria: d.subcategoria,
    descricao: d.descricao,
    valor: Number(d.valor),
    veiculo_id: d.veiculo_id,
    data_competencia: d.data_competencia,
    status: d.status || "pendente",
    comprovante_url: d.comprovante_url || null,
    placa: d.veiculos?.placa || undefined,
  }));
}

export async function listarManutencoes(limite = 20): Promise<DespesaOperacional[]> {
  return listarDespesas("manutencao", limite);
}

export async function listarAbastecimentos(limite = 20): Promise<DespesaOperacional[]> {
  return listarDespesas("combustivel", limite);
}

export interface MetricasFrota {
  total_veiculos: number;
  veiculos_ativos: number;
  gasto_combustivel_mes: number;
  gasto_manutencao_mes: number;
  gasto_total_mes: number;
  veiculos_manutencao: number;
}

export async function obterMetricasFrota(): Promise<MetricasFrota> {
  const { data: veiculos, error: err1 } = await supabase
    .from("veiculos")
    .select("status");

  if (err1) throw err1;

  const total = veiculos?.length || 0;
  const ativos = veiculos?.filter((v: any) => v.status === "ativo").length || 0;
  const manutencao = veiculos?.filter((v: any) => v.status === "manutencao").length || 0;

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const { data: despesas, error: err2 } = await supabase
    .from("despesas_operacionais")
    .select("categoria, valor")
    .gte("data_competencia", inicioMes.toISOString());

  if (err2) throw err2;

  const combustivelMes = (despesas || [])
    .filter((d: any) => d.categoria === "combustivel")
    .reduce((acc: number, d: any) => acc + Number(d.valor), 0);

  const manutencaoMes = (despesas || [])
    .filter((d: any) => d.categoria === "manutencao")
    .reduce((acc: number, d: any) => acc + Number(d.valor), 0);

  return {
    total_veiculos: total,
    veiculos_ativos: ativos,
    gasto_combustivel_mes: combustivelMes,
    gasto_manutencao_mes: manutencaoMes,
    gasto_total_mes: combustivelMes + manutencaoMes,
    veiculos_manutencao: manutencao,
  };
}

export interface CustoVeiculo {
  placa: string;
  veiculo_id: string;
  total_combustivel: number;
  total_manutencao: number;
  total_outros: number;
  total_geral: number;
}

export async function listarCustosVeiculo(): Promise<CustoVeiculo[]> {
  const { data, error } = await supabase
    .from("despesas_operacionais")
    .select("veiculo_id, categoria, valor");

  if (error) throw error;

  const veiculoIds = [...new Set((data || []).map((d: any) => d.veiculo_id).filter(Boolean))];

  const { data: veiculos } = await supabase
    .from("veiculos")
    .select("id, placa")
    .in("id", veiculoIds.length > 0 ? veiculoIds : ["00000000-0000-0000-0000-000000000000"]);

  const placaMap = new Map((veiculos || []).map((v: any) => [v.id, v.placa]));

  const custoMap = new Map<string, CustoVeiculo>();

  for (const d of data || []) {
    if (!d.veiculo_id) continue;
    const existing = custoMap.get(d.veiculo_id) || {
      placa: placaMap.get(d.veiculo_id) || "N/I",
      veiculo_id: d.veiculo_id,
      total_combustivel: 0,
      total_manutencao: 0,
      total_outros: 0,
      total_geral: 0,
    };
    const valor = Number(d.valor);
    if (d.categoria === "combustivel") existing.total_combustivel += valor;
    else if (d.categoria === "manutencao") existing.total_manutencao += valor;
    else existing.total_outros += valor;
    existing.total_geral += valor;
    custoMap.set(d.veiculo_id, existing);
  }

  return Array.from(custoMap.values()).sort((a, b) => b.total_geral - a.total_geral);
}
