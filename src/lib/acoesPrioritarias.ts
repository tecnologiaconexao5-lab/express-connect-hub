export interface OSData {
  id: string;
  numero: string;
  cliente: string;
  prestador: string;
  status: string;
  previsaoTermino?: string | null;
  enderecos?: any[];
  localizacaoEntregaJson?: any;
}

export type TipoAcao =
  | "atraso"
  | "ocorrencia"
  | "risco"
  | "sem_previsao"
  | "comprovante"
  | "sem_coordenada"
  | "comprovante_orfao";

export interface ActionItem {
  id: string;
  prioridade: "critica" | "alta" | "media" | "baixa";
  motivo: string;
  os: string;
  cliente: string;
  prestador: string;
  acaoSugerida: string;
  osId?: string;
  tipo: TipoAcao;
}

export const PESO_PRIORIDADE: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };

export const STATUS_CONCLUIDO = ["finalizada", "entregue", "cancelada"];

export const isOSConcluida = (status: string): boolean =>
  STATUS_CONCLUIDO.includes(status);

export const calcularRiscoOperacional = (previsaoTermino: string | undefined | null, status: string): boolean => {
  if (!previsaoTermino || isOSConcluida(status)) return false;
  const diffMs = new Date(previsaoTermino).getTime() - Date.now();
  const diffMin = diffMs / 60000;
  return diffMin > 0 && diffMin <= 60;
};

export const extrairCoordenadasOS = (os: OSData): { lat: number; lng: number } | null => {
  const locJson = (os as any).localizacaoEntregaJson;
  if (locJson && typeof locJson === 'object') {
    const lat = locJson.lat ?? locJson.latitude;
    const lng = locJson.lng ?? locJson.longitude ?? locJson.long;
    if (typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng)) {
      return { lat, lng };
    }
  }
  const enderecos = (os as any).enderecos;
  if (Array.isArray(enderecos)) {
    for (const end of enderecos) {
      const lat = end.latitude ?? end.lat;
      const lng = end.longitude ?? end.lng;
      if (typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng)) {
        return { lat, lng };
      }
    }
  }
  return null;
};

export interface ComprovantePendente {
  id: string;
  osId: string;
  osNumero: string;
  cliente: string;
  prestador: string;
}

export function gerarAcoesPrioritarias(
  osAtivas: OSData[],
  semComprovanteCount: number,
  comprovantesPendentes?: ComprovantePendente[],
): ActionItem[] {
  const items: ActionItem[] = [];
  let counter = 0;
  const push = (item: Omit<ActionItem, "id">) => {
    items.push({ id: `acao-${counter++}`, ...item });
  };

  for (const os of osAtivas) {
    const atrasada = !isOSConcluida(os.status) && !!os.previsaoTermino && new Date(os.previsaoTermino).getTime() < Date.now();
    const emRisco = calcularRiscoOperacional(os.previsaoTermino, os.status);
    const semPrevisao = !os.previsaoTermino && !isOSConcluida(os.status);
    const semCoord = !extrairCoordenadasOS(os);
    const comOcorrencia = os.status === "com ocorrencia";

    if (atrasada) {
      push({
        prioridade: "critica", motivo: "OS atrasada — prazo vencido",
        os: os.numero || os.id, cliente: os.cliente || "—", prestador: os.prestador || "—",
        acaoSugerida: "Acionar prestador", osId: os.id, tipo: "atraso",
      });
    }
    if (comOcorrencia) {
      push({
        prioridade: "critica", motivo: "OS com ocorrência registrada",
        os: os.numero || os.id, cliente: os.cliente || "—", prestador: os.prestador || "—",
        acaoSugerida: "Verificar ocorrência", osId: os.id, tipo: "ocorrencia",
      });
    }
    if (emRisco) {
      push({
        prioridade: "alta", motivo: "OS em risco operacional — prazo próximo",
        os: os.numero || os.id, cliente: os.cliente || "—", prestador: os.prestador || "—",
        acaoSugerida: "Acionar prestador", osId: os.id, tipo: "risco",
      });
    }
    if (semPrevisao) {
      push({
        prioridade: "alta", motivo: "OS sem previsão de conclusão",
        os: os.numero || os.id, cliente: os.cliente || "—", prestador: os.prestador || "—",
        acaoSugerida: "Atualizar previsão", osId: os.id, tipo: "sem_previsao",
      });
    }
    if (semCoord) {
      push({
        prioridade: "baixa", motivo: "OS sem coordenadas de entrega",
        os: os.numero || os.id, cliente: os.cliente || "—", prestador: os.prestador || "—",
        acaoSugerida: "Contatar cliente", osId: os.id, tipo: "sem_coordenada",
      });
    }
  }

  if (comprovantesPendentes && comprovantesPendentes.length > 0) {
    for (const cp of comprovantesPendentes) {
      push({
        prioridade: "media", motivo: "Comprovante de alocação pendente",
        os: cp.osNumero, cliente: cp.cliente, prestador: cp.prestador,
        acaoSugerida: "Validar comprovante", osId: cp.osId, tipo: "comprovante",
      });
    }
    const orfaos = semComprovanteCount - comprovantesPendentes.length;
    if (orfaos > 0) {
      push({
        prioridade: "media", motivo: "Comprovantes pendentes sem vínculo de OS",
        os: `${orfaos} registro(s)`, cliente: "—", prestador: "—",
        acaoSugerida: "Validar comprovante", tipo: "comprovante_orfao",
      });
    }
  } else if (semComprovanteCount > 0) {
    push({
      prioridade: "media", motivo: `${semComprovanteCount} OS pendente(s) de comprovante`,
      os: "—", cliente: "—", prestador: "—",
      acaoSugerida: "Validar comprovante", tipo: "comprovante_orfao",
    });
  }

  items.sort((a, b) => PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade]);
  return items.slice(0, 10);
}
