// ============================================================
// Portal do Prestador — Rede de Oportunidades (app mobile)
// Lê as oportunidades publicadas em `rede_oportunidades` e
// normaliza os dados da OS para os cards da aba "Rede".
// ============================================================

import { supabase } from "@/lib/supabase";

export interface OportunidadeRedeMobile {
  id: string;
  osId: string | null;
  osNumero: string | null;
  status: string;
  origem: string;
  destino: string;
  regiao: string | null;
  distanciaKm: number;
  valorPrestador: number;
  veiculo: string;
  tipoCarga: string;
  peso: number;
  prazoExpiracao: string | null;
}

interface OsRelacionada {
  numero?: string | null;
  origem?: string | null;
  destino?: string | null;
  distancia_km?: number | string | null;
  tipo_carga?: string | null;
  peso?: number | string | null;
}

interface OportunidadeRow {
  id: string;
  os_id?: string | null;
  status?: string | null;
  valor_prestador?: number | string | null;
  veiculo_necessario?: unknown;
  regiao?: string | null;
  prazo_expiracao?: string | null;
  ordens_servico?: OsRelacionada | OsRelacionada[] | null;
}

const numero = (valor: unknown): number => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

const texto = (valor: unknown): string => (typeof valor === "string" ? valor.trim() : "");

const objeto = (valor: unknown): Record<string, unknown> =>
  valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};

function osDaOportunidade(valor: OportunidadeRow["ordens_servico"]): OsRelacionada {
  if (Array.isArray(valor)) return valor[0] || {};
  return valor || {};
}

function veiculoDaOportunidade(valor: unknown): string {
  const veiculo = objeto(valor);
  return texto(veiculo.tipo) || texto(veiculo.veiculo) || "Moto";
}

export async function buscarOportunidadesRede(): Promise<OportunidadeRedeMobile[]> {
  const { data, error } = await supabase
    .from("rede_oportunidades")
    .select(
      "id, os_id, status, valor_prestador, veiculo_necessario, regiao, prazo_expiracao, ordens_servico:os_id(numero, origem, destino, distancia_km, tipo_carga, peso)",
    )
    .in("status", ["publicada", "visualizada", "interessada"])
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);

  return ((data || []) as unknown as OportunidadeRow[]).map((row) => {
    const os = osDaOportunidade(row.ordens_servico);
    return {
      id: row.id,
      osId: row.os_id || null,
      osNumero: texto(os.numero) || null,
      status: texto(row.status) || "publicada",
      origem: texto(os.origem) || "Origem não informada",
      destino: texto(os.destino) || "Destino não informado",
      regiao: texto(row.regiao) || null,
      distanciaKm: numero(os.distancia_km),
      valorPrestador: numero(row.valor_prestador),
      veiculo: veiculoDaOportunidade(row.veiculo_necessario),
      tipoCarga: texto(os.tipo_carga) || "seca",
      peso: numero(os.peso),
      prazoExpiracao: row.prazo_expiracao || null,
    };
  });
}

export async function aceitarOportunidadeRede(id: string): Promise<void> {
  const { error } = await supabase
    .from("rede_oportunidades")
    .update({ status: "aceita", aceite_em: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export interface ChegadaMotoristaInput {
  osId: string;
  alocacaoId?: string | null;
  latitude: number;
  longitude: number;
}

/** Check-in "Cheguei no local": grava a posição GPS que alimenta a Torre. */
export async function registrarChegadaMotorista(input: ChegadaMotoristaInput): Promise<void> {
  const { error } = await supabase.from("portal_tracking_realtime").insert([
    {
      alocacao_id: input.alocacaoId || null,
      os_id: input.osId,
      latitude: input.latitude,
      longitude: input.longitude,
      velocidade: 0,
      precisao: 5,
      status: "chegou",
      origem: "app_motorista",
      captured_at: new Date().toISOString(),
    },
  ]);

  if (error) throw new Error(error.message);
}

export interface FinalizacaoPODInput {
  osId: string;
  alocacaoId?: string | null;
  fotoEntregaUrl: string;
  assinaturaUrl: string;
  recebedor?: string;
  observacao?: string;
}

/** Baixa final da OS: POD (foto + assinatura) e status concluído. */
export async function finalizarOSComPOD(input: FinalizacaoPODInput): Promise<void> {
  const agora = new Date().toISOString();

  const { error: erroPod } = await supabase.from("entregas_protocolo").insert([
    {
      alocacao_id: input.alocacaoId || null,
      ordem_servico_id: input.osId,
      nome_recebedor: input.recebedor || "Recebedor E2E",
      foto_entrega_url: input.fotoEntregaUrl,
      assinatura_url: input.assinaturaUrl,
      data_hora_entrega: agora,
      observacao: input.observacao || "Baixa realizada pelo App do Motorista",
      status: "entregue",
    },
  ]);
  if (erroPod) throw new Error(erroPod.message);

  if (input.alocacaoId) {
    await supabase
      .from("alocacoes_escala")
      .update({ status: "concluida", finalizada: true, data_finalizacao: agora })
      .eq("id", input.alocacaoId);
  }

  const { error: erroOS } = await supabase
    .from("ordens_servico")
    .update({ status: "finalizada", updated_at: agora })
    .eq("id", input.osId);
  if (erroOS) throw new Error(erroOS.message);
}

export function formatarMoedaOportunidade(valor: number): string {  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function formatarDistanciaOportunidade(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return "—";
  return `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}
