// ============================================================
// EXPRESS CONNECT HUB / TMS — MISSAO 53
// Servico de Controle de Patio
// ============================================================

import { supabase } from "@/lib/supabase";
import type {
  PatioUnidade, PatioDoca, PatioCheckin, PatioFila,
  PatioEvento, PatioRegraFila, PatioRodizio, PatioAlerta,
  PatioStatus, PatioDocaStatus, PatioCriterioFila,
} from "@/types/patio";

// ============================================================
// UNIDADES
// ============================================================
export async function listarUnidades(): Promise<PatioUnidade[]> {
  const { data } = await supabase.from("patio_unidades").select("*").order("nome");
  return data || [];
}

export async function obterUnidade(id: string) {
  const { data } = await supabase.from("patio_unidades").select("*").eq("id", id).single();
  return data as PatioUnidade | null;
}

// ============================================================
// DOCAS
// ============================================================
export async function listarDocas(unidadeId?: string): Promise<PatioDoca[]> {
  let q = supabase.from("patio_docas").select("*").order("posicao");
  if (unidadeId) q = q.eq("unidade_id", unidadeId);
  const { data } = await q;
  return (data || []) as PatioDoca[];
}

export async function atualizarDoca(id: string, updates: Partial<PatioDoca>) {
  return supabase.from("patio_docas").update(updates).eq("id", id);
}

// ============================================================
// CHECKINS
// ============================================================
export async function listarCheckins(filters?: {
  unidadeId?: string; status?: PatioStatus; clienteId?: string; busca?: string;
}): Promise<PatioCheckin[]> {
  let q = supabase.from("patio_checkins").select("*").order("created_at", { ascending: false }).limit(200);
  if (filters?.unidadeId) q = q.eq("unidade_id", filters.unidadeId);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.clienteId) q = q.eq("cliente_id", filters.clienteId);
  if (filters?.busca) q = q.or(`veiculo_placa.ilike.%${filters.busca}%,numero_os.ilike.%${filters.busca}%,motorista_nome.ilike.%${filters.busca}%`);
  const { data } = await q;
  return (data || []) as PatioCheckin[];
}

export async function criarCheckin(payload: Partial<PatioCheckin>) {
  const { data, error } = await supabase.from("patio_checkins").insert({
    ...payload,
    status: payload.status || "chegou_ao_patio",
    checkin_origem: payload.checkin_origem || "operacao",
    horario_chegada: payload.horario_chegada || new Date().toISOString(),
  }).select().single();
  if (error) throw error;

  await registrarEventoPatio({
    checkin_id: data.id,
    tipo_evento: "checkin_realizado",
    status_novo: data.status,
    descricao: `Check-in registrado via ${data.checkin_origem}. Placa: ${data.veiculo_placa}`,
    origem: data.checkin_origem,
  });

  return data as PatioCheckin;
}

export async function atualizarStatusCheckin(
  id: string, novoStatus: PatioStatus, extras?: Partial<PatioCheckin>
) {
  const { data: atual } = await supabase.from("patio_checkins").select("status,posicao_fila").eq("id", id).single();
  const statusAnterior = atual?.status;

  const updates: Record<string, unknown> = { status: novoStatus, ...extras };
  const now = new Date().toISOString();

  if (novoStatus === "chamado_para_doca") updates.chamado_para_doca_em = now;
  if (novoStatus === "carregamento_iniciado") updates.carregamento_inicio = now;
  if (novoStatus === "carregamento_concluido") updates.carregamento_fim = now;
  if (novoStatus === "saiu_do_patio") updates.horario_saida = now;

  const { error } = await supabase.from("patio_checkins").update(updates).eq("id", id);
  if (error) throw error;

  await registrarEventoPatio({
    checkin_id: id,
    tipo_evento: novoStatus,
    status_anterior: statusAnterior as PatioStatus,
    status_novo: novoStatus,
    descricao: `Status alterado para: ${novoStatus}`,
    origem: "operacao",
  });

  if (novoStatus === "chamado_para_doca" || novoStatus === "saiu_do_patio") {
    await recalcularFila(extras?.unidade_id);
  }
}

export async function atualizarPosicaoFila(checkinId: string, posicao: number) {
  return supabase.from("patio_checkins").update({ posicao_fila: posicao }).eq("id", checkinId);
}

export async function obterCheckin(id: string) {
  const { data } = await supabase.from("patio_checkins").select("*").eq("id", id).single();
  return data as PatioCheckin | null;
}

