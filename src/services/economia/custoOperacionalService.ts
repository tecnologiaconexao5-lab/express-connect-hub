import { supabase } from "@/lib/supabase";
import { precoCombustivelParaCalculo } from "@/services/combustiveis";

export type TipoCombustivelEconomia = "diesel" | "gasolina" | "etanol";

export interface ParametrosEconomicosVeiculo {
  consumoKmPorL: number;
  custoManutencaoKm: number;
  tipoCombustivel: TipoCombustivelEconomia;
  origem: "veiculo" | "prestador" | "padrao";
}

export interface ResultadoCustoOperacional {
  distanciaKm: number;
  litrosEstimados: number;
  precoCombustivel: number;
  custoCombustivel: number;
  custoManutencao: number;
  pedagio: number;
  custoTotal: number;
  custoPorKm: number;
  parametros: ParametrosEconomicosVeiculo;
}

const CONSUMO_PADRAO: Record<string, number> = {
  moto: 30,
  passeio: 12,
  carro_passeio: 12,
  fiorino: 12,
  kangoo: 12,
  kombi: 9,
  van: 10,
  hr: 11,
  vuc: 9,
  "3_4": 8,
  "3/4": 8,
  toco: 7,
  truck: 5.5,
  bitruck: 5,
  carreta: 3.5,
  carreta_ls: 3.5,
  bitrem: 3,
  rodotrem: 2.5,
  cavalo_mecanico: 5,
  bau_urbano: 9,
  dedicado: 8,
  refrigerado_leve: 10,
};

const MANUTENCAO_PADRAO_KM = 0.35;

const normalizarTipo = (tipo?: string | null): string =>
  String(tipo || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");

const normalizarCombustivel = (tipo?: string | null): TipoCombustivelEconomia => {
  const t = String(tipo || "").toLowerCase();
  if (t.includes("diesel")) return "diesel";
  if (t.includes("etanol") || t.includes("alcool") || t.includes("álcool")) return "etanol";
  return "gasolina";
};

export function consumoPadraoPorTipo(tipoVeiculo?: string | null): number {
  const chave = normalizarTipo(tipoVeiculo);
  return CONSUMO_PADRAO[chave] ?? 9;
}

export function parametrosPadraoVeiculo(tipoVeiculo?: string | null): ParametrosEconomicosVeiculo {
  return {
    consumoKmPorL: consumoPadraoPorTipo(tipoVeiculo),
    custoManutencaoKm: MANUTENCAO_PADRAO_KM,
    // Moto/passeio/fiorino usam gasolina; os demais defaults usam diesel.
    tipoCombustivel:
      ["moto", "passeio", "carro_passeio"].includes(normalizarTipo(tipoVeiculo))
        ? "gasolina"
        : "diesel",
    origem: "padrao",
  };
}

function montarParametros(
  row: Record<string, unknown> | null | undefined,
  tipoVeiculo: string | null | undefined,
  origem: "veiculo" | "prestador",
): ParametrosEconomicosVeiculo | null {
  if (!row) return null;
  const consumo = Number(row.media_consumo_km_l);
  const manutencao = Number(row.custo_manutencao_km);
  const combustivel = row.tipo_combustivel == null ? null : String(row.tipo_combustivel);
  if (!(consumo > 0) && !(manutencao > 0) && !combustivel) return null;
  const padrao = parametrosPadraoVeiculo(tipoVeiculo);
  return {
    consumoKmPorL: consumo > 0 ? consumo : padrao.consumoKmPorL,
    custoManutencaoKm: manutencao >= 0 ? manutencao : padrao.custoManutencaoKm,
    tipoCombustivel: combustivel ? normalizarCombustivel(combustivel) : padrao.tipoCombustivel,
    origem,
  };
}

export async function buscarParametrosEconomicosVeiculo(input: {
  tipoVeiculo?: string | null;
  veiculoPlaca?: string | null;
  prestadorId?: string | null;
}): Promise<ParametrosEconomicosVeiculo> {
  const padrao = parametrosPadraoVeiculo(input.tipoVeiculo);
  try {
    if (input.veiculoPlaca?.trim()) {
      const { data } = await supabase
        .from("veiculos")
        .select("media_consumo_km_l, custo_manutencao_km, tipo_combustivel, tipo_veiculo")
        .eq("placa", input.veiculoPlaca.trim().toUpperCase())
        .maybeSingle();
      const parametros = montarParametros(
        data as Record<string, unknown> | null,
        input.tipoVeiculo || (data as { tipo_veiculo?: string } | null)?.tipo_veiculo,
        "veiculo",
      );
      if (parametros) return parametros;
    }

    if (input.prestadorId?.trim()) {
      const { data } = await supabase
        .from("prestadores")
        .select("media_consumo_km_l, custo_manutencao_km, tipo_combustivel")
        .eq("id", input.prestadorId.trim())
        .maybeSingle();
      const parametros = montarParametros(data as Record<string, unknown> | null, input.tipoVeiculo, "prestador");
      if (parametros) return parametros;
    }
  } catch (erro) {
    console.warn("[CustoOperacional] Não foi possível ler parâmetros do veículo:", erro);
  }
  return padrao;
}

export function calcularCustoOperacional(input: {
  distanciaKm: number;
  parametros: ParametrosEconomicosVeiculo;
  precoCombustivel?: number;
  pedagio?: number;
}): ResultadoCustoOperacional {
  const distanciaKm = Math.max(0, Number(input.distanciaKm) || 0);
  const pedagio = Math.max(0, Number(input.pedagio) || 0);
  const preco = input.precoCombustivel ?? precoCombustivelParaCalculo(input.parametros.tipoCombustivel);
  const litros = input.parametros.consumoKmPorL > 0 ? distanciaKm / input.parametros.consumoKmPorL : 0;
  const custoCombustivel = litros * preco;
  const custoManutencao = distanciaKm * Math.max(0, input.parametros.custoManutencaoKm);
  const custoTotal = custoCombustivel + custoManutencao + pedagio;
  return {
    distanciaKm,
    litrosEstimados: Math.round(litros * 100) / 100,
    precoCombustivel: preco,
    custoCombustivel: Math.round(custoCombustivel * 100) / 100,
    custoManutencao: Math.round(custoManutencao * 100) / 100,
    pedagio,
    custoTotal: Math.round(custoTotal * 100) / 100,
    custoPorKm: distanciaKm > 0 ? Math.round((custoTotal / distanciaKm) * 100) / 100 : 0,
    parametros: input.parametros,
  };
}

export async function estimarCustoOperacional(input: {
  distanciaKm: number;
  tipoVeiculo?: string | null;
  veiculoPlaca?: string | null;
  prestadorId?: string | null;
  pedagio?: number;
}): Promise<ResultadoCustoOperacional> {
  const parametros = await buscarParametrosEconomicosVeiculo(input);
  return calcularCustoOperacional({
    distanciaKm: input.distanciaKm,
    parametros,
    pedagio: input.pedagio,
  });
}
