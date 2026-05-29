import { supabase } from "@/lib/supabase";

const STATUS_OS_PARA_ESCALA: Record<string, string> = {
  rascunho: "planejada",
  pendente: "aguardando_aceite",
  agendada: "aceita",
  em_andamento: "aceita",
  em_rota: "em_rota",
  coletado: "em_rota",
  entregue: "concluida",
  finalizada: "concluida",
  cancelada: "cancelada",
  ocorrencia: "ocorrencia",
};

function mapearStatusOSParaEscala(statusOS: string): string {
  return STATUS_OS_PARA_ESCALA[statusOS] || "planejada";
}

export type DivergenciaTipo =
  | "sincronizada"
  | "os_sem_escala"
  | "escala_sem_os"
  | "divergencia_prestador"
  | "divergencia_veiculo"
  | "divergencia_data"
  | "divergencia_status"
  | "sincronizacao_pendente"
  | "alterado_manualmente";

export interface DiagnosticoSincronizacao {
  existeAlocacao: boolean;
  alocacaoId?: string;
  alocacao?: Record<string, any>;
  status: DivergenciaTipo;
  label: string;
  descricao: string;
  classeBadge: string;
  divergencias: {
    prestador: boolean;
    veiculo: boolean;
    data: boolean;
    status: boolean;
  };
}