// ============================================================
// FILA
// ============================================================
export async function listarFila(unidadeId?: string): Promise<PatioFila[]> {
  let q = supabase.from("patio_fila").select("*").order("posicao");
  if (unidadeId) q = q.eq("unidade_id", unidadeId);
  const { data } = await q;
  return (data || []) as PatioFila[];
}

export async function recalcularFila(unidadeId?: string) {
  const { data: regras } = await supabase.from("patio_regras_fila")
    .select("*").eq("ativo", true).order("ordem");
  if (!regras?.length) return;

  const { data: checkins } = await supabase.from("patio_checkins")
    .select("*")
    .eq("status", "aguardando_fila")
    .order("horario_chegada");
  if (!checkins?.length) return;

  const criterio: PatioCriterioFila = regras[0].criterio;

  const ordenados = [...checkins].sort((a, b) => {
    switch (criterio) {
      case "prioridade": return (b.prioridade || 0) - (a.prioridade || 0);
      case "horario_agendado": return new Date(a.horario_previsto || "").getTime() - new Date(b.horario_previsto || "").getTime();
      case "ordem_chegada":
      default: return new Date(a.horario_chegada || "").getTime() - new Date(b.horario_chegada || "").getTime();
    }
  });

  for (let i = 0; i < ordenados.length; i++) {
    await supabase.from("patio_checkins").update({ posicao_fila: i + 1 }).eq("id", ordenados[i].id);
    await supabase.from("patio_fila").upsert({
      checkin_id: ordenados[i].id,
      unidade_id: unidadeId || ordenados[i].unidade_id,
      posicao: i + 1,
      criterio_ordenacao: criterio,
      criterio_detalhe: `Posicao definida por: ${criterio}`,
      status: "aguardando",
      entrou_na_fila_em: new Date().toISOString(),
    }, { onConflict: "checkin_id" });
  }
}

// ============================================================
// EVENTOS (TIMELINE)
// ============================================================
export async function listarEventos(checkinId: string): Promise<PatioEvento[]> {
  const { data } = await supabase.from("patio_eventos")
    .select("*").eq("checkin_id", checkinId).order("created_at", { ascending: false });
  return (data || []) as PatioEvento[];
}

async function registrarEventoPatio(payload: Partial<PatioEvento>) {
  return supabase.from("patio_eventos").insert({
    ...payload,
    origem: payload.origem || "operacao",
  });
}

// ============================================================
// REGRAS
// ============================================================
export async function listarRegras(unidadeId?: string): Promise<PatioRegraFila[]> {
  let q = supabase.from("patio_regras_fila").select("*").order("ordem");
  if (unidadeId) q = q.eq("unidade_id", unidadeId);
  const { data } = await q;
  return (data || []) as PatioRegraFila[];
}

export async function salvarRegra(regra: Partial<PatioRegraFila>) {
  if (regra.id) {
    return supabase.from("patio_regras_fila").update(regra).eq("id", regra.id);
  }
  return supabase.from("patio_regras_fila").insert(regra);
}

// ============================================================
// RODIZIO
// ============================================================
export async function listarRodizio(unidadeId?: string): Promise<PatioRodizio[]> {
  let q = supabase.from("patio_rodizio").select("*").order("tipo");
  if (unidadeId) q = q.eq("unidade_id", unidadeId);
  const { data } = await q;
  return (data || []) as PatioRodizio[];
}

// ============================================================
// ALERTAS
// ============================================================
export async function listarAlertas(apenasPendentes = true): Promise<PatioAlerta[]> {
  let q = supabase.from("patio_alertas").select("*").order("criado_em", { ascending: false }).limit(50);
  if (apenasPendentes) q = q.eq("resolvido", false);
  const { data } = await q;
  return (data || []) as PatioAlerta[];
}

export async function gerarAlertasAutomaticos() {
  const { data: checkins } = await supabase.from("patio_checkins")
    .select("*")
    .in("status", ["aguardando_fila", "aguardando_checkin", "aguardando_liberacao"])
    .gte("sla_espera_min", 120);

  if (!checkins?.length) return;

  for (const c of checkins) {
    const chegada = new Date(c.horario_chegada || c.created_at).getTime();
    const agora = Date.now();
    const minutos = Math.floor((agora - chegada) / 60000);

    if (minutos > (c.sla_espera_min || 120)) {
      const { data: existente } = await supabase.from("patio_alertas")
        .select("id").eq("checkin_id", c.id).eq("tipo", "sla_excedido").eq("resolvido", false).limit(1);
      if (!existente?.length) {
        await supabase.from("patio_alertas").insert({
          checkin_id: c.id,
          tipo: "sla_excedido",
          mensagem: `Veiculo ${c.veiculo_placa} aguardando ha ${minutos} min (SLA: ${c.sla_espera_min} min)`,
        });
        await supabase.from("patio_checkins").update({ risco_atraso: true }).eq("id", c.id);
      }
    }
  }
}

export async function resolverAlerta(id: string) {
  return supabase.from("patio_alertas").update({ resolvido: true, resolvido_em: new Date().toISOString() }).eq("id", id);
}

// ============================================================
// METRICAS / RELATORIOS
// ============================================================
export async function obterMetricasPatio(unidadeId?: string) {
  let q = supabase.from("patio_checkins").select("*");
  if (unidadeId) q = q.eq("unidade_id", unidadeId);
  const { data } = await q;

  const checkins = (data || []) as PatioCheckin[];
  const hoje = checkins.filter(c => c.created_at && new Date(c.created_at).toDateString() === new Date().toDateString());

  return {
    totalHoje: hoje.length,
    aguardando: checkins.filter(c => ["aguardando_fila", "aguardando_checkin", "aguardando_liberacao"].includes(c.status)).length,
    emCarregamento: checkins.filter(c => c.status === "carregamento_iniciado").length,
    concluidosHoje: hoje.filter(c => ["carregamento_concluido", "saiu_do_patio", "liberado_para_saida"].includes(c.status)).length,
    tempoMedioEspera: checkins.filter(c => c.tempo_aguardando_min > 0).reduce((s, c) => s + c.tempo_aguardando_min, 0) / Math.max(1, checkins.filter(c => c.tempo_aguardando_min > 0).length),
    tempoMedioCarregamento: checkins.filter(c => c.tempo_carregando_min > 0).reduce((s, c) => s + c.tempo_carregando_min, 0) / Math.max(1, checkins.filter(c => c.tempo_carregando_min > 0).length),
    noShows: checkins.filter(c => c.status === "no_show").length,
    docasOcupadas: checkins.filter(c => c.doca_id && ["em_doca", "carregamento_iniciado", "carregamento_pausado"].includes(c.status)).length,
  };
}

// ============================================================
// INTEGRACAO: Ordem de Servico -> Controle de Patio
// ============================================================
export interface OsParaPatioPayload {
  ordem_servico_id: string;
  numero_os: string;
  cliente_id?: string;
  cliente_nome?: string;
  prestador_nome?: string;
  motorista_nome?: string;
  veiculo_placa: string;
  veiculo_tipo?: string;
  tipo_carga?: string;
  origem?: string;
  destino?: string;
  observacao?: string;
  documento?: string;
  unidade_id?: string;
}

export async function enviarOsParaPatio(payload: OsParaPatioPayload): Promise<PatioCheckin | null> {
  const unidades = await listarUnidades();
  const unidadeId = payload.unidade_id || unidades[0]?.id;

  if (!unidadeId) throw new Error("Nenhuma unidade de patio configurada");

  const { data, error } = await supabase.from("patio_checkins").insert({
    ordem_servico_id: payload.ordem_servico_id,
    numero_os: payload.numero_os,
    cliente_id: payload.cliente_id,
    cliente_nome: payload.cliente_nome,
    prestador_nome: payload.prestador_nome,
    motorista_nome: payload.motorista_nome,
    veiculo_placa: payload.veiculo_placa,
    veiculo_tipo: payload.veiculo_tipo || "truck",
    tipo_carga: payload.tipo_carga || "carga_geral",
    origem: payload.origem,
    destino: payload.destino,
    documento: payload.documento,
    observacao: payload.observacao,
    unidade_id: unidadeId,
    status: "chegou_ao_patio",
    checkin_origem: "ordem_servico",
    horario_chegada: new Date().toISOString(),
  }).select().single();

  if (error) throw error;

  await registrarEventoPatio({
    checkin_id: data.id,
    tipo_evento: "checkin_os",
    status_novo: "chegou_ao_patio",
    descricao: `Check-in criado via OS ${payload.numero_os}. Placa: ${payload.veiculo_placa}`,
    origem: "ordem_servico",
  });

  return data as PatioCheckin;
}

// ============================================================
// INTEGRACAO: Portal do Cliente
// ============================================================
export async function buscarStatusPatioCliente(clienteId: string): Promise<PatioCheckin[]> {
  const { data } = await supabase.from("patio_checkins")
    .select("id, veiculo_placa, motorista_nome, status, posicao_fila, doca_nome, " +
            "tempo_aguardando_min, tempo_carregando_min, horario_chegada, " +
            "chamado_para_doca_em, carregamento_inicio, carregamento_fim, " +
            "numero_os, destino, created_at")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data || []) as PatioCheckin[];
}