const STATUS_SYNC_INFO: Record<DivergenciaTipo, { label: string; classe: string }> = {
  sincronizada:          { label: "Sincronizada",       classe: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  os_sem_escala:        { label: "OS sem Escala",      classe: "bg-amber-50 text-amber-700 border-amber-200" },
  escala_sem_os:        { label: "Sem OS",             classe: "bg-slate-100 text-slate-500 border-slate-200" },
  divergencia_prestador:{ label: "Prestador Divergente",classe: "bg-red-50 text-red-700 border-red-200" },
  divergencia_veiculo:  { label: "Veículo Divergente",  classe: "bg-red-50 text-red-700 border-red-200" },
  divergencia_data:     { label: "Data Divergente",     classe: "bg-red-50 text-red-700 border-red-200" },
  divergencia_status:   { label: "Status Divergente",   classe: "bg-orange-50 text-orange-700 border-orange-200" },
  sincronizacao_pendente:{ label: "Sinc. Pendente",     classe: "bg-amber-50 text-amber-700 border-amber-200" },
  alterado_manualmente: { label: "Alterado Manualmente",classe: "bg-blue-50 text-blue-700 border-blue-200" },
};

export function obterInfoDivergencia(tipo: DivergenciaTipo) {
  return STATUS_SYNC_INFO[tipo] || STATUS_SYNC_INFO.os_sem_escala;
}

export function obterClasseBadgeDivergencia(tipo: DivergenciaTipo): string {
  return obterInfoDivergencia(tipo).classe;
}

export function obterLabelDivergencia(tipo: DivergenciaTipo): string {
  return obterInfoDivergencia(tipo).label;
}

export async function diagnosticarOS(osId: string): Promise<DiagnosticoSincronizacao> {
  const resultado: DiagnosticoSincronizacao = {
    existeAlocacao: false,
    status: "os_sem_escala",
    label: "OS sem Escala",
    descricao: "Nenhuma alocação na escala vinculada a esta OS",
    classeBadge: STATUS_SYNC_INFO.os_sem_escala.classe,
    divergencias: { prestador: false, veiculo: false, data: false, status: false },
  };

  if (!osId) return resultado;

  try {
    const { data: alocacao, error } = await supabase
      .from("alocacoes_escala")
      .select("*")
      .eq("ordem_servico_id", osId)
      .limit(1)
      .maybeSingle();

    if (error || !alocacao) return resultado;

    resultado.existeAlocacao = true;
    resultado.alocacaoId = alocacao.id;
    resultado.alocacao = alocacao;

    const { data: osData } = await supabase
      .from("ordens_servico")
      .select("*")
      .eq("id", osId)
      .single();

    if (!osData) {
      resultado.status = "os_sem_escala";
      return resultado;
    }

    let prestadorOk = true;
    let veiculoOk = true;
    let dataOk = true;
    let statusOk = true;
    const divergencias: string[] = [];

    if (alocacao.prestador_id && osData.prestador_id) {
      prestadorOk = String(alocacao.prestador_id) === String(osData.prestador_id);
      if (!prestadorOk) divergencias.push("prestador");
    } else if (alocacao.prestador_id && !osData.prestador_id) {
      prestadorOk = String(alocacao.prestador_id) === osData.prestador;
      if (!prestadorOk) divergencias.push("prestador (nome)");
    }

    const veiculoAloc = (alocacao.tipo_veiculo || "").toLowerCase().trim();
    const veiculoOS = (osData.tipo_veiculo || "").toLowerCase().trim();
    if (veiculoAloc && veiculoOS) {
      veiculoOk = veiculoAloc === veiculoOS;
      if (!veiculoOk) divergencias.push("veículo");
    }

    const dataAloc = alocacao.data_escala?.split("T")[0];
    const dataOS = (osData.data || osData.data_programada || "").split("T")[0];
    if (dataAloc && dataOS) {
      dataOk = dataAloc === dataOS;
      if (!dataOk) divergencias.push("data");
    }

    const statusEscalaEsperado = mapearStatusOSParaEscala(osData.status || "rascunho");
    const statusEscalaAtual = alocacao.status;
    if (statusEscalaAtual && statusEscalaAtual !== statusEscalaEsperado) {
      statusOk = false;
      divergencias.push("status");
    }

    resultado.divergencias = {
      prestador: !prestadorOk,
      veiculo: !veiculoOk,
      data: !dataOk,
      status: !statusOk,
    };

    if (prestadorOk && veiculoOk && dataOk && statusOk) {
      resultado.status = "sincronizada";
      resultado.label = "Sincronizada";
      resultado.descricao = "OS e Escala estão consistentes";
      resultado.classeBadge = STATUS_SYNC_INFO.sincronizada.classe;
    } else {
      if (!statusOk) {
        resultado.status = "divergencia_status";
        resultado.label = "Status Divergente";
        resultado.descricao = `OS: ${osData.status} → Escala: ${alocacao.status} (esperado: ${statusEscalaEsperado})`;
        resultado.classeBadge = STATUS_SYNC_INFO.divergencia_status.classe;
      } else if (!prestadorOk) {
        resultado.status = "divergencia_prestador";
        resultado.label = "Prestador Divergente";
        resultado.descricao = "Prestador da OS difere do prestador na Escala";
        resultado.classeBadge = STATUS_SYNC_INFO.divergencia_prestador.classe;
      } else if (!veiculoOk) {
        resultado.status = "divergencia_veiculo";
        resultado.label = "Veículo Divergente";
        resultado.descricao = `OS: ${veiculoOS} ≠ Escala: ${veiculoAloc}`;
        resultado.classeBadge = STATUS_SYNC_INFO.divergencia_veiculo.classe;
      } else if (!dataOk) {
        resultado.status = "divergencia_data";
        resultado.label = "Data Divergente";
        resultado.descricao = `OS: ${dataOS} ≠ Escala: ${dataAloc}`;
        resultado.classeBadge = STATUS_SYNC_INFO.divergencia_data.classe;
      }
    }

    return resultado;
  } catch (err) {
    console.warn("[SyncDiagnostico] Erro ao diagnosticar OS:", err);
    return resultado;
  }
}

export async function diagnosticarAlocacao(alocacaoId: string): Promise<{
  temOS: boolean;
  osNumero?: string;
  osStatus?: string;
  divergente: boolean;
  status: DivergenciaTipo;
  label: string;
  classeBadge: string;
}> {
  const resultado = {
    temOS: false,
    divergente: false,
    status: "escala_sem_os" as DivergenciaTipo,
    label: "Sem OS",
    classeBadge: STATUS_SYNC_INFO.escala_sem_os.classe,
  };

  if (!alocacaoId) return resultado;

  try {
    const { data: alocacao } = await supabase
      .from("alocacoes_escala")
      .select("ordem_servico_id, prestador_id, tipo_veiculo, data_escala, status")
      .eq("id", alocacaoId)
      .single();

    if (!alocacao?.ordem_servico_id) return resultado;

    resultado.temOS = true;

    const { data: osData } = await supabase
      .from("ordens_servico")
      .select("numero, status, prestador_id, tipo_veiculo")
      .eq("id", alocacao.ordem_servico_id)
      .single();

    if (osData) {
      resultado.osNumero = osData.numero;
      resultado.osStatus = osData.status;

      const prestadorOk = !alocacao.prestador_id || !osData.prestador_id ||
        String(alocacao.prestador_id) === String(osData.prestador_id);

      const veiculoAloc = (alocacao.tipo_veiculo || "").toLowerCase().trim();
      const veiculoOS = (osData.tipo_veiculo || "").toLowerCase().trim();
      const veiculoOk = !veiculoAloc || !veiculoOS || veiculoAloc === veiculoOS;

      resultado.divergente = !prestadorOk || !veiculoOk;

      if (resultado.divergente) {
        resultado.status = "divergencia_prestador";
        resultado.label = "OS com Divergência";
        resultado.classeBadge = STATUS_SYNC_INFO.divergencia_prestador.classe;
      } else {
        resultado.status = "sincronizada";
        resultado.label = `OS ${osData.numero}`;
        resultado.classeBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
      }
    } else {
      resultado.status = "sincronizada";
      resultado.label = "Com OS";
      resultado.classeBadge = "bg-blue-50 text-blue-700 border-blue-200";
    }

    return resultado;
  } catch (err) {
    console.warn("[SyncDiagnostico] Erro ao diagnosticar alocação:", err);
    return resultado;
  }
}
